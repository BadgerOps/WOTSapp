import { useState, useMemo, useEffect } from "react";
import {
  useMyLibertyRequests,
  useLibertyRequestActions,
  LIBERTY_REQUEST_STATUS,
  LIBERTY_LOCATIONS,
  getNextWeekendDates,
  isBeforeDeadline,
  getDeadlineDate,
  getDeadlineDayName,
} from "../../hooks/useLibertyRequests";
import { usePersonnel } from "../../hooks/usePersonnel";
import { useAuth } from "../../contexts/AuthContext";
import { useAppConfig } from "../../hooks/useAppConfig";
import Loading from "../common/Loading";

export default function LibertyRequestForm() {
  const { user } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const {
    requests: myLibertyRequests,
    loading: requestsLoading,
  } = useMyLibertyRequests();
  const {
    createLibertyRequest,
    cancelLibertyRequest,
    loading: requestActionLoading,
    error: requestError,
  } = useLibertyRequestActions();
  const { personnel } = usePersonnel();

  const [showForm, setShowForm] = useState(false);
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [companions, setCompanions] = useState([]);
  const [companionSearch, setCompanionSearch] = useState("");
  const [showCompanionDropdown, setShowCompanionDropdown] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

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

  // Set default dates when form opens
  useEffect(() => {
    if (showForm && !departureDate) {
      setDepartureDate(saturday.toISOString().split("T")[0]);
      setDepartureTime("08:00");
      setReturnDate(sunday.toISOString().split("T")[0]);
      setReturnTime("18:00");
    }
  }, [showForm, departureDate, saturday, sunday]);

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
    if (location === "other") {
      return customLocation;
    }
    const option = LIBERTY_LOCATIONS.find((o) => o.value === location);
    return option?.label || "";
  }

  async function handleSubmitRequest(e, forceSubmit = false) {
    if (e) e.preventDefault();
    setDuplicateWarning(null);
    try {
      const formData = {
        location,
        customLocation,
        departureDate,
        departureTime,
        returnDate,
        returnTime,
        contactNumber,
        purpose,
        notes,
        companions: companions.map((c) => ({
          id: c.userId || c.id,
          name: `${c.firstName} ${c.lastName}`,
          rank: c.rank,
        })),
        weekendDate: weekendDateStr,
        forceSubmit,
      };
      const result = await createLibertyRequest(formData);

      if (result.isDuplicate) {
        setDuplicateWarning(result.existingRequest);
        return;
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

  async function handleCancelRequest() {
    if (!pendingRequest) return;
    try {
      await cancelLibertyRequest(pendingRequest.id);
    } catch (err) {
      // Error handled by hook
    }
  }

  function resetForm() {
    setShowForm(false);
    setLocation("");
    setCustomLocation("");
    setDepartureDate("");
    setDepartureTime("");
    setReturnDate("");
    setReturnTime("");
    setContactNumber(myPersonnelRecord?.phoneNumber || "");
    setPurpose("");
    setNotes("");
    setCompanions([]);
    setCompanionSearch("");
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
    location &&
    (location !== "other" || customLocation.trim()) &&
    departureDate &&
    departureTime &&
    returnDate &&
    returnTime &&
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
                <p>
                  <span className="font-medium">Departure:</span> {formatDate(approvedRequest.departureDate)} at {formatTime(approvedRequest.departureTime)}
                </p>
                <p>
                  <span className="font-medium">Return:</span> {formatDate(approvedRequest.returnDate)} at {formatTime(approvedRequest.returnTime)}
                </p>
                {approvedRequest.companions?.length > 0 && (
                  <p>
                    <span className="font-medium">With:</span> {approvedRequest.companions.map((c) => c.name).join(", ")}
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-green-600">
                Approved by {approvedRequest.approvedByName} ({approvedRequest.approverInitials})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Request Status */}
      {pendingRequest && !showForm && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-yellow-800">Liberty Request Pending</span>
              </div>
              <div className="mt-2 text-sm text-yellow-700 space-y-1">
                <p><span className="font-medium">Destination:</span> {pendingRequest.destination}</p>
                <p>
                  <span className="font-medium">Departure:</span> {formatDate(pendingRequest.departureDate)} at {formatTime(pendingRequest.departureTime)}
                </p>
                <p>
                  <span className="font-medium">Return:</span> {formatDate(pendingRequest.returnDate)} at {formatTime(pendingRequest.returnTime)}
                </p>
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
            <button
              onClick={handleCancelRequest}
              disabled={loading}
              className="text-yellow-700 hover:text-yellow-900 text-sm font-medium"
            >
              Cancel
            </button>
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
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-primary-100 text-primary-800">
              Liberty Request
            </span>
            <span className="text-xs text-gray-500">
              (Requires leadership approval)
            </span>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination <span className="text-red-500">*</span>
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select destination...</option>
              {LIBERTY_LOCATIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {location === "other" && (
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter destination..."
                required
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            )}
          </div>

          {/* Departure Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={saturday.toISOString().split("T")[0]}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Return Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Return Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={departureDate || saturday.toISOString().split("T")[0]}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Return Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
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
              {loading ? "Submitting..." : "Submit Request"}
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
