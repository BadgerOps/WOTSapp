import { useState } from "react";
import {
  usePersonnelStatus,
  usePersonnelStatusActions,
  STATUS_TYPES,
} from "../../hooks/usePersonnelStatus";
import Loading from "../common/Loading";
import StatusUpdateForm from "./StatusUpdateForm";

const STATUS_COLORS = {
  present: "bg-green-100 text-green-800",
  pass: "bg-yellow-100 text-yellow-800",
  // leave: 'bg-blue-100 text-blue-800',
  // tdy: 'bg-purple-100 text-purple-800',
  sick_call: "bg-orange-100 text-orange-800",
};

const PASS_CARD_THRESHOLD = 4;

export default function PersonnelStatusTracker() {
  const { personnelWithStatus, loading, error } = usePersonnelStatus();
  const { bulkSignIn, loading: actionLoading } = usePersonnelStatusActions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error loading personnel status: {error}</p>
      </div>
    );
  }

  // Filter personnel
  const filteredPersonnel = personnelWithStatus.filter((person) => {
    const matchesSearch =
      !searchTerm ||
      `${person.firstName} ${person.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      person.rank?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || person.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get personnel on pass (not present)
  const personnelOnPass = filteredPersonnel.filter(
    (p) => p.status !== "present",
  );
  const useCardView =
    personnelOnPass.length <= PASS_CARD_THRESHOLD && statusFilter === "pass";

  // Count by status
  const statusCounts = personnelWithStatus.reduce((acc, person) => {
    acc[person.status] = (acc[person.status] || 0) + 1;
    return acc;
  }, {});

  function handleUpdateClick(person) {
    setSelectedPerson(person);
    setShowUpdateForm(true);
  }

  function handleCloseForm() {
    setShowUpdateForm(false);
    setSelectedPerson(null);
  }

  function toggleSelection(personId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredPersonnel.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPersonnel.map((p) => p.id)));
    }
  }

  async function handleBulkSignIn() {
    const selectedPersonnel = filteredPersonnel.filter((p) =>
      selectedIds.has(p.id),
    );
    if (selectedPersonnel.length === 0) return;

    try {
      await bulkSignIn(selectedPersonnel);
      setSelectedIds(new Set());
    } catch (err) {
      // Error handled by hook
    }
  }

  async function handleQuickSignIn(person) {
    try {
      await bulkSignIn([person]);
    } catch (err) {
      // Error handled by hook
    }
  }

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_TYPES).map(([key, { label }]) => (
          <div
            key={key}
            className={`p-3 rounded-lg cursor-pointer transition-all ${
              statusFilter === key
                ? "ring-2 ring-primary-500 " + STATUS_COLORS[key]
                : STATUS_COLORS[key] + " hover:opacity-80"
            }`}
            onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
          >
            <div className="text-2xl font-bold">{statusCounts[key] || 0}</div>
            <div className="text-sm">{label}</div>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or rank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelectedIds(new Set());
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_TYPES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <span className="text-sm font-medium text-primary-800">
            {selectedCount} selected
          </span>
          <button
            onClick={handleBulkSignIn}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {actionLoading ? "Signing In..." : "Sign In Selected"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-gray-600 text-sm font-medium hover:text-gray-800"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Card View for Pass (≤4 people) */}
      {useCardView && personnelOnPass.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {personnelOnPass.map((person) => (
            <div
              key={person.id}
              className={`bg-white rounded-lg shadow-md p-4 border-l-4 ${
                person.status === "pass"
                  ? "border-yellow-400"
                  : "border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(person.id)}
                    onChange={() => toggleSelection(person.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">
                      {person.rank && `${person.rank} `}
                      {person.lastName}, {person.firstName}
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        STATUS_COLORS[person.status]
                      }`}
                    >
                      {STATUS_TYPES[person.status]?.label || person.status}
                    </span>
                  </div>
                </div>
              </div>

              {person.statusDetails?.destination && (
                <div className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Destination:</span>{" "}
                  {person.statusDetails.destination}
                </div>
              )}
              {person.statusDetails?.expectedReturn && (
                <div className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Expected Return:</span>{" "}
                  {new Date(
                    person.statusDetails.expectedReturn,
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
              {person.statusDetails?.contactNumber && (
                <div className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Contact:</span>{" "}
                  {person.statusDetails.contactNumber}
                </div>
              )}
              {person.statusDetails?.withPersonName && (
                <div className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">With:</span>{" "}
                  {person.statusDetails.withPersonName}
                </div>
              )}
              {person.statusDetails?.companions?.length > 0 && (
                <div className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Companions:</span>{" "}
                  {person.statusDetails.companions
                    .map((c) => c.name)
                    .join(", ")}
                </div>
              )}

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleQuickSignIn(person)}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Sign In
                </button>
                <button
                  onClick={() => handleUpdateClick(person)}
                  className="px-3 py-1.5 text-primary-600 text-sm font-medium border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View (default or >4 people on pass) */}
      {(!useCardView || statusFilter !== "pass") && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === filteredPersonnel.length &&
                        filteredPersonnel.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Details
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPersonnel.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No personnel found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPersonnel.map((person) => (
                    <tr
                      key={person.id}
                      className={`hover:bg-gray-50 ${selectedIds.has(person.id) ? "bg-primary-50" : ""}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(person.id)}
                          onChange={() => toggleSelection(person.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {person.lastName}, {person.firstName}
                        </div>
                        <div className="sm:hidden text-xs text-gray-500">
                          {person.rank}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 hidden sm:table-cell">
                        {person.rank || "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            STATUS_COLORS[person.status]
                          }`}
                        >
                          {STATUS_TYPES[person.status]?.label || person.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                        {person.statusDetails?.destination && (
                          <div>
                            <span className="font-medium">Dest:</span>{" "}
                            {person.statusDetails.destination}
                          </div>
                        )}
                        {person.statusDetails?.expectedReturn && (
                          <div>
                            <span className="font-medium">Return:</span>{" "}
                            {new Date(
                              person.statusDetails.expectedReturn,
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                        {person.statusDetails?.withPersonName && (
                          <div>
                            <span className="font-medium">With:</span>{" "}
                            {person.statusDetails.withPersonName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {person.status !== "present" && (
                            <button
                              onClick={() => handleQuickSignIn(person)}
                              disabled={actionLoading}
                              className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Sign In
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateClick(person)}
                            className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                          >
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showUpdateForm && selectedPerson && (
        <StatusUpdateForm person={selectedPerson} onClose={handleCloseForm} />
      )}
    </div>
  );
}
