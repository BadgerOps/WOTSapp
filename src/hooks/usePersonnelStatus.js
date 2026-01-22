import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";
import { usePersonnel } from "./usePersonnel";

/**
 * Status types for personnel
 */
export const STATUS_TYPES = {
  present: { label: "Present", color: "green" },
  pass: { label: "Pass", color: "yellow" },
  // leave: { label: 'Leave', color: 'blue' },
  // tdy: { label: 'TDY', color: 'purple' },
  sick_call: { label: "Sick Call", color: "orange" },
};

/**
 * Pass stages for tracking location during pass
 * Flow: enroute_to -> arrived -> enroute_back -> (sign back in = present)
 */
export const PASS_STAGES = {
  enroute_to: { label: "Enroute to", color: "yellow", next: "arrived" },
  arrived: { label: "At location", color: "blue", next: "enroute_back" },
  enroute_back: { label: "Enroute back", color: "yellow", next: null }, // next is sign-in
};

/**
 * Hook to fetch all personnel with their current status (real-time)
 * Merges personnel data with personnelStatus data
 */
export function usePersonnelStatus() {
  const {
    personnel,
    loading: personnelLoading,
    error: personnelError,
  } = usePersonnel();
  const [statuses, setStatuses] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "personnelStatus"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const statusMap = {};
        snapshot.docs.forEach((doc) => {
          statusMap[doc.id] = {
            id: doc.id,
            ...doc.data(),
          };
        });
        setStatuses(statusMap);
        setStatusLoading(false);
      },
      (err) => {
        console.error("Error fetching personnel status:", err);
        setStatusError(err.message);
        setStatusLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  // Merge personnel with their status
  // Check personnel document ID, linked userId, or match by email in status records
  const personnelWithStatus = personnel.map((person) => {
    // First try to find status by personnel document ID
    let statusRecord = statuses[person.id];
    // If not found and person has a linked userId, try that
    if (!statusRecord && person.userId) {
      statusRecord = statuses[person.userId];
    }
    // If still not found, try to match by email (for self-signout before account linking)
    if (!statusRecord && person.email) {
      const matchingStatus = Object.values(statuses).find(
        (s) => s.selfUpdated && s.userEmail === person.email,
      );
      if (matchingStatus) {
        statusRecord = matchingStatus;
      }
    }
    return {
      ...person,
      status: statusRecord?.status || "present",
      statusDetails: statusRecord || null,
    };
  });

  return {
    personnelWithStatus,
    loading: personnelLoading || statusLoading,
    error: personnelError || statusError,
  };
}

/**
 * Hook to get the current user's status
 */
