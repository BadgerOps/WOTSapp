import { useState, useMemo, useEffect } from "react";
import {
  useMyLibertyRequests,
  useLibertyRequestActions,
  LIBERTY_REQUEST_STATUS,
  LIBERTY_LOCATIONS,
  buildDestinationString,
  buildTimeSlotsDestination,
  getTimeSlotLabel,
  getNextWeekendDates,
  isBeforeDeadline,
  getDeadlineDate,
  getDeadlineDayName,
} from "../../hooks/useLibertyRequests";
import { usePersonnel } from "../../hooks/usePersonnel";
import { useAuth } from "../../contexts/AuthContext";
import { useAppConfig } from "../../hooks/useAppConfig";
import Loading from "../common/Loading";

const EDITABLE_STATUSES = ["pending", "approved"];

export default function LibertyRequestForm() {
  const { user, isLeaveAdmin, isAdmin } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const {
    requests: myLibertyRequests,
    loading: requestsLoading,
  } = useMyLibertyRequests();
  const {
    createLibertyRequest,
    cancelLibertyRequest,
    updateLibertyRequest,
    loading: requestActionLoading,
    error: requestError,
  } = useLibertyRequestActions();
  const { personnel } = usePersonnel();

  const [showForm, setShowForm] = useState(false);
  const [customLocation, setCustomLocation] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [companions, setCompanions] = useState([]);
  const [companionSearch, setCompanionSearch] = useState("");
  const [showCompanionDropdown, setShowCompanionDropdown] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isDriver, setIsDriver] = useState(false);
  const [passengerCapacity, setPassengerCapacity] = useState(1);

  // Edit mode state
  const [editingRequest, setEditingRequest] = useState(null);

  // Time slots state - each slot: { date, startTime, endTime, locations: [] }
  const [timeSlots, setTimeSlots] = useState([]);

  // Get weekend dates
  const { saturday, sunday } = getNextWeekendDates();
  const weekendDateStr = saturday.toISOString().split("T")[0];
  const canSubmit = isBeforeDeadline(config);
  const deadline = getDeadlineDate(config);
  const deadlineDayName = getDeadlineDayName(config?.libertyDeadlineDayOfWeek);

  // Find current user's personnel record
  const myPersonnelRecord = useMemo(() => {
    if (!user || !personnel.length) return null;
    return personnel.find(
      (p) => p.userId === user.uid || p.email === user.email,
    );
  }, [user, personnel]);

  // Get pending liberty request for this weekend
  const pendingRequest = useMemo(() => {
    return myLibertyRequests.find(
      (r) => r.status === "pending" && r.weekendDate === weekendDateStr
    );
  }, [myLibertyRequests, weekendDateStr]);

  // Get approved liberty request for this weekend
  const approvedRequest = useMemo(() => {
    return myLibertyRequests.find(
      (r) => r.status === "approved" && r.weekendDate === weekendDateStr
    );
  }, [myLibertyRequests, weekendDateStr]);

  // Get most recent rejected request (within last 24 hours)
  const recentRejectedRequest = useMemo(() => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return myLibertyRequests.find((r) => {
      if (r.status !== "rejected") return false;
      if (r.weekendDate !== weekendDateStr) return false;
      const rejectedAt = r.rejectedAt?.toDate?.()?.getTime() || 0;
      return rejectedAt > oneDayAgo;
    });
  }, [myLibertyRequests, weekendDateStr]);

  // Auto-populate phone number from personnel record
  useEffect(() => {
    if (myPersonnelRecord?.phoneNumber && !contactNumber) {
      setContactNumber(myPersonnelRecord.phoneNumber);
    }
  }, [myPersonnelRecord]);

  // Set default time slot when form opens (not in edit mode - edit populates its own)
  useEffect(() => {
    if (showForm && !editingRequest && timeSlots.length === 0) {
      setTimeSlots([
        {
          date: saturday.toISOString().split("T")[0],
          startTime: "08:00",
          endTime: "12:00",
          locations: [],
        },
      ]);
    }
  }, [showForm, editingRequest, timeSlots.length, saturday]);

  // Filter personnel for companion search (exclude current user)
  const filteredPersonnel = useMemo(() => {
    if (!companionSearch.trim()) return [];
    const search = companionSearch.toLowerCase();
    return personnel
      .filter((p) => {
        if (p.userId === user?.uid || p.email === user?.email) return false;
        if (companions.some((c) => c.id === p.id)) return false;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        const reverseName = `${p.lastName} ${p.firstName}`.toLowerCase();
        return fullName.includes(search) || reverseName.includes(search);
      })
      .slice(0, 5);
  }, [companionSearch, personnel, companions, user]);

  if (requestsLoading || configLoading) return <Loading />;

  const loading = requestActionLoading;
  const error = requestError;

  function getDestination() {
    return buildTimeSlotsDestination(timeSlots, customLocation);
  }

  // Check if any slot has "other" selected
  const hasOtherLocation = timeSlots.some((slot) =>
    (slot.locations || []).includes("other")
  );

  function toggleSlotLocation(slotIndex, value) {
    setTimeSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== slotIndex) return slot;
        const locs = slot.locations || [];
        return {
          ...slot,
          locations: locs.includes(value)
            ? locs.filter((v) => v !== value)
            : [...locs, value],
        };
      })
    );
  }

  function updateSlotField(slotIndex, field, value) {
    setTimeSlots((prev) =>
      prev.map((slot, i) => (i === slotIndex ? { ...slot, [field]: value } : slot))
    );
  }

  function addTimeSlot() {
    // Default to next logical slot
    const lastSlot = timeSlots[timeSlots.length - 1];
    const newDate = lastSlot?.date || saturday.toISOString().split("T")[0];
    const lastEndHour = lastSlot?.endTime ? parseInt(lastSlot.endTime.split(":")[0], 10) : 12;
    const newStart = lastEndHour < 17 ? `${String(lastEndHour + 1).padStart(2, "0")}:00` : "08:00";
    const newEnd = lastEndHour < 13 ? "17:00" : "20:00";
    // If last slot was afternoon or evening, bump to next day
    const useNextDay = lastEndHour >= 17;
    let nextDate = newDate;
    if (useNextDay) {
      const d = new Date(newDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split("T")[0];
    }
    setTimeSlots((prev) => [
      ...prev,
      { date: nextDate, startTime: useNextDay ? "08:00" : newStart, endTime: useNextDay ? "12:00" : newEnd, locations: [] },
    ]);
  }

  function removeTimeSlot(index) {
    if (timeSlots.length <= 1) return;
    setTimeSlots((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Populate the form with existing request data for editing
   */
  function startEditing(request) {
    setEditingRequest(request);
    // Populate time slots - preserve participants from existing slots
    if (request.timeSlots && request.timeSlots.length > 0) {
      setTimeSlots(request.timeSlots.map((slot) => ({
        date: slot.date || "",
        startTime: slot.startTime || "",
        endTime: slot.endTime || "",
        locations: slot.locations || [],
        participants: slot.participants || [],
      })));
    } else {
      // Legacy single-window format
      setTimeSlots([{
        date: request.departureDate || saturday.toISOString().split("T")[0],
        startTime: request.departureTime || "08:00",
        endTime: request.returnTime || "12:00",
        locations: request.locations || [],
        participants: [],
      }]);
    }
    setCustomLocation(request.customLocation || "");
    setContactNumber(request.contactNumber || "");
    setPurpose(request.purpose || "");
    setNotes(request.notes || "");
    // Populate companions - map to personnel format for display
    const existingCompanions = (request.companions || []).map((c) => {
      // Try to find matching personnel record for full data
      const personnelMatch = personnel.find((p) => (p.userId || p.id) === c.id);
      if (personnelMatch) return personnelMatch;
      // Fallback: parse name into first/last
      const nameParts = (c.name || "").split(" ");
      return {
        id: c.id,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        rank: c.rank || "",
      };
    });
    setCompanions(existingCompanions);
    setIsDriver(request.isDriver || false);
    setPassengerCapacity(request.passengerCapacity || 1);
    setShowForm(true);
  }

  async function handleSubmitRequest(e, forceSubmit = false) {
    if (e) e.preventDefault();
    setDuplicateWarning(null);
    try {
      const formData = {
        timeSlots: timeSlots.map((slot) => ({
          ...slot,
          // Preserve existing participants when editing
          participants: editingRequest ? (slot.participants || []) : [],
        })),
        customLocation,
        contactNumber,
        purpose,
        notes,
        companions: companions.map((c) => ({
          id: c.userId || c.id,
          name: c.firstName && c.lastName ? `${c.firstName} ${c.lastName}` : c.name || "",
          rank: c.rank,
        })),
        weekendDate: weekendDateStr,
        forceSubmit,
        isDriver,
        passengerCapacity: isDriver ? passengerCapacity : 0,
      };

      if (editingRequest) {
        // Update existing request
        await updateLibertyRequest(
          editingRequest.id,
          formData,
          { isAdmin: isAdmin || isLeaveAdmin }
        );
      } else {
        // Create new request
        const result = await createLibertyRequest(formData);

        if (result.isDuplicate) {
          setDuplicateWarning(result.existingRequest);
          return;
        }
      }

      resetForm();
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleResubmit() {
    await handleSubmitRequest(null, true);
  }

  function dismissDuplicateWarning() {
    setDuplicateWarning(null);
    resetForm();
  }

  async function handleCancelRequest(request) {
    const target = request || pendingRequest;
    if (!target) return;
    if (!EDITABLE_STATUSES.includes(target.status)) return;
    try {
      await cancelLibertyRequest(target.id, { isAdmin: isAdmin || isLeaveAdmin });
    } catch (err) {
      // Error handled by hook
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditingRequest(null);
    setTimeSlots([]);
    setCustomLocation("");
    setContactNumber(myPersonnelRecord?.phoneNumber || "");
    setPurpose("");
    setNotes("");
    setCompanions([]);
    setCompanionSearch("");
    setIsDriver(false);
    setPassengerCapacity(1);
  }

  function handleAddCompanion(person) {
    setCompanions((prev) => [...prev, person]);
    setCompanionSearch("");
    setShowCompanionDropdown(false);
  }

  function handleRemoveCompanion(personId) {
    setCompanions((prev) => prev.filter((p) => p.id !== personId));
  }

  const isFormValid =
    timeSlots.length > 0 &&
    timeSlots.every(
      (slot) =>
        slot.date &&
        slot.startTime &&
        slot.endTime &&
        (slot.locations || []).length > 0
    ) &&
    (!hasOtherLocation || customLocation.trim()) &&
    contactNumber.trim() &&
    purpose.trim();

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Weekend Liberty</h3>
        <span className="text-sm text-gray-500">
          {saturday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Deadline Warning */}
      {!canSubmit && !pendingRequest && !approvedRequest && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-700 text-sm font-medium">Deadline Passed</p>
              <p className="text-red-600 text-sm mt-1">
                Liberty requests for this weekend must be submitted by {deadlineDayName}.
                Check back next week to submit a request for the following weekend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Deadline Notice */}
      {canSubmit && !pendingRequest && !approvedRequest && !showForm && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 text-sm">
            <span className="font-medium">Deadline:</span> {deadlineDayName} at {config?.libertyDeadlineTime || '23:59'} ({deadline.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Recent Rejection Notice */}
      {recentRejectedRequest && !pendingRequest && !approvedRequest && !showForm && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-700 text-sm font-medium">Liberty Request Rejected</p>
              {recentRejectedRequest.rejectionReason && (
                <p className="text-red-600 text-sm mt-1">
                  Reason: {recentRejectedRequest.rejectionReason}
                </p>
              )}
              <p className="text-red-600 text-xs mt-1">
                By {recentRejectedRequest.rejectedByName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Approved Request Status */}
      {approvedRequest && !showForm && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-green-800">Liberty Approved</p>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <p><span className="font-medium">Destination:</span> {approvedRequest.destination}</p>
                {(approvedRequest.timeSlots || []).length > 0 ? (
                  <div className="space-y-1">
                    {approvedRequest.timeSlots.map((slot, idx) => (
                      <p key={idx} className="text-xs">
                        <span className="font-medium">{getTimeSlotLabel(slot)}:</span> {formatTime(slot.startTime)} - {formatTime(slot.endTime)} &middot; {buildDestinationString(slot.locations, approvedRequest.customLocation || "")}
                        {(slot.participants || []).length > 0 && (
                          <span className="text-green-600"> (+{slot.participants.length} joined)</span>
                        )}
                      </p>
                    ))}
                  </div>
                ) : (
                  <>
                    <p>
                      <span className="font-medium">Departure:</span> {formatDate(approvedRequest.departureDate)} at {formatTime(approvedRequest.departureTime)}
                    </p>
                    <p>
                      <span className="font-medium">Return:</span> {formatDate(approvedRequest.returnDate)} at {formatTime(approvedRequest.returnTime)}
                    </p>
                  </>
                )}
                {approvedRequest.isDriver && (
                  <p>
                    <span className="font-medium">Driver:</span> Yes ({approvedRequest.passengerCapacity} seats)
                  </p>
                )}
                {approvedRequest.companions?.length > 0 && (
                  <p>
                    <span className="font-medium">With:</span> {approvedRequest.companions.map((c) => c.name).join(", ")}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-green-600">
                  Approved by {approvedRequest.approvedByName} ({approvedRequest.approverInitials})
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => startEditing(approvedRequest)}
                    disabled={loading}
                    className="text-green-700 hover:text-green-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleCancelRequest(approvedRequest)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Request Status */}
      {pendingRequest && !showForm && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-yellow-800">Liberty Request Pending</span>
              </div>
              <div className="mt-2 text-sm text-yellow-700 space-y-1">
                <p><span className="font-medium">Destination:</span> {pendingRequest.destination}</p>
                {(pendingRequest.timeSlots || []).length > 0 ? (
                  <div className="space-y-1">
                    {pendingRequest.timeSlots.map((slot, idx) => (
                      <p key={idx} className="text-xs">
                        <span className="font-medium">{getTimeSlotLabel(slot)}:</span> {formatTime(slot.startTime)} - {formatTime(slot.endTime)} &middot; {buildDestinationString(slot.locations, pendingRequest.customLocation || "")}
                      </p>
                    ))}
                  </div>
                ) : (
                  <>
                    <p>
                      <span className="font-medium">Departure:</span> {formatDate(pendingRequest.departureDate)} at {formatTime(pendingRequest.departureTime)}
                    </p>
                    <p>
                      <span className="font-medium">Return:</span> {formatDate(pendingRequest.returnDate)} at {formatTime(pendingRequest.returnTime)}
                    </p>
                  </>
                )}
                {pendingRequest.isDriver && (
                  <p>
                    <span className="font-medium">Driver:</span> Yes ({pendingRequest.passengerCapacity} seats available)
                  </p>
                )}
                {pendingRequest.companions?.length > 0 && (
                  <p>
                    <span className="font-medium">With:</span> {pendingRequest.companions.map((c) => c.name).join(", ")}
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-yellow-600">
                Waiting for leadership approval...
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => startEditing(pendingRequest)}
                disabled={loading}
                className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => handleCancelRequest(pendingRequest)}
                disabled={loading}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      {!showForm && !pendingRequest && !approvedRequest && canSubmit && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Request Liberty
        </button>
      )}

      {/* Liberty Request Form */}
      {showForm && (
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${editingRequest ? "bg-amber-100 text-amber-800" : "bg-primary-100 text-primary-800"}`}>
              {editingRequest ? "Edit Liberty Request" : "Liberty Request"}
            </span>
            {editingRequest ? (
              <span className="text-xs text-gray-500">
                (Editing {editingRequest.status} request)
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                (Requires leadership approval)
              </span>
            )}
          </div>

          {/* Time Slots */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Time Slots <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addTimeSlot}
                className="text-xs font-medium text-primary-600 hover:text-primary-800"
              >
                + Add Time Slot
              </button>
            </div>
            <p className="text-xs text-gray-500 -mt-1">Add one slot per outing window (e.g. Sat morning, Sat afternoon)</p>

            {timeSlots.map((slot, slotIdx) => (
              <div key={slotIdx} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">
                    {getTimeSlotLabel(slot) || `Slot ${slotIdx + 1}`}
                  </span>
                  {timeSlots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(slotIdx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Date + Times */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) => updateSlotField(slotIdx, "date", e.target.value)}
                      min={saturday.toISOString().split("T")[0]}
                      required
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) => updateSlotField(slotIdx, "startTime", e.target.value)}
                      required
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) => updateSlotField(slotIdx, "endTime", e.target.value)}
                      required
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Locations for this slot */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Locations</label>
                  <div className="flex flex-wrap gap-1.5">
                    {LIBERTY_LOCATIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleSlotLocation(slotIdx, opt.value)}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          (slot.locations || []).includes(opt.value)
                            ? "bg-primary-100 border-primary-500 text-primary-800 font-medium"
                            : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {(slot.locations || []).includes(opt.value) && (
                          <span className="mr-0.5">&#10003;</span>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom location text if any slot has "other" */}
          {hasOtherLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter destination..."
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* Driver Checkbox & Passenger Capacity */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDriver"
                checked={isDriver}
                onChange={(e) => setIsDriver(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="isDriver" className="text-sm font-medium text-gray-700">
                I am driving
              </label>
            </div>
            {isDriver && (
              <div className="mt-3 ml-6">
                <label className="block text-sm text-gray-600 mb-1">
                  Available passenger seats
                </label>
                <select
                  value={passengerCapacity}
                  onChange={(e) => setPassengerCapacity(parseInt(e.target.value, 10))}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="Your phone number"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purpose <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Family visit, Personal errands, R&R"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Companions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Going With (Optional)
            </label>
            {companions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {companions.map((person) => (
                  <span
                    key={person.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                  >
                    {person.rank && `${person.rank} `}
                    {person.lastName}, {person.firstName}
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(person.id)}
                      className="ml-1 text-primary-600 hover:text-primary-800"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={companionSearch}
                onChange={(e) => {
                  setCompanionSearch(e.target.value);
                  setShowCompanionDropdown(true);
                }}
                onFocus={() => setShowCompanionDropdown(true)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              {showCompanionDropdown && filteredPersonnel.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredPersonnel.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleAddCompanion(person)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                    >
                      {person.rank && `${person.rank} `}
                      {person.lastName}, {person.firstName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional information..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? (editingRequest ? "Saving..." : "Submitting...") : (editingRequest ? "Save Changes" : "Submit Request")}
            </button>
          </div>
        </form>
      )}

      {/* Duplicate Request Warning Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-bold text-gray-900">Duplicate Request</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                You already have a pending liberty request for this weekend.
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">Existing Request:</p>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p><span className="font-medium">Destination:</span> {duplicateWarning.destination}</p>
                  {duplicateWarning.departureDate && (
                    <p>
                      <span className="font-medium">Departure:</span> {formatDate(duplicateWarning.departureDate)}
                    </p>
                  )}
                  {duplicateWarning.companions?.length > 0 && (
                    <p>
                      <span className="font-medium">With:</span> {duplicateWarning.companions.map((c) => c.name).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Do you want to cancel your existing request and submit a new one?
              </p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleResubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Replace Request"}
              </button>
              <button
                onClick={dismissDuplicateWarning}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Existing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
