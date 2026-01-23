const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getExistingUotdPost } = require("./utils/uotdUtils");

/**
 * Approve a weather recommendation and create a UOTD post
 */
exports.approveRecommendation = onCall(async (request) => {
  const db = getFirestore();

  // Check authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  // Check authorization
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userRole = userDoc.exists ? userDoc.data().role : "user";

  if (userRole !== "admin" && userRole !== "uniform_admin") {
    throw new HttpsError(
      "permission-denied",
      "Must be admin or uniform_admin to approve recommendations",
    );
  }

  const { recommendationId, customTitle, customContent } = request.data;

  if (!recommendationId) {
    throw new HttpsError("invalid-argument", "recommendationId is required");
  }

  // Get the recommendation
  const recRef = db.collection("weatherRecommendations").doc(recommendationId);
  const recDoc = await recRef.get();

  if (!recDoc.exists) {
    throw new HttpsError("not-found", "Recommendation not found");
  }

  const recommendation = recDoc.data();

  // Check status
  if (recommendation.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      `Recommendation is already ${recommendation.status}`,
    );
  }

  // Check if a UOTD post already exists for this slot (defense in depth)
  if (recommendation.targetDate && recommendation.targetSlot) {
    const existingPost = await getExistingUotdPost(
      db,
      recommendation.targetDate,
      recommendation.targetSlot,
    );
    if (existingPost) {
      // Mark recommendation as superseded and return error
      await recRef.update({
        status: "superseded",
        supersededReason: "Post already exists",
      });
      throw new HttpsError(
        "already-exists",
        `UOTD already posted for ${recommendation.targetSlot} on ${recommendation.targetDate}`,
      );
    }
  }

  // Get uniform details
  const uniformDoc = await db
    .collection("uniforms")
    .doc(recommendation.uniformId)
    .get();

  if (!uniformDoc.exists) {
    throw new HttpsError("not-found", "Associated uniform not found");
  }

  const uniform = uniformDoc.data();

  // Get approver's name
  const approverName =
    userDoc.exists && userDoc.data().displayName
      ? userDoc.data().displayName
      : request.auth.token.email || "Admin";

  // Build post title and content
  const title = customTitle || `Uniform #${uniform.number} - ${uniform.name}`;

  // Build weather summary
  const weatherInfo = recommendation.weather;
  const tempDisplay = `${Math.round(weatherInfo.temperature)}°`;
  const conditions = weatherInfo.weatherMain || "Clear";
  const weatherSummary =
    `Current weather: ${tempDisplay}, ${conditions}. ` +
    `Humidity: ${weatherInfo.humidity}%, Wind: ${Math.round(weatherInfo.windSpeed)} mph.` +
    (weatherInfo.precipitationChance > 20
      ? ` ${Math.round(weatherInfo.precipitationChance)}% chance of precipitation.`
      : "");

  // Combine: uniform description + weather + custom content
  const contentParts = [];
  if (uniform.description) {
    contentParts.push(uniform.description);
  }
  contentParts.push(weatherSummary);
  if (customContent) {
    contentParts.push(customContent);
  }
  const content = contentParts.join("\n\n");

  // Create the UOTD post
  const now = new Date();
  const postData = {
    type: "uotd",
    title,
    content: content.trim(),
    uniformId: recommendation.uniformId,
    uniformNumber: uniform.number,
    uniformName: uniform.name,
    targetSlot: recommendation.targetSlot || null,
    targetDate: recommendation.targetDate || null,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
    publishedAt: now.toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
    authorId: request.auth.uid,
    authorName: approverName,
    approvedByName: approverName,
    weatherBased: true,
    weatherRecommendationId: recommendationId,
    weatherCondition: weatherInfo.weatherMain || "Clear",
    weatherTemp: Math.round(weatherInfo.temperature),
  };

  // Use a transaction to ensure consistency
  const result = await db.runTransaction(async (transaction) => {
    // Create post
    const postRef = db.collection("posts").doc();
    transaction.set(postRef, postData);

    // Update recommendation
    transaction.update(recRef, {
      status: "approved",
      approvedBy: request.auth.uid,
      approvedAt: FieldValue.serverTimestamp(),
      postId: postRef.id,
    });

    return { postId: postRef.id };
  });

  return {
    success: true,
    message: "Recommendation approved and UOTD post created",
    postId: result.postId,
    recommendation: {
      uniformNumber: uniform.number,
      uniformName: uniform.name,
    },
  };
});

