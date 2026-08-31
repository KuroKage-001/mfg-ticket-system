/**
 * CommentList — ordered list of TicketComment records.
 *
 * Renders author name, comment content, and a formatted timestamp.
 * Shows an empty-state message when the list is empty.
 */

/** Enriched comment shape — author relation included by the API response. */
export interface TicketCommentWithAuthor {
  id: number;
  content: string;
  ticketId: number;
  authorId: number;
  author: { id: number; fullName: string; email: string };
  createdAt: string;
}

interface CommentListProps {
  comments: TicketCommentWithAuthor[];
}

function CommentList({ comments }: CommentListProps): React.ReactElement {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-4">No comments yet.</p>
    );
  }

  return (
    <ol className="space-y-4">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
        >
          {/* Header: author + timestamp */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-gray-800">
              {comment.author.fullName}
            </span>
            <time
              dateTime={comment.createdAt}
              className="text-xs text-gray-400 shrink-0"
            >
              {new Date(comment.createdAt).toLocaleString()}
            </time>
          </div>

          {/* Comment body */}
          <p className="text-sm text-gray-700 whitespace-pre-wrap wrap-break-word">
            {comment.content}
          </p>
        </li>
      ))}
    </ol>
  );
}

export { CommentList };
export default CommentList;
