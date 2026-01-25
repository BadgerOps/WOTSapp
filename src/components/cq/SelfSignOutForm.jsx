import { useState, useMemo, useEffect } from "react";
import {
  useMyStatus,
  useSelfSignOut,
  STATUS_TYPES,
  PASS_STAGES,
} from "../../hooks/usePersonnelStatus";
import {
  useMyPassRequests,
  usePassRequestActions,
  PASS_REQUEST_STATUS,
} from "../../hooks/usePassApproval";
import { usePersonnel } from "../../hooks/usePersonnel";
import { useAuth } from "../../contexts/AuthContext";
import Loading from "../common/Loading";

const DESTINATION_OPTIONS = [
  { value: "shoppette", label: "Shoppette" },
  { value: "bx_commissary", label: "BX/Commissary" },
  { value: "gym", label: "Gym" },
  { value: "library", label: "Library" },
  { value: "other", label: "Other" },
];

const TIME_PRESETS = [
  { value: 15, label: "+15 min" },
  { value: 30, label: "+30 min" },
  { value: 45, label: "+45 min" },
  { value: 60, label: "+1 hour" },
];

export default function SelfSignOutForm() {
  const { user, isAdmin, isCandidateLeadership } = useAuth();
  const {
    myStatus,
    loading: statusLoading,
    error: statusError,
  } = useMyStatus();
  const {
    signOut,
    signIn,
    signOutSickCall,
    updateStage,
    breakFree,
    loading: actionLoading,
    error: actionError,
  } = useSelfSignOut();
  const {
    requests: myPassRequests,
    loading: requestsLoading,
  } = useMyPassRequests();
  const {
    createPassRequest,
    cancelPassRequest,
    loading: requestActionLoading,
    error: requestError,
  } = usePassRequestActions();
  const { personnel } = usePersonnel();
  const [showForm, setShowForm] = useState(false);
  const [signOutType, setSignOutType] = useState("pass");
  const [destinationType, setDestinationType] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [timeMode, setTimeMode] = useState("preset"); // 'preset' or 'exact'
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [exactTime, setExactTime] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [companions, setCompanions] = useState([]);
  const [companionSearch, setCompanionSearch] = useState("");
  const [showCompanionDropdown, setShowCompanionDropdown] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Can this user sign out directly without approval?
  const canSignOutDirectly = isAdmin || isCandidateLeadership;

  // Find current user's personnel record
  const myPersonnelRecord = useMemo(() => {
    if (!user || !personnel.length) return null;
    return personnel.find(
      (p) => p.userId === user.uid || p.email === user.email,
    );
  }, [user, personnel]);

  // Get pending pass request (most recent)
  const pendingRequest = useMemo(() => {
    return myPassRequests.find((r) => r.status === "pending");
  }, [myPassRequests]);

  // Get most recent rejected request (within last hour)
  const recentRejectedRequest = useMemo(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return myPassRequests.find((r) => {
      if (r.status !== "rejected") return false;
      const rejectedAt = r.rejectedAt?.toDate?.()?.getTime() || 0;
      return rejectedAt > oneHourAgo;
    });
  }, [myPassRequests]);

  // Auto-populate phone number from personnel record
  useEffect(() => {
    if (myPersonnelRecord?.phoneNumber && !contactNumber) {
      setContactNumber(myPersonnelRecord.phoneNumber);
    }
  }, [myPersonnelRecord]);

  // Filter personnel for companion search (exclude current user)
  const filteredPersonnel = useMemo(() => {
    if (!companionSearch.trim()) return [];
    const search = companionSearch.toLowerCase();
    return personnel
      .filter((p) => {
        // Exclude current user
        if (p.userId === user?.uid || p.email === user?.email) return false;
        // Exclude already selected companions
        if (companions.some((c) => c.id === p.id)) return false;
        // Match by name
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        const reverseName = `${p.lastName} ${p.firstName}`.toLowerCase();
        return fullName.includes(search) || reverseName.includes(search);
      })
      .slice(0, 5); // Limit results
  }, [companionSearch, personnel, companions, user]);

  if (statusLoading || requestsLoading) return <Loading />;

  if (statusError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading status: {statusError}</p>
      </div>
    );
  }

  const isOnPass = myStatus?.status === "pass";
  const isOnSickCall = myStatus?.status === "sick_call";
  const isOut = isOnPass || isOnSickCall;
  const isCompanion = !!myStatus?.withPersonId;

  const loading = actionLoading || requestActionLoading;
  const error = actionError || requestError;

  function getDestination() {
    if (destinationType === "other") {
      return customDestination;
    }
    const option = DESTINATION_OPTIONS.find((o) => o.value === destinationType);
    return option?.label || "";
  }

  function getExpectedReturn() {
    if (timeMode === "exact") {
      return exactTime;
    }
    if (selectedPreset) {
      const baseTime = new Date();
      baseTime.setMinutes(baseTime.getMinutes() + selectedPreset);
      return baseTime.toISOString();
    }
    return "";
  }

  // Submit pass request for approval
  async function handleRequestPass(e, forceSubmit = false) {
    if (e) e.preventDefault();
    setDuplicateWarning(null);
    try {
      const formData = {
        destination: getDestination(),
        expectedReturn: getExpectedReturn(),
        contactNumber,
        notes,
        companions: companions.map((c) => ({
          id: c.userId || c.id,
          name: `${c.firstName} ${c.lastName}`,
          rank: c.rank,
        })),
        forceSubmit,
      };
      const result = await createPassRequest(formData);

      // Check if this is a duplicate warning
      if (result.isDuplicate) {
        setDuplicateWarning(result.existingRequest);
        return;
      }

      resetForm();
    } catch (err) {
      // Error handled by hook
    }
  }

  // Handle resubmit after duplicate warning
  async function handleResubmit() {
    await handleRequestPass(null, true);
  }

  // Dismiss duplicate warning and keep existing request
  function dismissDuplicateWarning() {
    setDuplicateWarning(null);
    resetForm();
  }

  // Direct sign out (for leadership/admin)
  async function handleDirectSignOut(e) {
    e.preventDefault();
    try {
      const formData = {
        timeOut: new Date().toISOString(),
        destination: getDestination(),
        expectedReturn: getExpectedReturn(),
        contactNumber,
        notes,
        companions: companions.map((c) => ({
          id: c.userId || c.id,
          name: `${c.firstName} ${c.lastName}`,
          rank: c.rank,
        })),
      };
      await signOut(formData);
      resetForm();
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleCancelRequest() {
    if (!pendingRequest) return;
    try {
      await cancelPassRequest(pendingRequest.id);
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleSignIn() {
    try {
      await signIn();
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleSickCallSignOut(e) {
    e.preventDefault();
    try {
      await signOutSickCall({
        contactNumber,
        notes,
      });
      resetForm();
    } catch (err) {
      // Error handled by hook
    }
  }

  function resetForm() {
    setShowForm(false);
    setSignOutType("pass");
    setDestinationType("");
    setCustomDestination("");
    setTimeMode("preset");
    setSelectedPreset(null);
    setExactTime("");
    setContactNumber(myPersonnelRecord?.phoneNumber || "");
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
    destinationType &&
    (destinationType !== "other" || customDestination.trim()) &&
    (selectedPreset || exactTime) &&
    contactNumber.trim();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">My Status</h3>

      {/* Current Status Display */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="text-gray-600">Current Status:</span>
          <span
            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
              isOnPass
                ? "bg-yellow-100 text-yellow-800"
                : isOnSickCall
                  ? "bg-orange-100 text-orange-800"
                  : "bg-green-100 text-green-800"
            }`}
          >
            {STATUS_TYPES[myStatus?.status]?.label || "Present"}
          </span>
        </div>
        {isOut && myStatus?.timeOut && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Time Out:</span>{" "}
            {new Date(myStatus.timeOut).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
        {isOnPass && myStatus?.destination && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Destination:</span>{" "}
            {myStatus.destination}
          </div>
        )}
        {isOnPass && myStatus?.expectedReturn && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Expected Return:</span>{" "}
            {new Date(myStatus.expectedReturn).toLocaleString()}
          </div>
        )}
        {isOnPass && myStatus?.companions?.length > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">With:</span>{" "}
            {myStatus.companions.map((c) => c.name).join(", ")}
          </div>
        )}
        {isOnPass && isCompanion && myStatus?.withPersonName && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">With:</span> {myStatus.withPersonName}
          </div>
        )}
        {isOut && myStatus?.notes && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Notes:</span> {myStatus.notes}
          </div>
        )}
        {/* Current Stage Display */}
        {isOnPass && myStatus?.passStage && (
          <div className="mt-2 text-sm">
            <span className="font-medium text-gray-600">Stage:</span>{" "}
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                myStatus.passStage === "enroute_to"
                  ? "bg-yellow-100 text-yellow-800"
                  : myStatus.passStage === "arrived"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {PASS_STAGES[myStatus.passStage]?.label || myStatus.passStage}
              {myStatus.passStage === "enroute_to" &&
                ` ${myStatus.destination}`}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Recent Rejection Notice */}
      {recentRejectedRequest && !isOut && !pendingRequest && !showForm && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-red-700 text-sm font-medium">Pass Request Rejected</p>
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

      {/* Pending Request Status */}
      {pendingRequest && !isOut && !showForm && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-yellow-800">Pass Request Pending</span>
              </div>
              <div className="mt-2 text-sm text-yellow-700 space-y-1">
                <p><span className="font-medium">Destination:</span> {pendingRequest.destination}</p>
                {pendingRequest.expectedReturn && (
                  <p>
                    <span className="font-medium">Expected Return:</span>{" "}
                    {new Date(pendingRequest.expectedReturn).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
                {pendingRequest.companions?.length > 0 && (
                  <p>
                    <span className="font-medium">With:</span>{" "}
                    {pendingRequest.companions.map((c) => c.name).join(", ")}
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

      {/* Sign Back In from Sick Call */}
      {isOnSickCall && !showForm && (
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
        >
          {loading ? "Signing In..." : "Sign Back In"}
        </button>
      )}

      {/* Stage Progression Buttons (when on pass) */}
      {isOnPass && !showForm && (
        <div className="space-y-3">
          {/* Stage Progress Tracker */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span
              className={
                myStatus?.passStage === "enroute_to"
                  ? "text-yellow-600 font-semibold"
                  : "text-gray-400"
              }
            >
              Enroute
            </span>
            <span className="text-gray-300">→</span>
            <span
              className={
                myStatus?.passStage === "arrived"
                  ? "text-blue-600 font-semibold"
                  : "text-gray-400"
              }
            >
              At Location
            </span>
            <span className="text-gray-300">→</span>
            <span
              className={
                myStatus?.passStage === "enroute_back"
                  ? "text-yellow-600 font-semibold"
                  : "text-gray-400"
              }
            >
              Returning
            </span>
            <span className="text-gray-300">→</span>
            <span className="text-gray-400">Barracks</span>
          </div>

          {/* Break Free button for companions */}
          {isCompanion && (
            <button
              onClick={breakFree}
              disabled={loading}
              className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? "Updating..." : "Go Solo (separate from group)"}
            </button>
          )}

          {/* Stage Action Buttons */}
          {myStatus?.passStage === "enroute_to" && (
            <button
              onClick={() => updateStage("arrived")}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading
                ? "Updating..."
                : `Arrived at ${myStatus.destination}`}
            </button>
          )}

          {myStatus?.passStage === "arrived" && (
            <button
              onClick={() => updateStage("enroute_back")}
              disabled={loading}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? "Updating..." : "Heading Back to Barracks"}
            </button>
          )}

          {myStatus?.passStage === "enroute_back" && (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? "Signing In..." : "Arrived at Barracks"}
            </button>
          )}

          {/* Fallback for old data without passStage */}
          {!myStatus?.passStage && (
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? "Signing In..." : "Sign Back In"}
            </button>
          )}
        </div>
      )}

      {/* Sign Out Buttons (when present and no pending request) */}
      {!isOut && !showForm && !pendingRequest && (
        <div className="space-y-2">
          <button
            onClick={() => {
              setSignOutType("pass");
              setShowForm(true);
            }}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {canSignOutDirectly ? "Sign Out on Pass" : "Request Pass"}
          </button>
          <button
            onClick={() => {
              setSignOutType("sick_call");
              setShowForm(true);
            }}
            className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Sick Call
          </button>
        </div>
      )}

      {/* Sick Call Form */}
      {showForm && signOutType === "sick_call" && (
        <form onSubmit={handleSickCallSignOut} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-800">
              Sick Call
            </span>
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

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Symptoms, appointment details, etc."
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
              disabled={loading || !contactNumber.trim()}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Signing Out..." : "Sick Call"}
            </button>
          </div>
        </form>
      )}

      {/* Pass Request/Sign Out Form */}
      {showForm && signOutType === "pass" && (
        <form onSubmit={canSignOutDirectly ? handleDirectSignOut : handleRequestPass} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
              {canSignOutDirectly ? "Pass" : "Pass Request"}
            </span>
            {!canSignOutDirectly && (
              <span className="text-xs text-gray-500">
                (Requires leadership approval)
              </span>
            )}
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination <span className="text-red-500">*</span>
            </label>
            <select
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select destination...</option>
              {DESTINATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {destinationType === "other" && (
              <input
                type="text"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                placeholder="Enter destination..."
                required
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            )}
          </div>

          {/* Expected Return Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Return <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setTimeMode("preset")}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeMode === "preset"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Quick Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeMode("exact");
                  setSelectedPreset(null);
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeMode === "exact"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Exact Time
              </button>
            </div>
            {timeMode === "preset" ? (
              <div className="grid grid-cols-4 gap-2">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setSelectedPreset(preset.value)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedPreset === preset.value
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="datetime-local"
                value={exactTime}
                onChange={(e) => setExactTime(e.target.value)}
                required={timeMode === "exact"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
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
            {!myPersonnelRecord?.phoneNumber && (
              <p className="mt-1 text-xs text-gray-500">
                Contact your admin to update your phone number in the personnel
                roster.
              </p>
            )}
          </div>

          {/* Companions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Going With (Optional)
            </label>
            {/* Selected companions */}
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
            {/* Search input */}
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
              {/* Dropdown */}
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
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
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
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? (canSignOutDirectly ? "Signing Out..." : "Submitting...")
                : (canSignOutDirectly ? "Sign Out" : "Request Pass")}
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
                You already have a pending pass request.
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">Existing Request:</p>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p><span className="font-medium">Destination:</span> {duplicateWarning.destination}</p>
                  {duplicateWarning.expectedReturn && (
                    <p>
                      <span className="font-medium">Expected Return:</span>{" "}
                      {new Date(duplicateWarning.expectedReturn).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {duplicateWarning.companions?.length > 0 && (
                    <p>
                      <span className="font-medium">With:</span>{" "}
                      {duplicateWarning.companions.map((c) => c.name).join(", ")}
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
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
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
