/**
 * CommentForm — controlled form for posting a new comment on a ticket.
 *
 * Calls POST /api/tickets/:id/comments on submit.
 * Clears the textarea and notifies the parent via onCommentAdded on success.
 * Displays an inline error message on failure.
 */

import { useState } from 'react';
import { apiFetch } from '../../config/api.config';
import type { TicketCommentWithAuthor } from './CommentList';

const MAX_CONTENT_LENGTH = 5000;

interface CommentFormProps {
  ticketId: number;
  onCommentAdded: (comment: TicketCommentWithAuthor) => void;
}

function CommentForm({
  ticketId,
  onCommentAdded,
}: CommentFormProps): React.ReactElement {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const isDisabled = isSubmitting || trimmed.length === 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isDisabled) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await apiFetch<TicketCommentWithAuthor>(
        `/tickets/${ticketId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content: trimmed }),
        },
      );

      setContent('');
      onCommentAdded(created);
    } catch (err) {
      const apiError = err as { message?: string };
      setError(apiError.message ?? 'Failed to post comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="comment-content" className="sr-only">
          Add a comment
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            // Clear error when user starts typing again
            if (error) setError(null);
          }}
          placeholder="Write a comment…"
          maxLength={MAX_CONTENT_LENGTH}
          rows={4}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 shadow-sm resize-y focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
        />

        {/* Character count */}
        <p className="text-xs text-gray-400 text-right">
          {content.length} / {MAX_CONTENT_LENGTH}
        </p>

        {/* Inline error */}
        {error !== null && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isDisabled}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Posting…' : 'Add Comment'}
          </button>
        </div>
      </div>
    </form>
  );
}

export { CommentForm };
export default CommentForm;
