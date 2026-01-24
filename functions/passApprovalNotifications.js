const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const {
  getConfiguredTimezone,
} = require("./utils/timezone");

/**
 * Handler logic for pass approval notification
 * Exported separately for testability
 *
 * @param {Object} event - The Firestore trigger event
 * @param {Object} dependencies - Optional dependency injection for testing
 * @returns {Promise<Object|null>} - Messaging response or null
 */
async function handlePassRequestCreated(event, dependencies = {}) {
  const db = dependencies.db || getFirestore();
  const messaging = dependencies.messaging || getMessaging();
  const getTimezone = dependencies.getConfiguredTimezone || getConfiguredTimezone;

  const request = event.data.data();

  // Only notify for pending requests
  if (request.status !== "pending") {
    console.log("Request is not pending, skipping notification");
    return null;
  }

  console.log(
    "New pass approval request created:",
    event.params.requestId
  );

  // Get all candidate_leadership and admins
  const usersSnapshot = await db
    .collection("users")
    .where("role", "in", ["admin", "candidate_leadership"])
    .get();

  const tokens = [];
  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    // Don't notify the requester if they happen to be leadership
    if (doc.id === request.requesterId) {
      return;
    }
    if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
      tokens.push(...userData.fcmTokens);
    }
  });

  if (tokens.length === 0) {
    console.log("No FCM tokens found for leadership");
    return null;
  }

  console.log(`Sending notification to ${tokens.length} leadership tokens`);

  // Get configured timezone and format timestamp
  const timezone = await getTimezone(db);
  console.log(`Using timezone: ${timezone}`);

  // Format time like "0600"
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

  // Build notification
  const companionCount = (request.companions || []).length;
  const companionText = companionCount > 0
    ? ` (+${companionCount} companion${companionCount > 1 ? 's' : ''})`
    : '';

  const title = `[${timeStr}] Pass Request: ${request.requesterName}${companionText}`;

  // Build body
  const bodyParts = [];
  if (request.destination) {
    bodyParts.push(`Destination: ${request.destination}`);
  }
  if (request.expectedReturn) {
    const returnTime = new Date(request.expectedReturn);
    const returnStr = returnTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).replace(":", "");
    bodyParts.push(`Expected return: ${returnStr}`);
  }
  if (request.companions && request.companions.length > 0) {
    const companionNames = request.companions.map(c => c.name).join(", ");
    bodyParts.push(`With: ${companionNames}`);
  }
  if (request.notes) {
    bodyParts.push(`Notes: ${request.notes}`);
  }

  const body = bodyParts.join("\n") || "Tap to review";

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      type: "pass_approval_request",
      requestId: event.params.requestId,
      requesterName: request.requesterName || "",
      destination: request.destination || "",
      title, // Include in data for service worker fallback
      body, // Include in data for service worker fallback
    },
    // Web push specific configuration
    webpush: {
      notification: {
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        tag: `pass-req-${event.params.requestId}`,
        requireInteraction: true, // Keep visible until user interacts
        actions: [
          {
            action: "approve",
            title: "✓ Approve",
          },
          {
            action: "reject",
            title: "✗ Reject",
          },
        ],
      },
      fcmOptions: {
        link: `/?action=review-pass&requestId=${event.params.requestId}`,
      },
    },
    // Apple Push Notification service configuration
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body,
          },
          badge: 1,
          sound: "default",
        },
      },
    },
    // Android specific configuration
    android: {
      priority: "high",
      notification: {
        icon: "ic_notification",
        color: "#4a5d23", // wots-green
        channelId: "wots_leadership_notifications",
        tag: `pass-req-${event.params.requestId}`,
      },
    },
    tokens: tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(
      `Successfully sent ${response.successCount} notifications to leadership`
    );

    // Remove invalid tokens
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
        console.log(
          `Removing ${invalidTokens.length} invalid leadership tokens`
        );
        const batch = db.batch();
        usersSnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.fcmTokens) {
            const validTokens = userData.fcmTokens.filter(
              (t) => !invalidTokens.includes(t)
            );
            if (validTokens.length !== userData.fcmTokens.length) {
              batch.update(doc.ref, { fcmTokens: validTokens });
            }
          }
        });
        await batch.commit();
      }
    }

    return response;
  } catch (error) {
    console.error("Error sending leadership notifications:", error);
    return null;
  }
}

/**
 * Send push notification to candidate_leadership and admins when a new pass request is created
 */
exports.onPassRequestCreated = onDocumentCreated(
  "passApprovalRequests/{requestId}",
  handlePassRequestCreated
);

// Export handler for testing
exports.handlePassRequestCreated = handlePassRequestCreated;
