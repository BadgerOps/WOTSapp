const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Import scheduled functions
const { uotdScheduler } = require("./uotdScheduler");

// Import geocoding functions
const { geocodeLocation, updateWeatherUnits } = require("./geocoding");

// Import weather checker functions
const {
  scheduledWeatherCheck,
  manualWeatherCheck,
  getCurrentWeather,
} = require("./weatherChecker");

// Import approval workflow functions
const {
  approveRecommendation,
  rejectRecommendation,
  getPendingCount,
  autoPublishPendingRecommendations,
} = require("./approvalWorkflow");

// Approver notifications disabled - using single post notification instead
// const { onRecommendationCreated } = require('./approverNotifications')

// Import personnel auth functions
const { onPersonnelCreated } = require("./personnelAuth");

// Import role sync functions
const { syncPersonnelRoleToUser } = require("./roleSync");

// Import timezone utilities
const {
  getConfiguredTimezone,
  formatTimestampForNotification,
} = require("./utils/timezone");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// Export scheduled functions
exports.uotdScheduler = uotdScheduler;

// Export geocoding functions
exports.geocodeLocation = geocodeLocation;
exports.updateWeatherUnits = updateWeatherUnits;

// Export weather checker functions
exports.scheduledWeatherCheck = scheduledWeatherCheck;
exports.manualWeatherCheck = manualWeatherCheck;
exports.getCurrentWeather = getCurrentWeather;

// Export approval workflow functions
exports.approveRecommendation = approveRecommendation;
exports.rejectRecommendation = rejectRecommendation;
exports.getPendingCount = getPendingCount;
exports.autoPublishPendingRecommendations = autoPublishPendingRecommendations;

// Approver notification trigger disabled - using single post notification instead
// exports.onRecommendationCreated = onRecommendationCreated

// Export personnel auth trigger
exports.onPersonnelCreated = onPersonnelCreated;

// Export role sync trigger
exports.syncPersonnelRoleToUser = syncPersonnelRoleToUser;

