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
 * Common liberty locations (multi-select supported)
 */
export const LIBERTY_LOCATIONS = [
  { value: "shoppette", label: "Shoppette" },
  { value: "bx_commissary", label: "BX/Commissary" },
  { value: "gym", label: "Gym" },
  { value: "library", label: "Library" },
  { value: "px", label: "PX" },
  { value: "dfac", label: "DFAC" },
  { value: "off_post", label: "Off Post" },
  { value: "other", label: "Other" },
];

/**
 * Build a human-readable destination string from selected locations
 * @param {Array<string>} locations - Array of location values
 * @param {string} customLocation - Custom location text if "other" is selected
 * @returns {string} Comma-separated destination string
 */
export function buildDestinationString(locations, customLocation) {
  if (!locations || locations.length === 0) return "";
  const labels = locations
    .map((loc) => {
      if (loc === "other") return customLocation || "Other";
      return LIBERTY_LOCATIONS.find((l) => l.value === loc)?.label || loc;
    })
    .filter(Boolean);
  return labels.join(", ");
}

/**
 * Build a summary destination string from all time slots
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string} customLocation - Custom location text if "other" is selected
 * @returns {string} Combined destination string
 */
export function buildTimeSlotsDestination(timeSlots, customLocation) {
  if (!timeSlots || timeSlots.length === 0) return "";
  const allLocations = new Set();
  timeSlots.forEach((slot) => {
    (slot.locations || []).forEach((loc) => allLocations.add(loc));
  });
  return buildDestinationString([...allLocations], customLocation);
}

/**
 * Generate a label for a time slot (e.g. "Sat Morning", "Sun Afternoon")
 * @param {Object} slot - Time slot object with date, startTime, endTime
 * @returns {string} Human-readable label
 */
export function getTimeSlotLabel(slot) {
  if (!slot || !slot.date) return "";
  const date = new Date(slot.date + "T00:00:00");
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  const startHour = slot.startTime ? parseInt(slot.startTime.split(":")[0], 10) : 0;
  let period = "";
  if (startHour < 12) period = "Morning";
  else if (startHour < 17) period = "Afternoon";
  else period = "Evening";
  return `${dayName} ${period}`;
}

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
 * Get the Saturday date string of the current or most recent weekend,
 * if today is Saturday, Sunday, or Monday (the day after the event ends).
 * Returns null on Tuesday-Friday when there is no active/recent weekend.
 * @returns {string|null} ISO date string (YYYY-MM-DD) of the Saturday, or null
 */
