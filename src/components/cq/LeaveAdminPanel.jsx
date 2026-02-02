import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLeaveAdminActions, LIBERTY_LOCATIONS, getNextWeekendDates } from '../../hooks/useLibertyRequests';
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
  const [location, setLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [libertyStatus, setLibertyStatus] = useState('approved');

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
    setLocation('');
    setCustomLocation('');
    setDepartureDate('');
    setDepartureTime('');
    setReturnDate('');
    setReturnTime('');
    setPurpose('');
    setLibertyStatus('approved');
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
        location,
        customLocation,
        departureDate,
        departureTime,
        returnDate,
        returnTime,
        contactNumber,
        purpose,
        notes,
        companions: [],
        weekendDate,
        status: libertyStatus,
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location *
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select location...</option>
                {LIBERTY_LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            {location === 'other' && (
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departure Time
                </label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Time
                </label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
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
              disabled={!selectedPerson || !location || (location === 'other' && !customLocation) || loading}
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
