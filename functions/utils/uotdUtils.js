/**
 * Utility functions for UOTD (Uniform of the Day) operations
 */

/**
 * Check if a UOTD post already exists for the given date and slot
 * @param {FirebaseFirestore.Firestore} db - Firestore database instance
 * @param {string} targetDate - Date in YYYY-MM-DD format
 * @param {string} targetSlot - Slot name (e.g., "breakfast", "lunch", "dinner")
 * @returns {Promise<{id: string, ...} | null>} - Existing post or null
 */
async function getExistingUotdPost(db, targetDate, targetSlot) {
  const snapshot = await db
    .collection("posts")
    .where("type", "==", "uotd")
    .where("targetDate", "==", targetDate)
    .where("targetSlot", "==", targetSlot)
    .where("status", "==", "published")
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

module.exports = { getExistingUotdPost };
