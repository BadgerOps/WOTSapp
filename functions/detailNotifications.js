const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const {
  getConfiguredTimezone,
  getCurrentTimeInTimezone,
  getTodayInTimezone,
} = require("./utils/timezone");
const { wrapScheduled, addBreadcrumb } = require("./utils/sentry");

/**
 * Get detail notification config from Firestore
 * @param {Object} db - Firestore instance
 * @returns {Promise<Object>} Config with notification times and enabled flag
 */
async function getDetailNotificationConfig(db) {
  const configDoc = await db.doc("detailConfig/default").get();
  if (configDoc.exists) {
    const data = configDoc.data();
    return {
      morningNotificationTime: data.morningNotificationTime || "07:00",
      eveningNotificationTime: data.eveningNotificationTime || "19:00",
      notificationEnabled: data.notificationEnabled !== false, // Default to true
    };
  }
  // Defaults
  return {
    morningNotificationTime: "07:00",
    eveningNotificationTime: "19:00",
    notificationEnabled: true,
  };
}

/**
 * Get today's detail assignments for a specific time slot
 * @param {Object} db - Firestore instance
 * @param {string} today - Today's date in YYYY-MM-DD format
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {Promise<Array>} Array of assignment documents
 */
async function getTodaysAssignments(db, today, timeSlot) {
  // Get assignments that are assigned, in_progress, or rejected for today
  const snapshot = await db
    .collection("detailAssignments")
    .where("assignmentDate", "==", today)
    .where("status", "in", ["assigned", "in_progress", "rejected"])
    .get();

  // Filter to matching time slot (include 'both')
  return snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data.timeSlot === timeSlot || data.timeSlot === "both";
  });
}

/**
 * Check if an assignment already exists for today and time slot
 * @param {Object} db - Firestore instance
 * @param {string} today - Today's date in YYYY-MM-DD format
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {Promise<boolean>} True if assignment exists
 */
async function hasAssignmentForToday(db, today, timeSlot) {
  const snapshot = await db
    .collection("detailAssignments")
    .where("assignmentDate", "==", today)
    .get();

  return snapshot.docs.some((doc) => {
    const data = doc.data();
    return data.timeSlot === timeSlot || data.timeSlot === "both";
  });
}

/**
 * Reset an existing assignment for today's time slot
 * This resets all tasks to uncompleted and sets status back to 'assigned'
 * Resets ALL assignments regardless of current status (including approved)
 * @param {Object} db - Firestore instance
 * @param {string} assignmentId - The assignment document ID
 * @param {Object} assignmentData - The current assignment data
 * @returns {Promise<Object>} Result with reset status
 */
async function resetAssignmentForNewDay(db, assignmentId, assignmentData) {
  // Reset all tasks to not completed
  const resetTasks = (assignmentData.tasks || []).map((task) => ({
    ...task,
    completed: false,
    completedAt: null,
    notes: "",
  }));

  const updates = {
    status: "assigned",
    tasks: resetTasks,
    // Clear all workflow fields
    startedAt: null,
    startedBy: null,
    completedAt: null,
    completedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    completionNotes: null,
    approvedAt: null,
    approvedBy: null,
    approvedByName: null,
    approverNotes: null,
    // Update timestamp
    updatedAt: new Date(),
    lastResetAt: new Date(),
  };

  await db.collection("detailAssignments").doc(assignmentId).update(updates);

  return {
    id: assignmentId,
    wasReset: true,
    previousStatus: assignmentData.status,
  };
}

/**
 * Get existing assignments for today that need to be reset
 * Returns ALL assignments for today's time slot regardless of status
 * @param {Object} db - Firestore instance
 * @param {string} today - Today's date in YYYY-MM-DD format
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {Promise<Array>} Array of assignment documents to reset
 */