/**
 * Reject a weather recommendation
 */
exports.rejectRecommendation = onCall(async (request) => {
  const db = getFirestore();

  // Check authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  // Check authorization
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userRole = userDoc.exists ? userDoc.data().role : "user";

  if (userRole !== "admin" && userRole !== "uniform_admin") {
    throw new HttpsError(
      "permission-denied",
      "Must be admin or uniform_admin to reject recommendations",
    );
  }

  const { recommendationId, reason } = request.data;

  if (!recommendationId) {
    throw new HttpsError("invalid-argument", "recommendationId is required");
  }

  // Get the recommendation
  const recRef = db.collection("weatherRecommendations").doc(recommendationId);
  const recDoc = await recRef.get();

  if (!recDoc.exists) {
    throw new HttpsError("not-found", "Recommendation not found");
  }

  const recommendation = recDoc.data();

  // Check status
  if (recommendation.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      `Recommendation is already ${recommendation.status}`,
    );
  }

  // Update recommendation
  await recRef.update({
    status: "rejected",
    rejectedBy: request.auth.uid,
    rejectedAt: FieldValue.serverTimestamp(),
    rejectionReason: reason || null,
  });

  return {
    success: true,
    message: "Recommendation rejected",
    recommendationId,
  };
});

/**
 * Get pending recommendations count (for badge display)
 */
exports.getPendingCount = onCall(async (request) => {
  const db = getFirestore();

  // Check authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  // Check authorization
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const userRole = userDoc.exists ? userDoc.data().role : "user";

  if (userRole !== "admin" && userRole !== "uniform_admin") {
    return { count: 0 };
  }

  const snapshot = await db
    .collection("weatherRecommendations")
    .where("status", "==", "pending")
    .count()
    .get();

  return { count: snapshot.data().count };
});

/**
 * Expire old pending recommendations (cleanup function)
 * Run daily to mark expired recommendations
 */
exports.expireOldRecommendations = async () => {
  const db = getFirestore();
  const now = new Date().toISOString();

  const snapshot = await db
    .collection("weatherRecommendations")
    .where("status", "==", "pending")
    .where("expiresAt", "<", now)
    .get();

  if (snapshot.empty) {
    console.log("No recommendations to expire");
    return { expired: 0 };
  }

  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      status: "expired",
    });
  });

  await batch.commit();
  console.log(`Expired ${snapshot.size} recommendations`);

  return { expired: snapshot.size };
};

/**
 * Auto-publish pending recommendations after 5 minutes of no admin interaction
 * Runs every minute to check for pending recommendations
 */
const AUTO_PUBLISH_DELAY_MINUTES = 5;

