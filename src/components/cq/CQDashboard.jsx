import {
  usePersonnelStatus,
  STATUS_TYPES,
  PASS_STAGES,
} from "../../hooks/usePersonnelStatus";
import { useActiveShift, useCQShifts } from "../../hooks/useCQShifts";
import { useRecentCQNotes, NOTE_TYPES } from "../../hooks/useCQNotes";
import Loading from "../common/Loading";

const STATUS_COLORS = {
  present: "bg-green-500",
  pass: "bg-yellow-500",
  // leave: 'bg-blue-500',
  // tdy: 'bg-purple-500',
  sick_call: "bg-orange-500",
};

const NOTE_TYPE_COLORS = {
  routine: "bg-gray-100 text-gray-800",
  incident: "bg-red-100 text-red-800",
  visitor: "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  other: "bg-gray-100 text-gray-800",
};

export default function CQDashboard() {
  const { personnelWithStatus, loading: personnelLoading } =
    usePersonnelStatus();
  const { activeShift, loading: shiftLoading } = useActiveShift();
  const { shifts } = useCQShifts();
  const { notes, loading: notesLoading } = useRecentCQNotes(5);

  if (personnelLoading || shiftLoading || notesLoading) {
    return <Loading />;
  }

  // Calculate status counts
  const statusCounts = personnelWithStatus.reduce((acc, person) => {
    acc[person.status] = (acc[person.status] || 0) + 1;
    return acc;
  }, {});

  const totalPersonnel = personnelWithStatus.length;
  const presentCount = statusCounts.present || 0;
  const outCount = totalPersonnel - presentCount;

  // Find next upcoming shift
  const nextShift = shifts.find((s) => s.status === "upcoming");

  function formatDateTime(timestamp) {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }

  function formatTime(timestamp) {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-3xl font-bold text-green-600">
            {presentCount}
          </div>
          <div className="text-sm text-gray-600">Present</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-3xl font-bold text-yellow-600">{outCount}</div>
          <div className="text-sm text-gray-600">Signed Out</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-3xl font-bold text-blue-600">
            {totalPersonnel}
          </div>
          <div className="text-sm text-gray-600">Total Personnel</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-3xl font-bold text-purple-600">
            {notes.length}
          </div>
          <div className="text-sm text-gray-600">Recent Notes</div>
        </div>
      </div>

      {/* Status Breakdown Bar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Personnel Status Breakdown
        </h3>
        <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
          {Object.entries(STATUS_TYPES).map(([key]) => {
            const count = statusCounts[key] || 0;
            const percentage =
              totalPersonnel > 0 ? (count / totalPersonnel) * 100 : 0;
            if (percentage === 0) return null;
            return (
              <div
                key={key}
                className={`${STATUS_COLORS[key]} transition-all`}
                style={{ width: `${percentage}%` }}
                title={`${STATUS_TYPES[key].label}: ${count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          {Object.entries(STATUS_TYPES).map(([key, { label }]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[key]}`} />
              <span>
                {label}: {statusCounts[key] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current/Next Shift */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {activeShift ? "Current Shift" : "Next Shift"}
          </h3>
          {activeShift ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Active
                </span>
              </div>
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
          ) : nextShift ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  Upcoming
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">CQ 1:</span>{" "}
                {nextShift.assignee1Name || nextShift.cqNcoName}
              </div>
              {(nextShift.assignee2Name || nextShift.cqRunnerName) && (
                <div className="text-sm">
                  <span className="font-medium">CQ 2:</span>{" "}
                  {nextShift.assignee2Name || nextShift.cqRunnerName}
                </div>
              )}
              <div className="text-sm text-gray-600">
                Starts: {formatDateTime(nextShift.startTime)}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No shifts scheduled</p>
          )}
        </div>

        {/* Recent Notes */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          {notes.length === 0 ? (
            <p className="text-gray-500">No recent notes</p>
          ) : (
            <div className="space-y-3">
              {notes.slice(0, 5).map((note) => (
                <div
                  key={note.id}
                  className="border-l-2 border-gray-200 pl-3 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        NOTE_TYPE_COLORS[note.type]
                      }`}
                    >
                      {NOTE_TYPES[note.type]?.label || note.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {note.timestamp?.toDate
                        ? note.timestamp.toDate().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                    {note.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Personnel Out Summary */}
      {outCount > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Personnel Currently Out
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {personnelWithStatus
              .filter((p) => p.status !== "present")
              .map((person) => (
                <div
                  key={person.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="font-medium text-gray-900">
                    {person.rank && `${person.rank} `}
                    {person.lastName}, {person.firstName}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[
                        person.status
                      ]
                        .replace("bg-", "bg-")
                        .replace(
                          "500",
                          "100",
                        )} ${STATUS_COLORS[person.status].replace("bg-", "text-").replace("500", "800")}`}
                    >
                      {person.status === "pass" && person.statusDetails?.destination
                        ? person.statusDetails.destination
                        : STATUS_TYPES[person.status]?.label}
                    </span>
                    {person.status === "pass" &&
                      person.statusDetails?.passStage && (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            person.statusDetails.passStage === "arrived"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {PASS_STAGES[person.statusDetails.passStage]?.label ||
                            person.statusDetails.passStage}
                        </span>
                      )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
