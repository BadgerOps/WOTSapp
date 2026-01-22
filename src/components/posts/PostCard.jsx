import { format } from "date-fns";

const typeLabels = {
  announcement: "Announcement",
  uotd: "UOTD",
  schedule: "Schedule",
  general: "General",
};

const slotLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const typeBadgeClasses = {
  announcement: "badge-announcement",
  uotd: "badge-uotd",
  schedule: "badge-schedule",
  general: "badge-general",
};

function getWeatherBadge(condition, temp) {
  if (!condition) return null;

  const lowerCondition = condition.toLowerCase();

  // Check for precipitation conditions first
  if (lowerCondition.includes("snow") || lowerCondition.includes("sleet")) {
    return { label: "Snow", className: "bg-slate-200 text-slate-700" };
  }
  if (
    lowerCondition.includes("rain") ||
    lowerCondition.includes("drizzle") ||
    lowerCondition.includes("shower")
  ) {
    return { label: "Wet", className: "bg-sky-200 text-sky-800" };
  }
  if (lowerCondition.includes("thunder") || lowerCondition.includes("storm")) {
    return { label: "Stormy", className: "bg-purple-200 text-purple-800" };
  }

  // Temperature-based conditions
  if (temp !== undefined && temp !== null) {
    if (temp < 45) {
      return { label: "Cold", className: "bg-blue-200 text-blue-800" };
    }
    if (temp < 60) {
      return { label: "Cool", className: "bg-cyan-100 text-cyan-700" };
    }
    if (temp < 80) {
      return { label: "Warm", className: "bg-amber-100 text-amber-700" };
    }
    return { label: "Hot", className: "bg-red-200 text-red-800" };
  }

  // Default to condition name if no temp
  return { label: condition, className: "bg-gray-100 text-gray-700" };
}

export default function PostCard({ post }) {
  const createdAt = post.createdAt?.toDate
    ? post.createdAt.toDate()
    : new Date(post.createdAt);

  // Use publishedAt for display if available (more accurate for UOTD)
  const publishedAt = post.publishedAt
    ? post.publishedAt.toDate
      ? post.publishedAt.toDate()
      : new Date(post.publishedAt)
    : createdAt;

  return (
    <article className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={typeBadgeClasses[post.type] || "badge-general"}>
            {typeLabels[post.type] || post.type}
          </span>
          {post.type === "uotd" && post.targetSlot && (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              {slotLabels[post.targetSlot] || post.targetSlot}
            </span>
          )}
          {post.type === "uotd" && post.weatherCondition && (() => {
            const badge = getWeatherBadge(post.weatherCondition, post.weatherTemp);
            return badge ? (
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
                {badge.label}
              </span>
            ) : null;
          })()}
        </div>
        <time className="text-xs text-gray-500">
          {"Posted at"}{" "}
          <span className="text-gray-600">{format(publishedAt, "HHmm")}</span>
          {"h on "}
          <span>{format(publishedAt, "MMM d, yyyy")}</span>
        </time>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h2>

      <div className="text-gray-700 whitespace-pre-wrap">{post.content}</div>

      {post.adminNote && post.adminNote.trim() && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <span className="font-medium">Note: </span>
          {post.adminNote}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
        {post.weatherBased && post.approvedByName ? (
          <span>Weather-based UOTD approved by {post.approvedByName}</span>
        ) : (
          <span>Posted by {post.authorName || "Unknown"}</span>
        )}
      </div>
    </article>
  );
}