async function getAssignmentsToReset(db, today, timeSlot) {
  const snapshot = await db
    .collection("detailAssignments")
    .where("assignmentDate", "==", today)
    .get();

  // Filter to matching time slot (include 'both')
  return snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data.timeSlot === timeSlot || data.timeSlot === "both";
  });
}

/**
 * Reset all existing assignments for today's time slot
 * This ensures detail cards are fresh each morning/evening
 * @param {Object} db - Firestore instance
 * @param {string} today - Today's date in YYYY-MM-DD format
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {Promise<Array>} Array of reset results
 */
async function resetExistingAssignments(db, today, timeSlot) {
  const assignmentsToReset = await getAssignmentsToReset(db, today, timeSlot);
  const results = [];

  for (const doc of assignmentsToReset) {
    try {
      const result = await resetAssignmentForNewDay(db, doc.id, doc.data());
      results.push(result);
      console.log(`Reset assignment ${doc.id} from ${result.previousStatus} to assigned`);
    } catch (error) {
      console.error(`Error resetting assignment ${doc.id}:`, error);
      results.push({ id: doc.id, wasReset: false, error: error.message });
    }
  }

  return results;
}

/**
 * Get the most recent completed/approved assignment for a time slot
 * @param {Object} db - Firestore instance
 * @param {string} timeSlot - 'morning' or 'evening'
 * @returns {Promise<Object|null>} Most recent assignment data or null
 */
async function getMostRecentCompletedAssignment(db, timeSlot) {
  // Get recent completed/approved assignments
  const snapshot = await db
    .collection("detailAssignments")
    .where("status", "in", ["completed", "approved"])
    .orderBy("assignmentDate", "desc")
    .limit(20)
    .get();

  // Find the most recent one matching this time slot
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.timeSlot === timeSlot || data.timeSlot === "both") {
      return { id: doc.id, ...data };
    }
  }

  return null;
}

/**
 * Clone a completed assignment for a new date
 * Resets all task completions and status fields
 * @param {Object} db - Firestore instance
 * @param {Object} sourceAssignment - The assignment to clone
 * @param {string} newDate - The new assignment date (YYYY-MM-DD)
 * @param {string} timeSlot - The time slot for the new assignment
 * @returns {Promise<string>} The new assignment ID
 */
async function cloneAssignmentForDate(db, sourceAssignment, newDate, timeSlot) {
  // Reset all tasks to not completed
  const resetTasks = (sourceAssignment.tasks || []).map((task) => ({
    ...task,
    completed: false,
    completedAt: null,
    notes: "",
  }));

  // Calculate dueDateTime based on new date and time slot
  const morningTime = sourceAssignment.morningTime || "08:00";
  const eveningTime = sourceAssignment.eveningTime || "18:00";
  const targetTime = timeSlot === "morning" ? morningTime : eveningTime;
  const [hours, minutes] = targetTime.split(":").map(Number);
  const dueDate = new Date(newDate + "T12:00:00");
  dueDate.setHours(hours, minutes, 0, 0);

  const newAssignment = {
    // Preserve template and structure
    templateId: sourceAssignment.templateId,
    templateName: sourceAssignment.templateName,
    timeSlot: timeSlot === "both" ? sourceAssignment.timeSlot : timeSlot,
    morningTime,
    eveningTime,

    // Set new date
    assignmentDate: newDate,
    dueDateTime: dueDate,

    // Reset status
    status: "assigned",
    tasks: resetTasks,

    // Clear completion fields
    startedAt: null,
    startedBy: null,
    completedAt: null,
    completedBy: null,
    approvedAt: null,
    approvedBy: null,
    approvedByName: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    completionNotes: null,

    // Preserve assignedTo for legacy assignments
    assignedTo: sourceAssignment.assignedTo || [],

    // Metadata
    createdBy: "system",
    createdByName: "Auto-generated",
    createdAt: new Date(),
    updatedAt: new Date(),
    clonedFrom: sourceAssignment.id,
  };

  const docRef = await db.collection("detailAssignments").add(newAssignment);
  return docRef.id;
}