// Send push notification when a new post is created
exports.onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const post = event.data.data();

  // Only send notifications for published posts
  if (post.status !== "published") {
    console.log("Post is not published, skipping notification");
    return null;
  }

  console.log("New post created:", post.title);

  // Get configured timezone for timestamp formatting
  const timezone = await getConfiguredTimezone(db);
  console.log(`Using timezone: ${timezone}`);

  // Get all users with FCM tokens
  const usersSnapshot = await db.collection("users").get();

  const tokens = [];
  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
      tokens.push(...userData.fcmTokens);
    }
  });

  if (tokens.length === 0) {
    console.log("No FCM tokens found, skipping notification");
    return null;
  }

  console.log(`Sending notification to ${tokens.length} tokens`);

  const title = getNotificationTitle(post.type, post, timezone);
  const body = formatNotificationBody(post);

  // Build notification message with platform-specific configs
  const message = {
    notification: {
      title,
      body,
    },
    data: {
      postId: event.params.postId,
      type: post.type,
      title, // Include in data for service worker fallback
      body, // Include in data for service worker fallback
    },
    // Web push specific configuration
    webpush: {
      notification: {
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        tag: event.params.postId,
        requireInteraction: false,
      },
      fcmOptions: {
        link: "/",
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
        color: "#1e3a5f",
        channelId: "wots_notifications",
        tag: event.params.postId,
      },
    },
    tokens: tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications`);

    // Log failures and remove invalid tokens
    if (response.failureCount > 0) {
      console.log(`${response.failureCount} notifications failed`);
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const errorMsg = resp.error?.message;
          console.log(`Token ${idx} failed: ${errorCode} - ${errorMsg}`);
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
        // Remove invalid tokens from users
        const batch = db.batch();
        usersSnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.fcmTokens) {
            const validTokens = userData.fcmTokens.filter(
              (t) => !invalidTokens.includes(t),
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
    console.error("Error sending notifications:", error);
    return null;
  }
});

function getNotificationTitle(postType, post, timezone) {
  // Use the shared timezone-aware formatting function
  const timestamp = post.publishedAt
    ? formatTimestampForNotification(post.publishedAt, timezone)
    : formatTimestampForNotification(null, timezone);
  const timePrefix = `[${timestamp}] `;

  switch (postType) {
    case "announcement":
      return `${timePrefix}New Announcement`;
    case "uotd":
      return formatUotdTitle(post, timezone);
    case "schedule":
      return `${timePrefix}Schedule Update`;
    default:
      return `${timePrefix}New Post`;
  }
}

function formatUotdTitle(post, timezone) {
  // Format: BETA: UOTD Breakfast Wet Posted at 0600 on Jan 23 2026
  const now = post.publishedAt ? new Date(post.publishedAt) : new Date();
  const timeOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  };
  const dateOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  };
  const timeStr = now.toLocaleTimeString("en-US", timeOptions).replace(":", "");
  const dateStr = now.toLocaleDateString("en-US", dateOptions);

  // Map slot to display name
  const slotDisplayNames = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };
  const slotLabel = slotDisplayNames[post.targetSlot] || post.targetSlot || "";

  // Determine weather label from content or weather data
  let weatherLabel = "";
  const content = (post.content || "").toLowerCase();
  const weatherCondition = (post.weatherCondition || "").toLowerCase();
  const temp = post.weatherTemp || 70;

  if (
    content.includes("wet weather") ||
    content.includes("rain") ||
    content.includes("ecws") ||
    weatherCondition.includes("rain") ||
    weatherCondition.includes("storm")
  ) {
    weatherLabel = "Wet";
  } else if (content.includes("snow") || weatherCondition.includes("snow")) {
    weatherLabel = "Snow";
  } else if (temp < 40) {
    weatherLabel = "Cold";
  } else if (temp < 50) {
    weatherLabel = "Cool";
  } else if (temp > 90) {
    weatherLabel = "Hot";
  }

  // Build labels string
  const labels = [];
  if (slotLabel) labels.push(slotLabel);
  if (weatherLabel) labels.push(weatherLabel);
  const labelStr = labels.join(" ");

  return `🔴 BETA | UOTD ${labelStr} Posted at ${timeStr} on ${dateStr}`;
}

function formatNotificationBody(post) {
  const maxLength = 350;
  let body = "";

  // For UOTD posts, use new format with BETA disclaimer
  if (post.type === "uotd") {
    const bodyParts = [];

    // Add BETA disclaimer
    bodyParts.push("⚠️ Use Williams' Signal posts as source of truth!");
    bodyParts.push("");

    // Add uniform name/title
    if (post.uniformName) {
      bodyParts.push(post.uniformName);
    } else if (post.title) {
      bodyParts.push(post.title);
    }

    // Add content (uniform description, items, etc.)
    if (post.content) {
      // Split content and add each line
      const contentLines = post.content.split("\n").filter((l) => l.trim());
      bodyParts.push(...contentLines);
    }

    body = bodyParts.join("\n");
  } else {
    // For non-UOTD posts, use title + content preview
    body = post.title;

    if (post.content) {
      let preview = post.content.substring(0, 100).trim();

      if (post.content.length > 100 && preview.lastIndexOf(" ") > 50) {
        preview = preview.substring(0, preview.lastIndexOf(" "));
      }

      if (post.content.length > preview.length) {
        preview += "...";
      }

      body += "\n" + preview;
    }
  }

  // Add admin note if present (at the end)
  if (post.adminNote && post.adminNote.trim()) {
    const notePrefix = "\nNote: ";
    const remainingSpace = maxLength - body.length - notePrefix.length;

    if (remainingSpace > 20) {
      let note = post.adminNote.trim();
      if (note.length > remainingSpace) {
        note = note.substring(0, remainingSpace - 3) + "...";
      }
      body += notePrefix + note;
    }
  }

  // Ensure total length doesn't exceed max
  if (body.length > maxLength) {
    body = body.substring(0, maxLength - 3) + "...";
  }

  return body;
}