exports.autoPublishPendingRecommendations = onSchedule(
  {
    schedule: "* * * * *", // Every minute
  },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const cutoffTime = new Date(
      now.getTime() - AUTO_PUBLISH_DELAY_MINUTES * 60 * 1000,
    );

    console.log(
      `Checking for pending recommendations older than ${cutoffTime.toISOString()}`,
    );

    // Query pending recommendations created more than 5 minutes ago
    const snapshot = await db
      .collection("weatherRecommendations")
      .where("status", "==", "pending")
      .get();

    if (snapshot.empty) {
      console.log("No pending recommendations found");
      return { autoPublished: 0 };
    }

    // Filter to those older than cutoff (createdAt comparison)
    const toAutoPublish = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : new Date(data.createdAt);
      if (createdAt < cutoffTime) {
        toAutoPublish.push({ id: doc.id, data });
      }
    });

    if (toAutoPublish.length === 0) {
      console.log("No recommendations ready for auto-publish");
      return { autoPublished: 0 };
    }

    console.log(
      `Found ${toAutoPublish.length} recommendations to auto-publish`,
    );

    let successCount = 0;
    for (const {
      id: recommendationId,
      data: recommendation,
    } of toAutoPublish) {
      try {
        // Get uniform details
        const uniformDoc = await db
          .collection("uniforms")
          .doc(recommendation.uniformId)
          .get();

        if (!uniformDoc.exists) {
          console.log(
            `Uniform ${recommendation.uniformId} not found, skipping recommendation ${recommendationId}`,
          );
          continue;
        }

        const uniform = uniformDoc.data();

        // Check if a UOTD post already exists for this slot (defense in depth)
        if (recommendation.targetDate && recommendation.targetSlot) {
          const existingPost = await getExistingUotdPost(
            db,
            recommendation.targetDate,
            recommendation.targetSlot,
          );
          if (existingPost) {
            console.log(
              `Post already exists for ${recommendation.targetDate} ${recommendation.targetSlot}, marking recommendation as superseded`,
            );
            await db
              .collection("weatherRecommendations")
              .doc(recommendationId)
              .update({
                status: "superseded",
                supersededReason: "Post already exists",
              });
            continue;
          }
        }

        // Build post title and content (same as manual approval)
        const title = `Uniform #${uniform.number} - ${uniform.name}`;

        // Build weather summary
        const weatherInfo = recommendation.weather;
        const tempDisplay = `${Math.round(weatherInfo.temperature)}°`;
        const conditions = weatherInfo.weatherMain || "Clear";
        const weatherSummary =
          `Current weather: ${tempDisplay}, ${conditions}. ` +
          `Humidity: ${weatherInfo.humidity}%, Wind: ${Math.round(weatherInfo.windSpeed)} mph.` +
          (weatherInfo.precipitationChance > 20
            ? ` ${Math.round(weatherInfo.precipitationChance)}% chance of precipitation.`
            : "");

        // Combine: uniform description + weather
        const contentParts = [];
        if (uniform.description) {
          contentParts.push(uniform.description);
        }
        contentParts.push(weatherSummary);
        const content = contentParts.join("\n\n");

        // Create the UOTD post
        const postData = {
          type: "uotd",
          title,
          content: content.trim(),
          uniformId: recommendation.uniformId,
          uniformNumber: uniform.number,
          uniformName: uniform.name,
          targetSlot: recommendation.targetSlot || null,
          targetDate: recommendation.targetDate || null,
          status: "published",
          createdAt: FieldValue.serverTimestamp(),
          publishedAt: now.toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
          authorId: "system",
          authorName: "The Guardians",
          approvedByName: "The Guardians",
          weatherBased: true,
          weatherRecommendationId: recommendationId,
          autoPublished: true,
          weatherCondition: weatherInfo.weatherMain || "Clear",
          weatherTemp: Math.round(weatherInfo.temperature),
        };

        // Use a transaction to ensure consistency
        const recRef = db
          .collection("weatherRecommendations")
          .doc(recommendationId);
        await db.runTransaction(async (transaction) => {
          // Re-check status in transaction
          const recDoc = await transaction.get(recRef);
          if (!recDoc.exists || recDoc.data().status !== "pending") {
            console.log(
              `Recommendation ${recommendationId} is no longer pending, skipping`,
            );
            return;
          }

          // Create post
          const postRef = db.collection("posts").doc();
          transaction.set(postRef, postData);

          // Update recommendation
          transaction.update(recRef, {
            status: "approved",
            approvedBy: "system",
            approvedAt: FieldValue.serverTimestamp(),
            postId: postRef.id,
            autoPublished: true,
          });
        });

        console.log(
          `Auto-published recommendation ${recommendationId} as Uniform #${uniform.number}`,
        );
        successCount++;
      } catch (error) {
        console.error(
          `Error auto-publishing recommendation ${recommendationId}:`,
          error,
        );
      }
    }

    console.log(`Auto-published ${successCount} recommendations`);
    return { autoPublished: successCount };
  },
);