export function getCurrentWeekendDate() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 6=Sat

  let daysBack;
  if (dayOfWeek === 6) {
    daysBack = 0; // Saturday - this is the weekend
  } else if (dayOfWeek === 0) {
    daysBack = 1; // Sunday - Saturday was yesterday
  } else if (dayOfWeek === 1) {
    daysBack = 2; // Monday - day after event; Saturday was 2 days ago
  } else {
    return null; // Tue-Fri: no active/recent weekend to show
  }

  const saturday = new Date(today);
  saturday.setDate(today.getDate() - daysBack);
  saturday.setHours(0, 0, 0, 0);
  return saturday.toISOString().split('T')[0];
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
   * @param {Array<string>} requestData.locations - Array of selected location values (multi-select)
   * @param {string} requestData.location - Single location (legacy, converted to locations array)
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
   * @param {boolean} requestData.isDriver - Whether the requester is driving
   * @param {number} requestData.passengerCapacity - Number of available passenger seats (if driver)
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

      // Build time slots (new) or fallback to single departure/return (legacy)
      const timeSlots = requestData.timeSlots || [];

      // Derive aggregate locations and destination from time slots if available
      let locations, destination;
      if (timeSlots.length > 0) {
        // Initialize participants array on each slot
        timeSlots.forEach((slot) => {
          if (!slot.participants) slot.participants = [];
        });
        locations = [...new Set(timeSlots.flatMap((s) => s.locations || []))];
        destination = buildTimeSlotsDestination(timeSlots, requestData.customLocation);
      } else {
        locations = requestData.locations || (requestData.location ? [requestData.location] : []);
        destination = buildDestinationString(locations, requestData.customLocation);
      }

      // Create the main request
      const requestDoc = await addDoc(collection(db, "libertyRequests"), {
        requesterId: user.uid,
        requesterName: user.displayName || user.email,
        requesterEmail: user.email,
        locations,
        location: locations[0] || null, // Keep legacy field for backward compat
        destination,
        // Keep legacy single-window fields for backward compat
        departureDate: requestData.departureDate || (timeSlots[0]?.date || null),
        departureTime: requestData.departureTime || (timeSlots[0]?.startTime || null),
        returnDate: requestData.returnDate || (timeSlots[timeSlots.length - 1]?.date || null),
        returnTime: requestData.returnTime || (timeSlots[timeSlots.length - 1]?.endTime || null),
        contactNumber: requestData.contactNumber || null,
        purpose: requestData.purpose || null,
        notes: requestData.notes || null,
        companions,
        weekendDate,
        isDriver: requestData.isDriver || false,
        passengerCapacity: requestData.isDriver ? (requestData.passengerCapacity || 0) : 0,
        passengers: [], // Legacy - kept for backward compat
        timeSlots: timeSlots.length > 0 ? timeSlots : [],
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
   * Cancel a pending or approved liberty request
   * Users can cancel their own; admins/leave admins can cancel any
   * @param {string} requestId
   * @param {Object} options
   * @param {boolean} options.isAdmin - If true, skip ownership check (for admin/leave admin users)
   * @param {string} options.reason - Optional cancellation reason
   */
  async function cancelLibertyRequest(requestId, { isAdmin: isAdminUser = false, reason = "" } = {}) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      const data = requestDoc.data();

      if (!isAdminUser && data.requesterId !== user.uid) {
        throw new Error("You can only cancel your own requests");
      }

      if (data.status !== "pending" && data.status !== "approved") {
        throw new Error("Can only cancel pending or approved requests");
      }

      await updateDoc(requestRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: user.uid,
        cancelledByName: user.displayName || user.email,
        cancelReason: reason || null,
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

  /**
   * Update an existing liberty request (edit fields, time slots, etc.)
   * Allowed on pending or approved requests only.
   * Users can edit their own; admins/leave admins can edit any.
   * @param {string} requestId - The request to update
   * @param {Object} requestData - Updated request fields
   * @param {Object} options
   * @param {boolean} options.isAdmin - If true, skip ownership check
   */
  async function updateLibertyRequest(requestId, requestData, { isAdmin: isAdminUser = false } = {}) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      const data = requestDoc.data();

      if (!isAdminUser && data.requesterId !== user.uid) {
        throw new Error("You can only edit your own requests");
      }

      if (data.status !== "pending" && data.status !== "approved") {
        throw new Error("Can only edit pending or approved requests");
      }

      // Build time slots or fallback
      const timeSlots = requestData.timeSlots || [];

      let locations, destination;
      if (timeSlots.length > 0) {
        timeSlots.forEach((slot) => {
          if (!slot.participants) slot.participants = [];
        });
        locations = [...new Set(timeSlots.flatMap((s) => s.locations || []))];
        destination = buildTimeSlotsDestination(timeSlots, requestData.customLocation);
      } else {
        locations = requestData.locations || (requestData.location ? [requestData.location] : []);
        destination = buildDestinationString(locations, requestData.customLocation);
      }

      const updateData = {
        locations,
        location: locations[0] || null,
        destination,
        departureDate: requestData.departureDate || (timeSlots[0]?.date || null),
        departureTime: requestData.departureTime || (timeSlots[0]?.startTime || null),
        returnDate: requestData.returnDate || (timeSlots[timeSlots.length - 1]?.date || null),
        returnTime: requestData.returnTime || (timeSlots[timeSlots.length - 1]?.endTime || null),
        contactNumber: requestData.contactNumber || null,
        purpose: requestData.purpose || null,
        notes: requestData.notes || null,
        companions: requestData.companions || [],
        isDriver: requestData.isDriver || false,
        passengerCapacity: requestData.isDriver ? (requestData.passengerCapacity || 0) : 0,
        timeSlots: timeSlots.length > 0 ? timeSlots : [],
        customLocation: requestData.customLocation || null,
        updatedAt: serverTimestamp(),
        lastEditedBy: user.uid,
        lastEditedByName: user.displayName || user.email,
        lastEditedAt: serverTimestamp(),
      };

      await updateDoc(requestRef, updateData);

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error updating liberty request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createLibertyRequest,
    cancelLibertyRequest,
    updateLibertyRequest,
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
 * Hook for leave admins to create liberty requests on behalf of other users
 */
export function useLeaveAdminActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Create a liberty request on behalf of another user
   * @param {Object} requestData - Liberty request details
   * @param {string} requestData.targetUserId - The user ID to create the request for
   * @param {string} requestData.targetUserName - The user's display name
   * @param {string} requestData.targetUserEmail - The user's email
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
   * @param {string} requestData.status - Optional status (pending or approved), defaults to approved
   */
  async function createLibertyRequestForUser(requestData) {
    setLoading(true);
    setError(null);
    try {
      const companions = requestData.companions || [];

      // Build time slots (new) or fallback to single departure/return (legacy)
      const timeSlots = requestData.timeSlots || [];

      let locations, destination;
      if (timeSlots.length > 0) {
        timeSlots.forEach((slot) => {
          if (!slot.participants) slot.participants = [];
        });
        locations = [...new Set(timeSlots.flatMap((s) => s.locations || []))];
        destination = buildTimeSlotsDestination(timeSlots, requestData.customLocation);
      } else {
        locations = requestData.locations || (requestData.location ? [requestData.location] : []);
        destination = buildDestinationString(locations, requestData.customLocation);
      }

      // Get admin's initials for approval tracking
      const personnelQuery = await getDoc(doc(db, "personnel", user.uid));
      let adminInitials = "";
      let adminFirstName = "";
      let adminLastName = "";

      if (personnelQuery.exists()) {
        const personnelData = personnelQuery.data();
        adminFirstName = personnelData.firstName || "";
        adminLastName = personnelData.lastName || "";
      }

      if (!adminFirstName && !adminLastName && user.displayName) {
        const nameParts = user.displayName.split(" ");
        adminFirstName = nameParts[0] || "";
        adminLastName = nameParts.slice(1).join(" ") || "";
      }

      adminInitials = (adminFirstName.charAt(0) + adminLastName.charAt(0)).toUpperCase();

      const status = requestData.status || "approved";
      const isApproved = status === "approved";

      // Create the request
      const docData = {
        requesterId: requestData.targetUserId,
        requesterName: requestData.targetUserName,
        requesterEmail: requestData.targetUserEmail,
        locations,
        location: locations[0] || null, // Keep legacy field for backward compat
        destination,
        departureDate: requestData.departureDate || (timeSlots[0]?.date || null),
        departureTime: requestData.departureTime || (timeSlots[0]?.startTime || null),
        returnDate: requestData.returnDate || (timeSlots[timeSlots.length - 1]?.date || null),
        returnTime: requestData.returnTime || (timeSlots[timeSlots.length - 1]?.endTime || null),
        contactNumber: requestData.contactNumber || null,
        purpose: requestData.purpose || null,
        notes: requestData.notes || null,
        companions,
        weekendDate: requestData.weekendDate,
        isDriver: requestData.isDriver || false,
        passengerCapacity: requestData.isDriver ? (requestData.passengerCapacity || 0) : 0,
        passengers: [],
        timeSlots: timeSlots.length > 0 ? timeSlots : [],
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Track that this was created on behalf of the user
        createdOnBehalfOf: true,
        createdByAdminId: user.uid,
        createdByAdminName: user.displayName || user.email,
      };

      // If auto-approved, add approval info
      if (isApproved) {
        docData.approvedAt = serverTimestamp();
        docData.approvedBy = user.uid;
        docData.approvedByName = user.displayName || user.email;
        docData.approverInitials = adminInitials;
      }

      const requestDoc = await addDoc(collection(db, "libertyRequests"), docData);

      setLoading(false);
      return { success: true, requestId: requestDoc.id };
    } catch (err) {
      console.error("Error creating liberty request for user:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    createLibertyRequestForUser,
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

/**
 * Hook to fetch all liberty requests (for admin view)
 * @param {string} filterStatus - Optional status filter (pending, approved, rejected, cancelled)
 * @param {string} filterWeekend - Optional weekend date filter (ISO date string)
 */
export function useAllLibertyRequests(filterStatus = null, filterWeekend = null) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let q = query(
      collection(db, "libertyRequests"),
      orderBy("createdAt", "desc")
    );

    // Note: Firestore doesn't support multiple inequality filters,
    // so we filter in memory for complex queries

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Apply filters in memory
        if (filterStatus) {
          data = data.filter((r) => r.status === filterStatus);
        }
        if (filterWeekend) {
          data = data.filter((r) => r.weekendDate === filterWeekend);
        }

        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching all liberty requests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [filterStatus, filterWeekend]);

  return { requests, loading, error };
}

/**
 * Hook to fetch available liberty requests for the relevant weekend.
 * On Sat/Sun/Mon shows the current/just-passed weekend so cards remain
 * visible until the day after the event. On Tue-Fri shows the upcoming weekend.
 * This is publicly visible to all authenticated users.
 */
export function useAvailableLibertyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { saturday } = getNextWeekendDates();
  const nextWeekendDate = saturday.toISOString().split('T')[0];
  const currentWeekendDate = getCurrentWeekendDate();
  // On Sat/Sun/Mon show the current weekend; otherwise show the upcoming one
  const weekendDate = currentWeekendDate || nextWeekendDate;

  useEffect(() => {
    // We need two queries since Firestore doesn't support OR in where clauses
    // Query for pending requests for this weekend
    const pendingQuery = query(
      collection(db, "libertyRequests"),
      where("weekendDate", "==", weekendDate),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    // Query for approved requests for this weekend
    const approvedQuery = query(
      collection(db, "libertyRequests"),
      where("weekendDate", "==", weekendDate),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc")
    );

    let pendingData = [];
    let approvedData = [];
    let pendingDone = false;
    let approvedDone = false;

    function mergeAndSet() {
      if (!pendingDone || !approvedDone) return;
      // Combine and sort by createdAt desc
      const all = [...pendingData, ...approvedData].sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setRequests(all);
      setLoading(false);
    }

    const unsubPending = onSnapshot(
      pendingQuery,
      (snapshot) => {
        pendingData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        pendingDone = true;
        mergeAndSet();
      },
      (err) => {
        console.error("Error fetching pending liberty requests:", err);
        setError(err.message);
        pendingDone = true;
        mergeAndSet();
      }
    );

    const unsubApproved = onSnapshot(
      approvedQuery,
      (snapshot) => {
        approvedData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        approvedDone = true;
        mergeAndSet();
      },
      (err) => {
        console.error("Error fetching approved liberty requests:", err);
        setError(err.message);
        approvedDone = true;
        mergeAndSet();
      }
    );

    return () => {
      unsubPending();
      unsubApproved();
    };
  }, [weekendDate]);

  return { requests, loading, error, weekendDate };
}

/**
 * @deprecated Use useAvailableLibertyRequests instead
 */
export function useApprovedLibertyRequests() {
  return useAvailableLibertyRequests();
}

/**
 * Hook for managing join requests on liberty groups
 */
export function useLibertyJoinActions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Request to join an existing approved liberty group
   * @param {string} libertyRequestId - The liberty request to join
   */
  async function requestToJoin(libertyRequestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();

      if (requestData.status !== "approved" && requestData.status !== "pending") {
        throw new Error("Can only join pending or approved liberty groups");
      }

      // Check if user already requested to join
      const existingJoinRequests = requestData.joinRequests || [];
      const existingRequest = existingJoinRequests.find(
        (jr) => jr.userId === user.uid
      );
      if (existingRequest) {
        throw new Error("You have already requested to join this group");
      }

      // Check if user is the original requester
      if (requestData.requesterId === user.uid) {
        throw new Error("You cannot join your own liberty group");
      }

      // Check if user is already a companion
      const isCompanion = (requestData.companions || []).some(
        (c) => c.id === user.uid
      );
      if (isCompanion) {
        throw new Error("You are already in this group");
      }

      // Get user's personnel record for rank
      const personnelDoc = await getDoc(doc(db, "personnel", user.uid));
      let userRank = "";
      let firstName = "";
      let lastName = "";

      if (personnelDoc.exists()) {
        const personnelData = personnelDoc.data();
        userRank = personnelData.rank || "";
        firstName = personnelData.firstName || "";
        lastName = personnelData.lastName || "";
      }

      const displayName = firstName && lastName
        ? `${firstName} ${lastName}`
        : user.displayName || user.email;

      // Add join request
      const newJoinRequest = {
        userId: user.uid,
        userName: displayName,
        userRank,
        requestedAt: new Date(),
        status: "pending",
      };

      await updateDoc(requestRef, {
        joinRequests: [...existingJoinRequests, newJoinRequest],
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error requesting to join liberty group:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Approve a join request (by liberty request owner or leadership)
   * @param {string} libertyRequestId - The liberty request
   * @param {string} joiningUserId - The user requesting to join
   */
  async function approveJoinRequest(libertyRequestId, joiningUserId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const joinRequests = requestData.joinRequests || [];
      const companions = requestData.companions || [];

      const joinRequestIndex = joinRequests.findIndex(
        (jr) => jr.userId === joiningUserId
      );

      if (joinRequestIndex === -1) {
        throw new Error("Join request not found");
      }

      const joinRequest = joinRequests[joinRequestIndex];

      if (joinRequest.status !== "pending") {
        throw new Error("Join request has already been processed");
      }

      // Update the join request status
      joinRequests[joinRequestIndex] = {
        ...joinRequest,
        status: "approved",
        respondedAt: new Date(),
        respondedBy: user.uid,
        respondedByName: user.displayName || user.email,
      };

      // Add to companions list
      const newCompanion = {
        id: joinRequest.userId,
        name: joinRequest.userName,
        rank: joinRequest.userRank || "",
        joinedViaRequest: true,
      };

      await updateDoc(requestRef, {
        joinRequests,
        companions: [...companions, newCompanion],
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error approving join request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Reject a join request
   * @param {string} libertyRequestId - The liberty request
   * @param {string} joiningUserId - The user requesting to join
   * @param {string} reason - Optional rejection reason
   */
  async function rejectJoinRequest(libertyRequestId, joiningUserId, reason = "") {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const joinRequests = requestData.joinRequests || [];

      const joinRequestIndex = joinRequests.findIndex(
        (jr) => jr.userId === joiningUserId
      );

      if (joinRequestIndex === -1) {
        throw new Error("Join request not found");
      }

      if (joinRequests[joinRequestIndex].status !== "pending") {
        throw new Error("Join request has already been processed");
      }

      // Update the join request status
      joinRequests[joinRequestIndex] = {
        ...joinRequests[joinRequestIndex],
        status: "rejected",
        rejectionReason: reason || null,
        respondedAt: new Date(),
        respondedBy: user.uid,
        respondedByName: user.displayName || user.email,
      };

      await updateDoc(requestRef, {
        joinRequests,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error rejecting join request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Cancel a pending join request (by the requester)
   * @param {string} libertyRequestId - The liberty request
   */
  async function cancelJoinRequest(libertyRequestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const joinRequests = requestData.joinRequests || [];

      const joinRequestIndex = joinRequests.findIndex(
        (jr) => jr.userId === user.uid && jr.status === "pending"
      );

      if (joinRequestIndex === -1) {
        throw new Error("No pending join request found");
      }

      // Remove the join request
      joinRequests.splice(joinRequestIndex, 1);

      await updateDoc(requestRef, {
        joinRequests,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error cancelling join request:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Sign up as a passenger with a driver
   * @param {string} libertyRequestId - The liberty request with a driver
   */
  async function signUpAsPassenger(libertyRequestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();

      if (!requestData.isDriver) {
        throw new Error("This person is not offering a ride");
      }

      if (requestData.requesterId === user.uid) {
        throw new Error("You cannot sign up as a passenger on your own request");
      }

      const passengers = requestData.passengers || [];
      const alreadyPassenger = passengers.some((p) => p.id === user.uid);
      if (alreadyPassenger) {
        throw new Error("You are already signed up as a passenger");
      }

      if (passengers.length >= (requestData.passengerCapacity || 0)) {
        throw new Error("No available seats");
      }

      // Get user's personnel record for rank/name
      const personnelDoc = await getDoc(doc(db, "personnel", user.uid));
      let userRank = "";
      let firstName = "";
      let lastName = "";

      if (personnelDoc.exists()) {
        const personnelData = personnelDoc.data();
        userRank = personnelData.rank || "";
        firstName = personnelData.firstName || "";
        lastName = personnelData.lastName || "";
      }

      const displayName = firstName && lastName
        ? `${firstName} ${lastName}`
        : user.displayName || user.email;

      const newPassenger = {
        id: user.uid,
        name: displayName,
        rank: userRank,
        signedUpAt: new Date(),
      };

      await updateDoc(requestRef, {
        passengers: [...passengers, newPassenger],
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error signing up as passenger:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Remove yourself as a passenger
   * @param {string} libertyRequestId - The liberty request
   */
  async function cancelPassengerSignUp(libertyRequestId) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const passengers = requestData.passengers || [];

      const updatedPassengers = passengers.filter((p) => p.id !== user.uid);

      if (updatedPassengers.length === passengers.length) {
        throw new Error("You are not signed up as a passenger");
      }

      await updateDoc(requestRef, {
        passengers: updatedPassengers,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error cancelling passenger sign-up:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Join a specific time slot on a liberty request (replaces separate join/passenger concepts)
   * @param {string} libertyRequestId - The liberty request
   * @param {number} slotIndex - Index of the time slot to join
   */
  async function joinTimeSlot(libertyRequestId, slotIndex) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const timeSlots = requestData.timeSlots || [];

      if (slotIndex < 0 || slotIndex >= timeSlots.length) {
        throw new Error("Invalid time slot");
      }

      if (requestData.requesterId === user.uid) {
        throw new Error("You cannot join your own liberty request");
      }

      const slot = timeSlots[slotIndex];
      const participants = slot.participants || [];

      if (participants.some((p) => p.id === user.uid)) {
        throw new Error("You are already in this time slot");
      }

      // Check driver capacity if applicable
      if (requestData.isDriver) {
        const passengerCapacity = requestData.passengerCapacity || 0;
        if (participants.length >= passengerCapacity) {
          throw new Error("No available seats for this time slot");
        }
      }

      // Get user info from personnel record
      const personnelDoc = await getDoc(doc(db, "personnel", user.uid));
      let userRank = "";
      let firstName = "";
      let lastName = "";

      if (personnelDoc.exists()) {
        const personnelData = personnelDoc.data();
        userRank = personnelData.rank || "";
        firstName = personnelData.firstName || "";
        lastName = personnelData.lastName || "";
      }

      const displayName = firstName && lastName
        ? `${firstName} ${lastName}`
        : user.displayName || user.email;

      // Add participant to the slot
      timeSlots[slotIndex] = {
        ...slot,
        participants: [
          ...participants,
          {
            id: user.uid,
            name: displayName,
            rank: userRank,
            joinedAt: new Date(),
          },
        ],
      };

      await updateDoc(requestRef, {
        timeSlots,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error joining time slot:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  /**
   * Leave a specific time slot on a liberty request
   * @param {string} libertyRequestId - The liberty request
   * @param {number} slotIndex - Index of the time slot to leave
   */
  async function leaveTimeSlot(libertyRequestId, slotIndex) {
    setLoading(true);
    setError(null);
    try {
      const requestRef = doc(db, "libertyRequests", libertyRequestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error("Liberty request not found");
      }

      const requestData = requestDoc.data();
      const timeSlots = requestData.timeSlots || [];

      if (slotIndex < 0 || slotIndex >= timeSlots.length) {
        throw new Error("Invalid time slot");
      }

      const slot = timeSlots[slotIndex];
      const participants = slot.participants || [];
      const updatedParticipants = participants.filter((p) => p.id !== user.uid);

      if (updatedParticipants.length === participants.length) {
        throw new Error("You are not in this time slot");
      }

      timeSlots[slotIndex] = {
        ...slot,
        participants: updatedParticipants,
      };

      await updateDoc(requestRef, {
        timeSlots,
        updatedAt: serverTimestamp(),
      });

      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error("Error leaving time slot:", err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }

  return {
    requestToJoin,
    approveJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
    signUpAsPassenger,
    cancelPassengerSignUp,
    joinTimeSlot,
    leaveTimeSlot,
    loading,
    error,
  };
}
