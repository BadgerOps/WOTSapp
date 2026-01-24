import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Pass approval request statuses
 */
export const PASS_REQUEST_STATUS = {
  pending: { label: "Pending", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Rejected", color: "red" },
  expired: { label: "Expired", color: "gray" },
};

/**
 * Hook to fetch pending pass approval requests (for candidate leadership)
 */
export function usePendingPassRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "passApprovalRequests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching pending pass requests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { requests, loading, error };
}

/**
 * Hook to fetch user's own pass requests
 */
export function useMyPassRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "passApprovalRequests"),
      where("requesterId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching my pass requests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { requests, loading, error };
}

/**
 * Hook for creating pass approval requests
 */
export function usePassRequestActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Create a new pass approval request
   * @param {Object} requestData - Pass request details
   * @param {string} requestData.destination - Where they're going
   * @param {string} requestData.expectedReturn - Expected return time (ISO string)
   * @param {string} requestData.contactNumber - Contact number while out
   * @param {string} requestData.notes - Additional notes
   * @param {Array} requestData.companions - Array of companion objects {id, name, rank}
   */
  async function createPassRequest(requestData) {
    setLoading(true);
    setError(null);
    try {
      const companions = requestData.companions || [];

      // Create the main request
      const requestDoc = await addDoc(collection(db, "passApprovalRequests"), {
        requesterId: user.uid,
        requesterName: user.displayName || user.email,
        requesterEmail: user.email,
        destination: requestData.destination || null,
        expectedReturn: requestData.expectedReturn || null,
        contactNumber: requestData.contactNumber || null,
        notes: requestData.notes || null,
        companions,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true, requestId: requestDoc.id };
    } catch (err) {
      console.error("Error creating pass request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Cancel a pending pass request (user can cancel their own)
   * @param {string} requestId
   */
  async function cancelPassRequest(requestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "passApprovalRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      if (requestDoc.data().requesterId !== user.uid) {
        throw new Error("You can only cancel your own requests");
      }

      if (requestDoc.data().status !== "pending") {
        throw new Error("Can only cancel pending requests");
      }

      await updateDoc(requestRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: user.uid,
        cancelledByName: user.displayName || user.email,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error cancelling pass request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createPassRequest,
    cancelPassRequest,
    loading,
    error,
  };
}

/**
 * Hook for candidate leadership to approve/reject pass requests
 */
export function usePassApprovalActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Approve a pass request and sign out the personnel
   * @param {string} requestId - The pass request ID
   */
  async function approveRequest(requestId) {
    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(db);

      // Get the request
      const requestRef = doc(db, "passApprovalRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      const request = requestDoc.data();

      if (request.status !== "pending") {
        throw new Error("Request is no longer pending");
      }

      const timeOut = new Date().toISOString();
      const companions = request.companions || [];

      // Get approver's initials from their personnel record
      const personnelQuery = await getDoc(doc(db, "personnel", user.uid));
      let approverInitials = "";
      let approverFirstName = "";
      let approverLastName = "";

      if (personnelQuery.exists()) {
        const personnelData = personnelQuery.data();
        approverFirstName = personnelData.firstName || "";
        approverLastName = personnelData.lastName || "";
      }

      // Fallback to display name if no personnel record
      if (!approverFirstName && !approverLastName && user.displayName) {
        const nameParts = user.displayName.split(" ");
        approverFirstName = nameParts[0] || "";
        approverLastName = nameParts.slice(1).join(" ") || "";
      }

      approverInitials = (approverFirstName.charAt(0) + approverLastName.charAt(0)).toUpperCase();

      // Update the request status
      batch.update(requestRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        approverInitials,
        updatedAt: serverTimestamp(),
      });

      // Create personnel status for the requester
      const requesterStatusRef = doc(db, "personnelStatus", request.requesterId);
      batch.set(requesterStatusRef, {
        personnelId: request.requesterId,
        status: "pass",
        passStage: "enroute_to",
        timeOut,
        destination: request.destination || null,
        expectedReturn: request.expectedReturn || null,
        contactNumber: request.contactNumber || null,
        notes: request.notes || null,
        companions,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        userEmail: request.requesterEmail,
        updatedAt: serverTimestamp(),
        passApprovalRequestId: requestId,
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        approverInitials,
      });

      // Create history entry for requester
      const requesterHistoryRef = doc(collection(db, "personnelStatusHistory"));
      batch.set(requesterHistoryRef, {
        personnelId: request.requesterId,
        personnelName: request.requesterName,
        status: "pass",
        passStage: "enroute_to",
        previousStatus: "present",
        action: "sign_out",
        timeOut,
        destination: request.destination || null,
        expectedReturn: request.expectedReturn || null,
        contactNumber: request.contactNumber || null,
        notes: request.notes || null,
        companions,
        updatedBy: user.uid,
        updatedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        passApprovalRequestId: requestId,
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        approverInitials,
      });

      // Also sign out companions
      for (const companion of companions) {
        const companionStatusRef = doc(db, "personnelStatus", companion.id);
        batch.set(companionStatusRef, {
          personnelId: companion.id,
          status: "pass",
          passStage: "enroute_to",
          timeOut,
          destination: request.destination || null,
          expectedReturn: request.expectedReturn || null,
          contactNumber: request.contactNumber || null,
          notes: `With ${request.requesterName}`,
          withPersonId: request.requesterId,
          withPersonName: request.requesterName,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          updatedAt: serverTimestamp(),
          passApprovalRequestId: requestId,
          approvedBy: user.uid,
          approvedByName: user.displayName || user.email,
          approverInitials,
          groupSignOut: true,
        });

        // Create history entry for companion
        const companionHistoryRef = doc(collection(db, "personnelStatusHistory"));
        batch.set(companionHistoryRef, {
          personnelId: companion.id,
          personnelName: companion.name,
          personnelRank: companion.rank || null,
          status: "pass",
          passStage: "enroute_to",
          previousStatus: "present",
          action: "sign_out",
          timeOut,
          destination: request.destination || null,
          expectedReturn: request.expectedReturn || null,
          notes: `Group sign-out with ${request.requesterName}`,
          updatedBy: user.uid,
          updatedByName: user.displayName || user.email,
          timestamp: serverTimestamp(),
          passApprovalRequestId: requestId,
          approvedBy: user.uid,
          approvedByName: user.displayName || user.email,
          approverInitials,
          groupSignOut: true,
        });
      }

      await batch.commit();
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error approving pass request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Reject a pass request
   * @param {string} requestId - The pass request ID
   * @param {string} reason - Reason for rejection
   */
  async function rejectRequest(requestId, reason = "") {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "passApprovalRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      if (requestDoc.data().status !== "pending") {
        throw new Error("Request is no longer pending");
      }

      await updateDoc(requestRef, {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid,
        rejectedByName: user.displayName || user.email,
        rejectionReason: reason || null,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error rejecting pass request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Bulk approve multiple pass requests
   * @param {Array<string>} requestIds - Array of request IDs to approve
   */
  async function bulkApprove(requestIds) {
    setLoading(true);
    setError(null);

    const results = [];
    for (const requestId of requestIds) {
      try {
        await approveRequest(requestId);
        results.push({ requestId, success: true });
      } catch (err) {
        results.push({ requestId, success: false, error: err.message });
      }
    }

    setLoading(false);
    return results;
  }

  /**
   * Bulk reject multiple pass requests
   * @param {Array<string>} requestIds - Array of request IDs to reject
   * @param {string} reason - Reason for rejection
   */
  async function bulkReject(requestIds, reason = "") {
    setLoading(true);
    setError(null);

    const results = [];
    for (const requestId of requestIds) {
      try {
        await rejectRequest(requestId, reason);
        results.push({ requestId, success: true });
      } catch (err) {
        results.push({ requestId, success: false, error: err.message });
      }
    }

    setLoading(false);
    return results;
  }

  return {
    approveRequest,
    rejectRequest,
    bulkApprove,
    bulkReject,
    loading,
    error,
  };
}

/**
 * Hook to get pending pass request count (for badge display)
 */
export function usePendingPassRequestCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "passApprovalRequests"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching pending count:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { count, loading };
}