/**
 * Extract unique personnel IDs from assignment tasks
 * @param {Array} assignments - Array of assignment documents
 * @returns {Set<string>} Set of unique personnel IDs
 */
function extractPersonnelIds(assignments) {
  const personnelIds = new Set();

  assignments.forEach((doc) => {
    const data = doc.data();
    // Get personnel IDs from tasks
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((task) => {
        if (task.assignedTo?.personnelId) {
          personnelIds.add(task.assignedTo.personnelId);
        }
      });
    }
    // Also include high-level assignedTo (for legacy assignments)
    if (data.assignedTo && Array.isArray(data.assignedTo)) {
      data.assignedTo.forEach((person) => {
        if (person.personnelId) {
          personnelIds.add(person.personnelId);
        }
      });
    }
  });

  return personnelIds;
}

/**
 * Get FCM tokens for a list of personnel IDs
 * @param {Object} db - Firestore instance
 * @param {Set<string>} personnelIds - Set of personnel IDs
 * @returns {Promise<Object>} Object with tokens array and usersSnapshot for cleanup
 */
async function getFCMTokensForPersonnel(db, personnelIds) {
  if (personnelIds.size === 0) {
    return { tokens: [], usersSnapshot: null };
  }

  // Personnel IDs can be either user UIDs directly or personnel doc IDs
  // We need to find users that match either way
  const tokens = [];
  const userDocs = [];

  // First, try to get users directly by UID (for users where personnelId = uid)
  const uidArray = Array.from(personnelIds);

  // Firestore 'in' queries are limited to 30 items, so chunk if needed
  const chunks = [];
  for (let i = 0; i < uidArray.length; i += 30) {
    chunks.push(uidArray.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    // Get users by UID
    const usersSnapshot = await db
      .collection("users")
      .where("__name__", "in", chunk)
      .get();

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens.push(...userData.fcmTokens);
        userDocs.push(doc);
      }
    });
  }

  // Also check personnel records for linked users
  for (const chunk of chunks) {
    const personnelSnapshot = await db
      .collection("personnel")
      .where("__name__", "in", chunk)
      .get();

    for (const personnelDoc of personnelSnapshot.docs) {
      const personnelData = personnelDoc.data();
      if (personnelData.userId) {
        // Get the linked user
        const userDoc = await db.collection("users").doc(personnelData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
            // Avoid duplicates
            const existingIds = userDocs.map((d) => d.id);
            if (!existingIds.includes(userDoc.id)) {
              tokens.push(...userData.fcmTokens);
              userDocs.push(userDoc);
            }
          }
        }
      }
    }
  }

  return { tokens, userDocs };
}

/**
 * Build notification message for detail reminder
 * @param {string} timeSlot - 'morning' or 'evening'
 * @param {string} timeStr - Formatted time string (e.g., "0700")
 * @param {number} taskCount - Number of tasks assigned
 * @param {string} templateName - Name of the detail template
 * @returns {Object} Notification message object
 */
function buildDetailNotification(timeSlot, timeStr, taskCount, templateName) {
  const slotLabel = timeSlot === "morning" ? "Morning" : "Evening";
  const title = `[${timeStr}] Detail Reminder: ${slotLabel} Cleaning`;

  const bodyParts = [];
  if (templateName) {
    bodyParts.push(templateName);
  }
  bodyParts.push(`You have ${taskCount} task${taskCount !== 1 ? "s" : ""} assigned`);
  bodyParts.push("Tap to view and start your detail");

  const body = bodyParts.join("\n");

  return {
    notification: {
      title,
      body,
    },
    data: {
      type: "detail_reminder",
      timeSlot,
      title,
      body,
    },
    webpush: {
      notification: {
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        tag: `detail-reminder-${timeSlot}`,
        requireInteraction: false,
      },
      fcmOptions: {
        link: "/details",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          badge: 1,
          sound: "default",
        },
      },
    },
    android: {
      priority: "high",
      notification: {
        icon: "ic_notification",
        color: "#4a5d23", // wots-green
        channelId: "wots_notifications",
        tag: `detail-reminder-${timeSlot}`,
      },
    },
  };
}

