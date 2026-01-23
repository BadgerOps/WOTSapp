const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const {
  getConfiguredTimezone,
  formatTimestampForNotification,
} = require("./utils/timezone");

/**
 * Send push notification to uniform_admins when a new weather recommendation is created
 */
exports.onRecommendationCreated = onDocumentCreated(
  "weatherRecommendations/{recommendationId}",
  async (event) => {
    const db = getFirestore();
    const messaging = getMessaging();

    const recommendation = event.data.data();

    // Only notify for pending recommendations
    if (recommendation.status !== "pending") {
      console.log("Recommendation is not pending, skipping notification");
      return null;
    }

    console.log(
      "New weather recommendation created:",
      event.params.recommendationId,
    );

    // Get all uniform_admins and admins
    const usersSnapshot = await db
      .collection("users")
      .where("role", "in", ["admin", "uniform_admin"])
      .get();

    const tokens = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
        tokens.push(...userData.fcmTokens);
      }
    });

    if (tokens.length === 0) {
      console.log("No FCM tokens found for approvers");
      return null;
    }

    console.log(`Sending notification to ${tokens.length} approver tokens`);

    // Get configured timezone and format timestamp
    const timezone = await getConfiguredTimezone(db);
    console.log(`Using timezone: ${timezone}`);

    // Format date like "0600 on Jan 23 2006"
    const now = new Date();
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
    const timeStr = now
      .toLocaleTimeString("en-US", timeOptions)
      .replace(":", "");
    const dateStr = now.toLocaleDateString("en-US", dateOptions);

    // Map slot to display name
    const slotDisplayNames = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
    };
    const slotLabel =
      slotDisplayNames[recommendation.targetSlot] || recommendation.targetSlot;

    // Determine weather condition label
    const weatherMain = (
      recommendation.weather.weatherMain || ""
    ).toLowerCase();
    const precipChance = recommendation.weather.precipitationChance || 0;
    const temp = recommendation.weather.temperature || 70;

    let weatherLabel = "";
    if (
      weatherMain.includes("rain") ||
      weatherMain.includes("storm") ||
      weatherMain.includes("drizzle") ||
      precipChance >= 50
    ) {
      weatherLabel = "Wet";
    } else if (weatherMain.includes("snow") || weatherMain.includes("sleet")) {
      weatherLabel = "Snow";
    } else if (temp < 40) {
      weatherLabel = "Cold";
    } else if (temp < 50) {
      weatherLabel = "Cool";
    } else if (temp > 90) {
      weatherLabel = "Hot";
    }

    // Build title: BETA: UOTD Breakfast Wet Posted at 0600 on Jan 23 2006
    const labels = [slotLabel];
    if (weatherLabel) labels.push(weatherLabel);
    const labelStr = labels.join(" ");
    const title = `BETA: UOTD ${labelStr} Posted at ${timeStr} on ${dateStr}`;

    // Get uniform name and details
    const uniformOverride = recommendation.uniformOverride;
    const uniformName = uniformOverride
      ? uniformOverride.name
      : recommendation.uniformName || "Standard Uniform";

    // Build body with uniform and accessories
    const bodyParts = [];

    // Add beta disclaimer
    bodyParts.push("⚠️ Use Williams' Signal posts as source of truth!");
    bodyParts.push("");

    // Add uniform name as header
    bodyParts.push(uniformName);

    // If override has items list, show them
    if (uniformOverride?.items && uniformOverride.items.length > 0) {
      bodyParts.push(uniformOverride.items.join(", "));
    } else if (uniformOverride?.description) {
      bodyParts.push(uniformOverride.description);
    }

    // Add accessories with auto-add notes
    const accessories = recommendation.accessories || [];
    for (const acc of accessories) {
      if (acc.reason) {
        bodyParts.push(`${acc.name} (${acc.reason})`);
      } else {
        bodyParts.push(acc.name);
      }
    }

    const body = bodyParts.join("\n");

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        type: "weather_recommendation",
        recommendationId: event.params.recommendationId,
        uniformName: uniformName,
        targetSlot: recommendation.targetSlot || "",
        slotLabel: slotLabel,
        weatherLabel: weatherLabel || "Normal",
        title, // Include in data for service worker fallback
        body, // Include in data for service worker fallback
      },
      // Web push specific configuration
      webpush: {
        notification: {
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          tag: `rec-${event.params.recommendationId}`,
          requireInteraction: true, // Keep visible until user interacts
          actions: [
            {
              action: "approve",
              title: "✓ Approve",
            },
            {
              action: "edit",
              title: "✏️ Edit",
            },
          ],
        },
        fcmOptions: {
          link: `/?action=review&recommendationId=${event.params.recommendationId}`,
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
          channelId: "wots_admin_notifications",
          tag: `rec-${event.params.recommendationId}`,
        },
      },
      tokens: tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(
        `Successfully sent ${response.successCount} notifications to approvers`,
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
            `Removing ${invalidTokens.length} invalid approver tokens`,
          );
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
      console.error("Error sending approver notifications:", error);
      return null;
    }
  },
);
