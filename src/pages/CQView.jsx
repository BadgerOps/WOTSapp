import { useActiveShift } from "../hooks/useCQShifts";
import { usePersonnelStatus, STATUS_TYPES } from "../hooks/usePersonnelStatus";
import { useRecentCQNotes, NOTE_TYPES } from "../hooks/useCQNotes";
import SelfSignOutForm from "../components/cq/SelfSignOutForm";
import Loading from "../components/common/Loading";

const STATUS_COLORS = {
  present: "bg-green-100 text-green-800",
  pass: "bg-yellow-100 text-yellow-800",
  // leave: 'bg-blue-100 text-blue-800',
  // tdy: 'bg-purple-100 text-purple-800',
  sick_call: "bg-orange-100 text-orange-800",
};

const NOTE_TYPE_COLORS = {
  routine: "bg-gray-100 text-gray-800",
  incident: "bg-red-100 text-red-800",
  visitor: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

export default function CQView() {
  const { activeShift, loading: shiftLoading } = useActiveShift();
  const { personnelWithStatus, loading: personnelLoading } =
    usePersonnelStatus();
  const { notes, loading: notesLoading } = useRecentCQNotes(10);

  if (shiftLoading || personnelLoading || notesLoading) {
    return <Loading />;
  }

  // Calculate status counts
  const statusCounts = personnelWithStatus.reduce((acc, person) => {
    acc[person.status] = (acc[person.status] || 0) + 1;
    return acc;
  }, {});

  function formatTime(timestamp) {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">CQ Tracker</h1>
        <p className="text-gray-600">Personnel accountability and status</p>
      </div>

      {/* Self Sign-Out Section */}
      <div className="mb-6">
        <SelfSignOutForm />
      </div>

      {/* Current Shift Info */}
      {activeShift && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Current CQ Shift
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">CQ 1:</span>{" "}
                {activeShift.assignee1Name || activeShift.cqNcoName}
              </div>
              {(activeShift.assignee2Name || activeShift.cqRunnerName) && (
                <div className="text-sm">
                  <span className="font-medium">CQ 2:</span>{" "}
                  {activeShift.assignee2Name || activeShift.cqRunnerName}
                </div>
              )}
              <div className="text-sm text-gray-600">
                {formatTime(activeShift.startTime)} -{" "}
                {formatTime(activeShift.endTime)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      )}

      {!activeShift && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center text-gray-500">
          No active CQ shift at this time.
        </div>
      )}

      {/* Status Summary */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Personnel Status Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(STATUS_TYPES).map(([key, { label }]) => (
            <div key={key} className={`p-3 rounded-lg ${STATUS_COLORS[key]}`}>
              <div className="text-2xl font-bold">{statusCounts[key] || 0}</div>
              <div className="text-sm">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Personnel List (Read-only) */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Personnel Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {personnelWithStatus.length === 0 ? (
                <tr>
                  <td
                    colSpan="3"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No personnel records found.
                  </td>
                </tr>
              ) : (
                personnelWithStatus.map((person) => (
                  <tr key={person.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {person.rank && `${person.rank} `}
                        {person.lastName}, {person.firstName}
                      </div>
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
                        <span>{person.statusDetails.destination}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Notes (Read-only) */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Recent CQ Notes</h3>
        </div>
        {notes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent notes.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notes.map((note) => (
              <div key={note.id} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                      NOTE_TYPE_COLORS[note.type]
                    }`}
                  >
                    {NOTE_TYPES[note.type]?.label || note.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {note.timestamp?.toDate
                      ? note.timestamp.toDate().toLocaleString()
                      : ""}
                  </span>
                </div>
                <p className="text-gray-900">{note.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