/**
 * Remove invalid FCM tokens from user documents
 * @param {Object} db - Firestore instance
 * @param {Array} userDocs - Array of user document snapshots
 * @param {Array} invalidTokens - Array of invalid tokens to remove
 */
async function removeInvalidTokens(db, userDocs, invalidTokens) {
  if (invalidTokens.length === 0 || !userDocs || userDocs.length === 0) {
    return;
  }

  const batch = db.batch();
  let updateCount = 0;

  userDocs.forEach((doc) => {
    const userData = doc.data();
    if (userData.fcmTokens) {
      const validTokens = userData.fcmTokens.filter(
        (t) => !invalidTokens.includes(t)
      );
      if (validTokens.length !== userData.fcmTokens.length) {
        batch.update(doc.ref, { fcmTokens: validTokens });
        updateCount++;
      }
    }
  });

  if (updateCount > 0) {
    await batch.commit();
    console.log(`Removed invalid tokens from ${updateCount} user documents`);
  }
}

/**
 * Send detail reminder notifications
 * Resets existing assignments and/or clones from previous completed ones
 * @param {Object} db - Firestore instance
 * @param {Object} messaging - Firebase Messaging instance
 * @param {string} timeSlot - 'morning' or 'evening'
 * @param {string} timezone - IANA timezone string
 * @returns {Promise<Object>} Result of the operation
 */
async function sendDetailReminders(db, messaging, timeSlot, timezone) {
  const today = getTodayInTimezone(timezone);
  let clonedAssignment = null;
  let resetResults = [];

  // First, reset any existing assignments for today's time slot
  // This ensures the detail card is fresh each morning/evening
  try {
    resetResults = await resetExistingAssignments(db, today, timeSlot);
    if (resetResults.length > 0) {
      console.log(`Reset ${resetResults.length} existing assignment(s) for ${today} ${timeSlot}`);
    }
  } catch (error) {
    console.error("Error resetting existing assignments:", error);
    // Continue - we can still clone or send notifications
  }

  // Check if there's already an assignment for today (after reset)
  const hasExisting = await hasAssignmentForToday(db, today, timeSlot);

  if (!hasExisting) {
    // Try to clone the most recent completed assignment
    const recentAssignment = await getMostRecentCompletedAssignment(db, timeSlot);

    if (recentAssignment) {
      try {
        const newId = await cloneAssignmentForDate(db, recentAssignment, today, timeSlot);
        clonedAssignment = {
          id: newId,
          clonedFrom: recentAssignment.id,
          templateName: recentAssignment.templateName,
        };
        console.log(`Auto-cloned assignment ${recentAssignment.id} to ${newId} for ${today} ${timeSlot}`);
      } catch (error) {
        console.error("Error cloning assignment:", error);
        // Continue without the clone - we can still send notifications if there are other assignments
      }
    }
  }

  // Get today's assignments for this time slot (including any just-cloned one)
  const assignments = await getTodaysAssignments(db, today, timeSlot);

  if (assignments.length === 0) {
    return {
      sent: false,
      reason: "No assignments for today's time slot (and no previous to clone)",
      timeSlot,
      date: today,
      clonedAssignment,
      resetResults,
    };
  }

  // Extract unique personnel IDs
  const personnelIds = extractPersonnelIds(assignments);

  if (personnelIds.size === 0) {
    return {
      sent: false,
      reason: "No personnel assigned to tasks",
      timeSlot,
      date: today,
      assignmentCount: assignments.length,
      clonedAssignment,
      resetResults,
    };
  }

  // Get FCM tokens for the personnel
  const { tokens, userDocs } = await getFCMTokensForPersonnel(db, personnelIds);

  if (tokens.length === 0) {
    return {
      sent: false,
      reason: "No FCM tokens found for assigned personnel",
      timeSlot,
      date: today,
      personnelCount: personnelIds.size,
      clonedAssignment,
      resetResults,
    };
  }

  // Get template name from first assignment (they're typically the same)
  const templateName = assignments[0].data().templateName || "Cleaning Detail";

  // Count total tasks
  let totalTasks = 0;
  assignments.forEach((doc) => {
    const data = doc.data();
    if (data.tasks) {
      totalTasks += data.tasks.length;
    }
  });

  // Format time for notification
  const now = new Date();
  const timeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  };
  const timeStr = now
    .toLocaleTimeString("en-US", timeOptions)
    .replace(":", "");

  // Build and send notification
  const notification = buildDetailNotification(timeSlot, timeStr, totalTasks, templateName);
  notification.tokens = tokens;

  try {
    const response = await messaging.sendEachForMulticast(notification);
    console.log(`Detail reminder: sent ${response.successCount}/${tokens.length} notifications`);

    // Handle invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.log(`Removing ${invalidTokens.length} invalid tokens`);
        await removeInvalidTokens(db, userDocs, invalidTokens);
      }
    }

    return {
      sent: true,
      timeSlot,
      date: today,
      successCount: response.successCount,
      failureCount: response.failureCount,
      tokenCount: tokens.length,
      personnelCount: personnelIds.size,
      assignmentCount: assignments.length,
      clonedAssignment,
      resetResults,
    };
  } catch (error) {
    console.error("Error sending detail reminder notifications:", error);
    throw error;
  }
}

