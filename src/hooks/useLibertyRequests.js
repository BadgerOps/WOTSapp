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
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Liberty request statuses
 */
export const LIBERTY_REQUEST_STATUS = {
  pending: { label: "Pending", color: "yellow" },
  approved: { label: "Approved", color: "green" },
  rejected: { label: "Rejected", color: "red" },
  cancelled: { label: "Cancelled", color: "gray" },
};

/**
 * Common liberty locations
 */
export const LIBERTY_LOCATIONS = [
  { value: "san_antonio", label: "San Antonio" },
  { value: "austin", label: "Austin" },
  { value: "local_area", label: "Local Area" },
  { value: "home", label: "Home (Family Visit)" },
  { value: "other", label: "Other" },
];

/**
 * Get the next upcoming weekend dates
 * Returns Saturday and Sunday of the target weekend
 */
export function getNextWeekendDates() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days until next Saturday
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;

  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  return { saturday, sunday };
}

/**
 * Check if today is before the deadline for liberty requests
 * @param {Object} config - App config with libertyDeadlineDayOfWeek and libertyDeadlineTime
 * @returns {boolean} True if current time is before the deadline
 */
export function isBeforeDeadline(config) {
  const deadlineDayOfWeek = config?.libertyDeadlineDayOfWeek ?? 2; // Default Tuesday
  const deadlineTime = config?.libertyDeadlineTime || '23:59';

  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.

  // Parse deadline time
  const [deadlineHour, deadlineMinute] = deadlineTime.split(':').map(Number);

  // If we're before the deadline day, we can still submit
  if (currentDayOfWeek < deadlineDayOfWeek) {
    return true;
  }

  // If we're on the deadline day, check the time
  if (currentDayOfWeek === deadlineDayOfWeek) {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour < deadlineHour) return true;
    if (currentHour === deadlineHour && currentMinute <= deadlineMinute) return true;
    return false;
  }

  // If we're after the deadline day (but still in the same week cycle)
  // For weekend submission: after deadline day means no submission
  return false;
}

/**
 * Get the deadline date for the current request period
 * @param {Object} config - App config with libertyDeadlineDayOfWeek and libertyDeadlineTime
 * @returns {Date} The deadline date/time
 */
export function getDeadlineDate(config) {
  const deadlineDayOfWeek = config?.libertyDeadlineDayOfWeek ?? 2; // Default Tuesday
  const deadlineTime = config?.libertyDeadlineTime || '23:59';

  const today = new Date();
  const currentDayOfWeek = today.getDay();

  // Calculate days until deadline day
  let daysUntilDeadline = (deadlineDayOfWeek - currentDayOfWeek + 7) % 7;

  // If we're past the deadline day, get next week's deadline
  if (currentDayOfWeek > deadlineDayOfWeek) {
    daysUntilDeadline = (deadlineDayOfWeek - currentDayOfWeek + 7) % 7 || 7;
  }

  const deadlineDate = new Date(today);
  deadlineDate.setDate(today.getDate() + daysUntilDeadline);

  // Parse and set deadline time
  const [deadlineHour, deadlineMinute] = deadlineTime.split(':').map(Number);
  deadlineDate.setHours(deadlineHour, deadlineMinute, 59, 999);

  return deadlineDate;
}

/**
 * Get the day name for the deadline
 * @param {number} dayOfWeek - Day of week (0-6)
 * @returns {string} Day name
 */
export function getDeadlineDayName(dayOfWeek) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek ?? 2];
}

/**
 * Hook to fetch pending liberty requests (for candidate leadership)
 */
export function usePendingLibertyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "libertyRequests"),
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
        console.error("Error fetching pending liberty requests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { requests, loading, error };
}

/**
 * Hook to fetch user's own liberty requests
 */
