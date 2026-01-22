import { useState, useMemo, useEffect } from "react";
import {
  useMyStatus,
  useSelfSignOut,
  STATUS_TYPES,
  PASS_STAGES,
} from "../../hooks/usePersonnelStatus";
import { usePersonnel } from "../../hooks/usePersonnel";
import { useAuth } from "../../contexts/AuthContext";
import Loading from "../common/Loading";

const SIGN_OUT_TYPES = [
  { value: "pass", label: "Pass", color: "yellow" },
  { value: "sick_call", label: "Sick Call", color: "orange" },
];

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
  const { user } = useAuth();
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
  const { personnel } = usePersonnel();
  const [showForm, setShowForm] = useState(false);
  const [signOutType, setSignOutType] = useState("pass");
  const [destinationType, setDestinationType] = useState("");
  const [customDestination, setCustomDestination] = useState("");
  const [timeOutMode, setTimeOutMode] = useState("now"); // 'now' or 'exact'
  const [timeOutExact, setTimeOutExact] = useState("");
  const [timeMode, setTimeMode] = useState("preset"); // 'preset' or 'exact'
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [exactTime, setExactTime] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [companions, setCompanions] = useState([]);
  const [companionSearch, setCompanionSearch] = useState("");
  const [showCompanionDropdown, setShowCompanionDropdown] = useState(false);

  // Find current user's personnel record
  const myPersonnelRecord = useMemo(() => {
    if (!user || !personnel.length) return null;
    return personnel.find(
      (p) => p.userId === user.uid || p.email === user.email,
    );
  }, [user, personnel]);

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

  if (statusLoading) return <Loading />;

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

  function getDestination() {
    if (destinationType === "other") {
      return customDestination;
    }
    const option = DESTINATION_OPTIONS.find((o) => o.value === destinationType);
    return option?.label || "";
  }

  function getTimeOut() {
    if (timeOutMode === "exact" && timeOutExact) {
      return new Date(timeOutExact).toISOString();
    }
    return new Date().toISOString();
  }

  function getExpectedReturn() {
    if (timeMode === "exact") {
      return exactTime;
    }
    if (selectedPreset) {
      // Base expected return on time out, not current time
      const baseTime =
        timeOutMode === "exact" && timeOutExact
          ? new Date(timeOutExact)
          : new Date();
      baseTime.setMinutes(baseTime.getMinutes() + selectedPreset);
      return baseTime.toISOString();
    }
    return "";
  }

  async function handleSignOut(e) {
    e.preventDefault();
    try {
      const formData = {
        timeOut: getTimeOut(),
        destination: getDestination(),
        expectedReturn: getExpectedReturn(),
        contactNumber,
        notes,
        companions: companions.map((c) => ({
          id: c.id,
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
    setTimeOutMode("now");
    setTimeOutExact("");
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

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{actionError}</p>
        </div>
      )}

      {/* Sign Back In from Sick Call */}
      {isOnSickCall && !showForm && (
        <button
          onClick={handleSignIn}
          disabled={actionLoading}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
        >
          {actionLoading ? "Signing In..." : "Sign Back In"}
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
              disabled={actionLoading}
              className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
            >
              {actionLoading ? "Updating..." : "Go Solo (separate from group)"}
            </button>
          )}

          {/* Stage Action Buttons */}
          {myStatus?.passStage === "enroute_to" && (
            <button
              onClick={() => updateStage("arrived")}
              disabled={actionLoading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading
                ? "Updating..."
                : `Arrived at ${myStatus.destination}`}
            </button>
          )}

          {myStatus?.passStage === "arrived" && (
            <button
              onClick={() => updateStage("enroute_back")}
              disabled={actionLoading}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? "Updating..." : "Heading Back to Barracks"}
            </button>
          )}

          {myStatus?.passStage === "enroute_back" && (
            <button
              onClick={handleSignIn}
              disabled={actionLoading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? "Signing In..." : "Arrived at Barracks"}
            </button>
          )}

          {/* Fallback for old data without passStage */}
          {!myStatus?.passStage && (
            <button
              onClick={handleSignIn}
              disabled={actionLoading}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              {actionLoading ? "Signing In..." : "Sign Back In"}
            </button>
          )}
        </div>
      )}

      {/* Sign Out Buttons (when present) */}
      {!isOut && !showForm && (
        <div className="space-y-2">
          <button
            onClick={() => {
              setSignOutType("pass");
              setShowForm(true);
            }}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Sign Out on Pass
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
              disabled={actionLoading || !contactNumber.trim()}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Signing Out..." : "Sick Call"}
            </button>
          </div>
        </form>
      )}

      {/* Pass Sign Out Form */}
      {showForm && signOutType === "pass" && (
        <form onSubmit={handleSignOut} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
              Pass
            </span>
          </div>

          {/* Time Out */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Out
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setTimeOutMode("now");
                  setTimeOutExact("");
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeOutMode === "now"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setTimeOutMode("exact")}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeOutMode === "exact"
                    ? "bg-primary-100 text-primary-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Exact Time
              </button>
            </div>
            {timeOutMode === "exact" && (
              <input
                type="datetime-local"
                value={timeOutExact}
                onChange={(e) => setTimeOutExact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            )}
            {timeOutMode === "now" && (
              <p className="text-sm text-gray-500">
                Departure time will be recorded as now
              </p>
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

          {/* Time Back */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Back <span className="text-red-500">*</span>
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
              disabled={actionLoading || !isFormValid}
              className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
