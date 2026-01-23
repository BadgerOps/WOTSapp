const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const VALID_ROLES = ["user", "uniform_admin", "admin"];

/**
 * Normalizes a role string to lowercase and validates it
 * Returns 'user' if invalid
 */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return "user";
  const normalized = role.toLowerCase().trim();
  return VALID_ROLES.includes(normalized) ? normalized : "user";
}

/**
 * Cloud Function that syncs role changes from personnel records to linked user documents.
 *
 * This function triggers when a personnel document is updated. It checks if:
 * 1. The role field was changed
 * 2. The personnel record is linked to a Firebase Auth user (has userId)
 *
 * If both conditions are met, it updates the user document with the new role.
 *
 * This serves as a backup sync mechanism. The primary sync happens client-side
 * in usePersonnelActions.updatePersonnelRole(), but this function ensures
 * consistency even if the client-side update fails or if roles are changed
 * through direct Firestore updates (e.g., via admin console).
 */
exports.syncPersonnelRoleToUser = onDocumentUpdated(
  "personnel/{personnelId}",
  async (event) => {
    const db = getFirestore();
    const before = event.data.before.data();
    const after = event.data.after.data();
    const personnelId = event.params.personnelId;

    // Check if role changed
    const beforeRole = normalizeRole(before.role);
    const afterRole = normalizeRole(after.role);

    if (beforeRole === afterRole) {
      console.log(
        `[roleSync] Personnel ${personnelId}: No role change detected (${beforeRole})`,
      );
      return null;
    }

    // Check if personnel is linked to a user
    const linkedUserId = after.userId;
    if (!linkedUserId) {
      console.log(
        `[roleSync] Personnel ${personnelId}: Role changed from "${beforeRole}" to "${afterRole}" but no linked user, skipping sync`,
      );
      return null;
    }

    console.log(
      `[roleSync] Personnel ${personnelId}: Syncing role "${afterRole}" to user ${linkedUserId}`,
    );

    try {
      // Check if user document exists
      const userRef = db.collection("users").doc(linkedUserId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.log(
          `[roleSync] User document ${linkedUserId} does not exist, skipping sync`,
        );
        return null;
      }

      // Check if user already has the correct role
      const currentUserRole = normalizeRole(userDoc.data().role);
      if (currentUserRole === afterRole) {
        console.log(
          `[roleSync] User ${linkedUserId} already has role "${afterRole}", skipping update`,
        );
        return null;
      }

      // Update user document with new role
      await userRef.update({
        role: afterRole,
        roleUpdatedAt: FieldValue.serverTimestamp(),
        roleSyncedFromPersonnel: personnelId,
      });

      console.log(
        `[roleSync] Successfully synced role "${afterRole}" to user ${linkedUserId}`,
      );
      return { success: true, role: afterRole, userId: linkedUserId };
    } catch (error) {
      console.error(
        `[roleSync] Error syncing role to user ${linkedUserId}:`,
        error,
      );
      throw error;
    }
  },
);