export function useMyStatus() {
  const { user } = useAuth();
  const [myStatus, setMyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "personnelStatus", user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          setMyStatus({
            id: snapshot.id,
            ...snapshot.data(),
          });
        } else {
          setMyStatus({
            status: "present",
            personnelId: user.uid,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching my status:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  return { myStatus, loading, error };
}

/**
 * Hook to get status history for a specific personnel
 */
export function usePersonnelStatusHistory(personnelId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!personnelId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "personnelStatusHistory"),
      where("personnelId", "==", personnelId),
      orderBy("timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const historyData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setHistory(historyData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching status history:", err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [personnelId]);

  return { history, loading, error };
}

/**
 * Hook for admin personnel status update operations
 * Updates both personnelStatus and personnelStatusHistory in a batch
 */
export function usePersonnelStatusActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function updatePersonnelStatus(
    personnelId,
    statusData,
    personnelInfo = {},
  ) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Update current status
      const statusRef = doc(db, "personnelStatus", personnelId);
      batch.set(statusRef, {
        personnelId,
        status: statusData.status,
        destination: statusData.destination || null,
        expectedReturn: statusData.expectedReturn || null,
        contactNumber: statusData.contactNumber || null,
        notes: statusData.notes || null,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        updatedAt: serverTimestamp(),
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId,
        personnelName:
          personnelInfo.name ||
          `${personnelInfo.firstName || ""} ${personnelInfo.lastName || ""}`.trim(),
        personnelRank: personnelInfo.rank || null,
        status: statusData.status,
        previousStatus: statusData.previousStatus || null,
        destination: statusData.destination || null,
        expectedReturn: statusData.expectedReturn || null,
        contactNumber: statusData.contactNumber || null,
        notes: statusData.notes || null,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        shiftId: statusData.shiftId || null,
      });

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error updating personnel status:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Bulk sign in multiple personnel at once
   * @param {Array} personnelList - Array of personnel objects with id, firstName, lastName, rank, status
   */
  async function bulkSignIn(personnelList) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      for (const person of personnelList) {
        // Determine the correct status document ID
        // Could be person.id (personnel doc ID) or stored in statusDetails
        const statusId = person.statusDetails?.personnelId || person.id;

        // Update current status to present
        const statusRef = doc(db, "personnelStatus", statusId);
        batch.set(statusRef, {
          personnelId: statusId,
          status: "present",
          destination: null,
          expectedReturn: null,
          contactNumber: null,
          notes: null,
          companions: null,
          withPersonId: null,
          withPersonName: null,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          updatedAt: serverTimestamp(),
          adminSignIn: true,
        });

        // Add to history
        const historyRef = doc(collection(db, "personnelStatusHistory"));
        batch.set(historyRef, {
          personnelId: statusId,
          personnelName: `${person.firstName} ${person.lastName}`.trim(),
          personnelRank: person.rank || null,
          status: "present",
          previousStatus: person.status || "pass",
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          timestamp: serverTimestamp(),
          adminSignIn: true,
        });
      }

      await batch.commit();
      setLoading(false);
      return { success: true, count: personnelList.length };
    } catch (err) {
      console.error("Error bulk signing in:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    updatePersonnelStatus,
    bulkSignIn,
    loading,
    error,
  };
}

/**
 * Hook for self sign-out/sign-in (any authenticated user for their own status)
 */
export function useSelfSignOut() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function signOut(signOutData) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);
      const companions = signOutData.companions || [];

      // Get current status for history
      const currentStatusDoc = await getDoc(
        doc(db, "personnelStatus", user.uid),
      );
      const previousStatus = currentStatusDoc.exists()
        ? currentStatusDoc.data().status
        : "present";

      // Update current status to pass with initial stage
      const statusRef = doc(db, "personnelStatus", user.uid);
      batch.set(statusRef, {
        personnelId: user.uid,
        status: "pass",
        passStage: "enroute_to", // Initial stage when signing out
        timeOut: signOutData.timeOut || new Date().toISOString(),
        destination: signOutData.destination || null,
        expectedReturn: signOutData.expectedReturn || null,
        contactNumber: signOutData.contactNumber || null,
        notes: signOutData.notes || null,
        companions,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        userEmail: user.email, // Store email for matching unlinked personnel
        updatedAt: serverTimestamp(),
        selfUpdated: true,
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        status: "pass",
        passStage: "enroute_to",
        previousStatus,
        action: "sign_out",
        timeOut: signOutData.timeOut || new Date().toISOString(),
        destination: signOutData.destination || null,
        expectedReturn: signOutData.expectedReturn || null,
        contactNumber: signOutData.contactNumber || null,
        notes: signOutData.notes || null,
        companions,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        selfUpdated: true,
      });

      // Also mark companions as on pass
      const timeOut = signOutData.timeOut || new Date().toISOString();
      for (const companion of companions) {
        const companionStatusRef = doc(db, "personnelStatus", companion.id);
        batch.set(companionStatusRef, {
          personnelId: companion.id,
          status: "pass",
          timeOut,
          destination: signOutData.destination || null,
          expectedReturn: signOutData.expectedReturn || null,
          contactNumber: signOutData.contactNumber || null, // Use primary person's contact
          notes: `With ${user.displayName || user.email}`,
          withPersonId: user.uid,
          withPersonName: user.displayName || user.email,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          updatedAt: serverTimestamp(),
          groupSignOut: true,
        });

        // Add companion history entry
        const companionHistoryRef = doc(
          collection(db, "personnelStatusHistory"),
        );
        batch.set(companionHistoryRef, {
          personnelId: companion.id,
          personnelName: companion.name,
          personnelRank: companion.rank || null,
          status: "pass",
          previousStatus: "present",
          timeOut,
          destination: signOutData.destination || null,
          expectedReturn: signOutData.expectedReturn || null,
          notes: `Group sign-out with ${user.displayName || user.email}`,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          timestamp: serverTimestamp(),
          groupSignOut: true,
        });
      }

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error signing out:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Get current status for history
      const currentStatusDoc = await getDoc(
        doc(db, "personnelStatus", user.uid),
      );
      const currentData = currentStatusDoc.exists()
        ? currentStatusDoc.data()
        : {};
      const previousStatus = currentData.status || "pass";
      const previousStage = currentData.passStage || null;
      const companions = currentData.companions || [];

      // Update current status to present
      const statusRef = doc(db, "personnelStatus", user.uid);
      batch.set(statusRef, {
        personnelId: user.uid,
        status: "present",
        passStage: null,
        destination: null,
        expectedReturn: null,
        contactNumber: null,
        notes: null,
        companions: null,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        userEmail: user.email, // Store email for matching unlinked personnel
        updatedAt: serverTimestamp(),
        selfUpdated: true,
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        status: "present",
        previousStatus,
        previousStage,
        action: "arrived_barracks",
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        selfUpdated: true,
      });

      // Also sign in all companions
      for (const companion of companions) {
        const companionStatusRef = doc(db, "personnelStatus", companion.id);
        batch.set(companionStatusRef, {
          personnelId: companion.id,
          status: "present",
          passStage: null,
          destination: null,
          expectedReturn: null,
          contactNumber: null,
          notes: null,
          withPersonId: null,
          withPersonName: null,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          updatedAt: serverTimestamp(),
          groupSignIn: true,
        });

        // Add companion history entry
        const companionHistoryRef = doc(
          collection(db, "personnelStatusHistory"),
        );
        batch.set(companionHistoryRef, {
          personnelId: companion.id,
          personnelName: companion.name,
          personnelRank: companion.rank || null,
          status: "present",
          previousStatus: "pass",
          previousStage,
          action: "arrived_barracks",
          notes: `Group sign-in with ${user.displayName || user.email}`,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          timestamp: serverTimestamp(),
          groupSignIn: true,
        });
      }

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error signing in:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Update pass stage (enroute_to -> arrived -> enroute_back)
   * Also updates companions' stage
   */
  async function updateStage(newStage) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Get current status
      const currentStatusDoc = await getDoc(
        doc(db, "personnelStatus", user.uid),
      );
      if (!currentStatusDoc.exists()) {
        throw new Error("No status record found");
      }
      const currentData = currentStatusDoc.data();
      const previousStage = currentData.passStage || "enroute_to";
      const companions = currentData.companions || [];

      // Update status with new stage
      const statusRef = doc(db, "personnelStatus", user.uid);
      batch.update(statusRef, {
        passStage: newStage,
        updatedAt: serverTimestamp(),
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        status: "pass",
        passStage: newStage,
        previousStage: previousStage || null,
        destination: currentData.destination || null,
        timeOut: currentData.timeOut || null,
        action: `stage_${newStage}`,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        selfUpdated: true,
      });

      // Also update all companions' stage
      for (const companion of companions) {
        const companionStatusRef = doc(db, "personnelStatus", companion.id);
        batch.set(companionStatusRef, {
          personnelId: companion.id,
          status: "pass",
          passStage: newStage,
          destination: currentData.destination || null,
          expectedReturn: currentData.expectedReturn || null,
          contactNumber: currentData.contactNumber || null,
          withPersonId: user.uid,
          withPersonName: user.displayName || user.email,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          updatedAt: serverTimestamp(),
          groupUpdate: true,
        }, { merge: true });

        // Add companion history entry
        const companionHistoryRef = doc(
          collection(db, "personnelStatusHistory"),
        );
        batch.set(companionHistoryRef, {
          personnelId: companion.id,
          personnelName: companion.name,
          personnelRank: companion.rank || null,
          status: "pass",
          passStage: newStage,
          previousStage: previousStage || null,
          destination: currentData.destination || null,
          timeOut: currentData.timeOut || null,
          action: `stage_${newStage}`,
          notes: `Group update with ${user.displayName || user.email}`,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          timestamp: serverTimestamp(),
          groupUpdate: true,
        });
      }

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error updating stage:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Break free from a group - allows a companion to manage their own status
   * Removes the link to the primary person and removes self from their companions list
   */
  async function breakFree() {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Get current status
      const currentStatusDoc = await getDoc(
        doc(db, "personnelStatus", user.uid),
      );
      if (!currentStatusDoc.exists()) {
        throw new Error("No status record found");
      }
      const currentData = currentStatusDoc.data();
      const withPersonId = currentData.withPersonId;

      if (!withPersonId) {
        throw new Error("Not part of a group");
      }

      // Update own status - remove group link but keep pass status
      const statusRef = doc(db, "personnelStatus", user.uid);
      batch.update(statusRef, {
        withPersonId: null,
        withPersonName: null,
        groupSignOut: null,
        updatedAt: serverTimestamp(),
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        status: currentData.status,
        passStage: currentData.passStage || null,
        destination: currentData.destination || null,
        action: "break_free",
        notes: `Separated from group (was with ${currentData.withPersonName})`,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        selfUpdated: true,
      });

      // Remove self from the primary person's companions list
      const primaryStatusDoc = await getDoc(
        doc(db, "personnelStatus", withPersonId),
      );
      if (primaryStatusDoc.exists()) {
        const primaryData = primaryStatusDoc.data();
        const updatedCompanions = (primaryData.companions || []).filter(
          (c) => c.id !== user.uid,
        );
        const primaryStatusRef = doc(db, "personnelStatus", withPersonId);
        batch.update(primaryStatusRef, {
          companions: updatedCompanions,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error breaking free:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Sign out on sick call
   * @param {Object} sickCallData - { notes, contactNumber }
   */
  async function signOutSickCall(sickCallData = {}) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Get current status for history
      const currentStatusDoc = await getDoc(
        doc(db, "personnelStatus", user.uid),
      );
      const previousStatus = currentStatusDoc.exists()
        ? currentStatusDoc.data().status
        : "present";

      // Update current status to sick_call
      const statusRef = doc(db, "personnelStatus", user.uid);
      batch.set(statusRef, {
        personnelId: user.uid,
        status: "sick_call",
        timeOut: new Date().toISOString(),
        contactNumber: sickCallData.contactNumber || null,
        notes: sickCallData.notes || null,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
        selfUpdated: true,
      });

      // Add to history
      const historyRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(historyRef, {
        personnelId: user.uid,
        personnelName: user.displayName || user.email,
        status: "sick_call",
        previousStatus,
        action: "sick_call",
        timeOut: new Date().toISOString(),
        contactNumber: sickCallData.contactNumber || null,
        notes: sickCallData.notes || null,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        selfUpdated: true,
      });

      await batch.commit();
      setLoading(false);
    } catch (err) {
      console.error("Error signing out sick call:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    signOut,
    signIn,
    signOutSickCall,
    updateStage,
    breakFree,
    loading,
    error,
  };
}
