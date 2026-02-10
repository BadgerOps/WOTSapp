import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLeaveAdminActions, LIBERTY_LOCATIONS, buildDestinationString, getTimeSlotLabel, getNextWeekendDates } from '../../hooks/useLibertyRequests';
import { usePassAdminActions } from '../../hooks/usePassApproval';

/**
 * LeaveAdminPanel - Admin interface for creating leave/pass requests on behalf of users
 *
 * This component allows leave_admin, candidate_leadership, and admin users to:
 * - Select a user from the personnel roster
 * - Create liberty (weekend) requests for that user
 * - Create pass requests for that user (with optional auto-approval)
 */
export default function LeaveAdminPanel() {
  const { canCreateLeaveForOthers } = useAuth();
  const { createLibertyRequestForUser, loading: libertyLoading, error: libertyError } = useLeaveAdminActions();
  const { createPassRequestForUser, loading: passLoading, error: passError } = usePassAdminActions();

  const [personnel, setPersonnel] = useState([]);
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [requestType, setRequestType] = useState('pass'); // 'pass' or 'liberty'
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPersonnelDropdown, setShowPersonnelDropdown] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form fields for pass request
  const [destination, setDestination] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);

  // Form fields for liberty request
  const [customLocation, setCustomLocation] = useState('');
  const [purpose, setPurpose] = useState('');
  const [libertyStatus, setLibertyStatus] = useState('approved');
  const [isDriver, setIsDriver] = useState(false);
  const [passengerCapacity, setPassengerCapacity] = useState(1);
  const [timeSlots, setTimeSlots] = useState([]);

  // Get next weekend dates for liberty default
  const { saturday } = getNextWeekendDates();
  const weekendDate = saturday.toISOString().split('T')[0];

  // Load personnel
  useEffect(() => {
    const q = query(collection(db, 'personnel'), orderBy('lastName', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPersonnel(data);
        setPersonnelLoading(false);
      },
      (err) => {
        console.error('Error fetching personnel:', err);
        setPersonnelLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  // Filter personnel based on search
  const filteredPersonnel = personnel.filter((p) => {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    const email = (p.email || '').toLowerCase();
    const search = searchQuery.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  // Handle person selection
  function handleSelectPerson(person) {
    setSelectedPerson(person);
    setSearchQuery(`${person.firstName} ${person.lastName}`);
    setShowPersonnelDropdown(false);
    // Pre-fill contact number if available
    if (person.phoneNumber) {
      setContactNumber(person.phoneNumber);
    }
  }

  // Reset form
  function resetForm() {
    setSelectedPerson(null);
    setSearchQuery('');
    setDestination('');
    setExpectedReturn('');
    setContactNumber('');
    setNotes('');
    setAutoApprove(true);
    setTimeSlots([]);
    setCustomLocation('');
    setPurpose('');
    setLibertyStatus('approved');
    setIsDriver(false);
    setPassengerCapacity(1);
  }

  // Handle pass request submission
  async function handleSubmitPassRequest(e) {
    e.preventDefault();
    if (!selectedPerson) return;

    try {
      const result = await createPassRequestForUser({
        targetUserId: selectedPerson.userId || selectedPerson.id,
        targetUserName: `${selectedPerson.firstName} ${selectedPerson.lastName}`,
        targetUserEmail: selectedPerson.email,
        destination,
        expectedReturn: expectedReturn ? new Date(expectedReturn).toISOString() : null,
        contactNumber,
        notes,
        companions: [],
        autoApprove,
      });

      if (result.success) {
        setSuccessMessage(
          result.autoApproved
            ? `Pass request created and approved for ${selectedPerson.firstName} ${selectedPerson.lastName}. They have been signed out.`
            : `Pass request created for ${selectedPerson.firstName} ${selectedPerson.lastName}. Awaiting approval.`
        );
        resetForm();
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error creating pass request:', err);
    }
  }

  // Handle liberty request submission
  async function handleSubmitLibertyRequest(e) {
    e.preventDefault();
    if (!selectedPerson) return;

    try {
      const result = await createLibertyRequestForUser({
        targetUserId: selectedPerson.userId || selectedPerson.id,
        targetUserName: `${selectedPerson.firstName} ${selectedPerson.lastName}`,
        targetUserEmail: selectedPerson.email,
        timeSlots: timeSlots.map((slot) => ({ ...slot, participants: [] })),
        customLocation,
        contactNumber,
        purpose,
        notes,
        companions: [],
        weekendDate,
        status: libertyStatus,
        isDriver,
        passengerCapacity: isDriver ? passengerCapacity : 0,
      });

      if (result.success) {
        setSuccessMessage(
          libertyStatus === 'approved'
            ? `Liberty request created and approved for ${selectedPerson.firstName} ${selectedPerson.lastName}.`
            : `Liberty request created for ${selectedPerson.firstName} ${selectedPerson.lastName}. Awaiting approval.`
        );
        resetForm();
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error creating liberty request:', err);
    }
  }

  if (!canCreateLeaveForOthers) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">
          You do not have permission to create leave/pass requests on behalf of others.
        </p>
      </div>
    );
  }

  const loading = libertyLoading || passLoading;
  const error = libertyError || passError;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Create Leave/Pass Request for User
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Use this form to create pass or liberty requests on behalf of personnel members.
        </p>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Request Type Selector */}
        <div className="flex gap-4 mb-6">
          <button
            type="button"
            onClick={() => setRequestType('pass')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              requestType === 'pass'
                ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            Pass Request
          </button>
          <button
            type="button"
            onClick={() => setRequestType('liberty')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              requestType === 'liberty'
                ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            Liberty Request
          </button>
        </div>

        {/* Personnel Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Personnel *
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowPersonnelDropdown(true);
                if (!e.target.value) {
                  setSelectedPerson(null);
                }
              }}
              onFocus={() => setShowPersonnelDropdown(true)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {showPersonnelDropdown && searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {personnelLoading ? (
                  <div className="p-4 text-gray-500">Loading...</div>
                ) : filteredPersonnel.length === 0 ? (
                  <div className="p-4 text-gray-500">No personnel found</div>
                ) : (
                  filteredPersonnel.slice(0, 10).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectPerson(person)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <div>
                        <div className="font-medium">
                          {person.rank && <span className="text-gray-500">{person.rank} </span>}
                          {person.firstName} {person.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{person.email}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {selectedPerson && (
            <div className="mt-2 text-sm text-green-600">
              Selected: {selectedPerson.rank} {selectedPerson.firstName} {selectedPerson.lastName}
            </div>
          )}
        </div>

        {/* Pass Request Form */}
        {requestType === 'pass' && (
          <form onSubmit={handleSubmitPassRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination *
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
                placeholder="e.g., BX, Shoppette, Gym"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Return
              </label>
              <input
                type="datetime-local"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Phone number while out"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoApprove"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="autoApprove" className="text-sm text-gray-700">
                Auto-approve and sign out immediately
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedPerson || !destination || loading}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Pass Request'}
            </button>
          </form>
        )}

        {/* Liberty Request Form */}
        {requestType === 'liberty' && (
          <form onSubmit={handleSubmitLibertyRequest} className="space-y-4">
            {/* Time Slots */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Time Slots *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const lastSlot = timeSlots[timeSlots.length - 1];
                    const newDate = lastSlot?.date || saturday.toISOString().split('T')[0];
                    setTimeSlots((prev) => [
                      ...prev,
                      { date: newDate, startTime: '13:00', endTime: '17:00', locations: [] },
                    ]);
                  }}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800"
                >
                  + Add Time Slot
                </button>
              </div>

              {timeSlots.length === 0 && (
                <button
                  type="button"
                  onClick={() => setTimeSlots([{ date: saturday.toISOString().split('T')[0], startTime: '08:00', endTime: '12:00', locations: [] }])}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600"
                >
                  Click to add first time slot
                </button>
              )}

              {timeSlots.map((slot, slotIdx) => (
                <div key={slotIdx} className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {getTimeSlotLabel(slot) || `Slot ${slotIdx + 1}`}
                    </span>
                    {timeSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTimeSlots((prev) => prev.filter((_, i) => i !== slotIdx))}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => setTimeSlots((prev) => prev.map((s, i) => i === slotIdx ? { ...s, date: e.target.value } : s))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => setTimeSlots((prev) => prev.map((s, i) => i === slotIdx ? { ...s, startTime: e.target.value } : s))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => setTimeSlots((prev) => prev.map((s, i) => i === slotIdx ? { ...s, endTime: e.target.value } : s))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Locations</label>
                    <div className="flex flex-wrap gap-1.5">
                      {LIBERTY_LOCATIONS.map((loc) => (
                        <button
                          key={loc.value}
                          type="button"
                          onClick={() => setTimeSlots((prev) => prev.map((s, i) => {
                            if (i !== slotIdx) return s;
                            const locs = s.locations || [];
                            return { ...s, locations: locs.includes(loc.value) ? locs.filter((v) => v !== loc.value) : [...locs, loc.value] };
                          }))}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            (slot.locations || []).includes(loc.value)
                              ? 'bg-primary-100 border-primary-500 text-primary-800 font-medium'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {(slot.locations || []).includes(loc.value) && <span className="mr-0.5">&#10003;</span>}
                          {loc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom location if any slot has "other" */}
            {timeSlots.some((s) => (s.locations || []).includes('other')) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Location *
                </label>
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  required
                  placeholder="Specify location..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}

            {/* Driver Checkbox & Passenger Capacity */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="adminIsDriver"
                  checked={isDriver}
                  onChange={(e) => setIsDriver(e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="adminIsDriver" className="text-sm font-medium text-gray-700">
                  Person is driving
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Phone number while out"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Reason for liberty..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={libertyStatus}
                onChange={(e) => setLibertyStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="approved">Approved (auto-approve)</option>
                <option value="pending">Pending (requires approval)</option>
              </select>
            </div>

            <div className="text-sm text-gray-500">
              Weekend: {saturday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>

            <button
              type="submit"
              disabled={!selectedPerson || timeSlots.length === 0 || !timeSlots.every((s) => (s.locations || []).length > 0 && s.date && s.startTime && s.endTime) || (timeSlots.some((s) => (s.locations || []).includes('other')) && !customLocation) || loading}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Liberty Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
