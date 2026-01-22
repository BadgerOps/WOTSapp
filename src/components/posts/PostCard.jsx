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