export function useMyLibertyRequests() {
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
      collection(db, "libertyRequests"),
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
        console.error("Error fetching my liberty requests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return { requests, loading, error };
}

/**
 * Hook for creating liberty requests
 */
export function useLibertyRequestActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Check for existing pending liberty request for the same weekend
   */
  async function checkForDuplicateRequest(weekendDate) {
    const q = query(
      collection(db, "libertyRequests"),
      where("requesterId", "==", user.uid),
      where("status", "==", "pending"),
      where("weekendDate", "==", weekendDate)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Create a new liberty request
   * @param {Object} requestData - Liberty request details
   * @param {string} requestData.location - Where they're going
   * @param {string} requestData.customLocation - Custom location if "other" selected
   * @param {string} requestData.departureDate - Departure date (ISO string)
   * @param {string} requestData.departureTime - Departure time
   * @param {string} requestData.returnDate - Return date (ISO string)
   * @param {string} requestData.returnTime - Return time
   * @param {string} requestData.contactNumber - Contact number while out
   * @param {string} requestData.purpose - Reason for liberty
   * @param {string} requestData.notes - Additional notes
   * @param {Array} requestData.companions - Array of companion objects {id, name, rank}
   * @param {string} requestData.weekendDate - The weekend this is for (Saturday date as ISO string)
   * @param {boolean} requestData.forceSubmit - If true, cancel existing and create new
   */
  async function createLibertyRequest(requestData) {
    setLoading(true);
    setError(null);
    try {
      const companions = requestData.companions || [];
      const weekendDate = requestData.weekendDate;

      // Check for existing pending request (unless forceSubmit is true)
      if (!requestData.forceSubmit) {
        const existingRequest = await checkForDuplicateRequest(weekendDate);
        if (existingRequest) {
          setLoading(false);
          return {
            success: false,
            isDuplicate: true,
            existingRequest,
            message: "You already have a pending liberty request for this weekend",
          };
        }
      } else {
        // Cancel any existing pending requests before creating new one
        const existingRequest = await checkForDuplicateRequest(weekendDate);
        if (existingRequest) {
          const requestRef = doc(db, "libertyRequests", existingRequest.id);
          await updateDoc(requestRef, {
            status: "cancelled",
            cancelledAt: serverTimestamp(),
            cancelledBy: user.uid,
            cancelledByName: user.displayName || user.email,
            cancelReason: "Replaced with new request",
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Build the destination string
      const destination = requestData.location === "other"
        ? requestData.customLocation
        : LIBERTY_LOCATIONS.find(l => l.value === requestData.location)?.label || requestData.location;

      // Create the main request
      const requestDoc = await addDoc(collection(db, "libertyRequests"), {
        requesterId: user.uid,
        requesterName: user.displayName || user.email,
        requesterEmail: user.email,
        location: requestData.location,
        destination,
        departureDate: requestData.departureDate || null,
        departureTime: requestData.departureTime || null,
        returnDate: requestData.returnDate || null,
        returnTime: requestData.returnTime || null,
        contactNumber: requestData.contactNumber || null,
        purpose: requestData.purpose || null,
        notes: requestData.notes || null,
        companions,
        weekendDate,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true, requestId: requestDoc.id };
    } catch (err) {
      console.error("Error creating liberty request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Cancel a pending liberty request (user can cancel their own)
   * @param {string} requestId
   */
  async function cancelLibertyRequest(requestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", requestId);
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
      console.error("Error cancelling liberty request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createLibertyRequest,
    cancelLibertyRequest,
    loading,
    error,
  };
}

/**
 * Hook for candidate leadership to approve/reject liberty requests
 */
export function useLibertyApprovalActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Approve a liberty request
   * @param {string} requestId - The liberty request ID
   */
  async function approveRequest(requestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      const request = requestDoc.data();

      if (request.status !== "pending") {
        throw new Error("Request is no longer pending");
      }

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

      await updateDoc(requestRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email,
        approverInitials,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error approving liberty request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Reject a liberty request
   * @param {string} requestId - The liberty request ID
   * @param {string} reason - Reason for rejection
   */
  async function rejectRequest(requestId, reason = "") {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", requestId);
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
      console.error("Error rejecting liberty request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Bulk approve multiple liberty requests
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
   * Bulk reject multiple liberty requests
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
 * Hook to get pending liberty request count (for badge display)
 */
export function usePendingLibertyRequestCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "libertyRequests"),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching pending liberty count:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { count, loading };
}