/**
 * Scheduled detail reminder - runs every hour, sends at configured times
 * Notification times are read from detailConfig/default
 * Timezone is read from settings/appConfig
 */
exports.scheduledDetailReminder = onSchedule(
  {
    schedule: "0 * * * *", // Every hour on the hour
  },
  wrapScheduled(async () => {
    const db = getFirestore();
    const messaging = getMessaging();
    addBreadcrumb("Starting scheduled detail reminder check", {}, "notification");

    try {
      // Get timezone from global config
      const timezone = await getConfiguredTimezone(db);
      const currentTime = getCurrentTimeInTimezone(timezone);

      // Get notification config
      const config = await getDetailNotificationConfig(db);

      if (!config.notificationEnabled) {
        return {
          skipped: true,
          reason: "Detail notifications disabled",
          currentTime,
          timezone,
        };
      }

      // Check if current time matches configured notification times
      let timeSlot = null;
      if (currentTime === config.morningNotificationTime) {
        timeSlot = "morning";
      } else if (currentTime === config.eveningNotificationTime) {
        timeSlot = "evening";
      }

      if (!timeSlot) {
        return {
          skipped: true,
          reason: "Not a configured notification time",
          currentTime,
          timezone,
          morningTime: config.morningNotificationTime,
          eveningTime: config.eveningNotificationTime,
        };
      }

      console.log(`Detail reminder triggered for ${timeSlot} at ${currentTime} (${timezone})`);

      const result = await sendDetailReminders(db, messaging, timeSlot, timezone);
      console.log("Detail reminder result:", result);

      return result;
    } catch (error) {
      console.error("Scheduled detail reminder failed:", error);
      throw error;
    }
  }, "scheduledDetailReminder")
);

// Export for testing
exports.sendDetailReminders = sendDetailReminders;
exports.getDetailNotificationConfig = getDetailNotificationConfig;
exports.cloneAssignmentForDate = cloneAssignmentForDate;
exports.getMostRecentCompletedAssignment = getMostRecentCompletedAssignment;
exports.hasAssignmentForToday = hasAssignmentForToday;
exports.resetAssignmentForNewDay = resetAssignmentForNewDay;
exports.resetExistingAssignments = resetExistingAssignments;
exports.getAssignmentsToReset = getAssignmentsToReset;
