/**
 * StatusTransitionButtons — admin component for transitioning a ticket's status.
 *
 * Derives valid next statuses from the client-side ADMIN transition table.
 * Calls transitionStatus(ticketId, status) on click.
 * Shows inline error on failure; loading state on the active button.
 *
 * ADMIN transition table:
 *   OPEN        → RESOLVED, CLOSED, CANCELLED
 *   IN_PROGRESS → RESOLVED, CLOSED, CANCELLED
 *   RESOLVED    → CLOSED,   IN_PROGRESS (reopen)
 *   CLOSED      → IN_PROGRESS (reopen)
 *   CANCELLED   → IN_PROGRESS (reopen)
 */

import { useState } from 'react';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import { transitionStatus } from '../../services/admin-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';

interface StatusTransitionButtonsProps {
  ticketId: number;
  currentStatus: string;
  onTransitioned: (updatedTicket: TicketDetail) => void;
}

// ---------------------------------------------------------------------------
// ADMIN transition table (client-side copy)
// ---------------------------------------------------------------------------
const ADMIN_TRANSITIONS: Record<string, string[]> = {
  OPEN:        ['RESOLVED', 'CLOSED', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED', 'CANCELLED'],
  RESOLVED:    ['CLOSED',   'IN_PROGRESS'],
  CLOSED:      ['IN_PROGRESS'],
  CANCELLED:   ['IN_PROGRESS'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable button label for a target status. */
function statusLabel(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'Mark In Progress';
    case 'RESOLVED':    return 'Mark Resolved';
    case 'CLOSED':      return 'Close';
    case 'CANCELLED':   return 'Cancel';
    case 'OPEN':        return 'Reopen';
    default:            return status;
  }
}

/** TailwindCSS colour scheme for a target status button. */
function statusButtonClass(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white';
    case 'RESOLVED':    return 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white';
    case 'CLOSED':      return 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-400 text-white';
    case 'CANCELLED':   return 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white';
    case 'OPEN':        return 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white';
    default:            return 'bg-gray-400 hover:bg-gray-500 focus:ring-gray-300 text-white';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function StatusTransitionButtons({
  ticketId,
  currentStatus,
  onTransitioned,
}: StatusTransitionButtonsProps): React.ReactElement {
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const nextStatuses: string[] = ADMIN_TRANSITIONS[currentStatus] ?? [];
  const isAnyLoading = loadingStatus !== null;

  async function handleTransition(targetStatus: string): Promise<void> {
    setLoadingStatus(targetStatus);
    setError('');

    try {
      const updatedTicket = await transitionStatus(ticketId, targetStatus);
      onTransitioned(updatedTicket);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to update status.');
    } finally {
      setLoadingStatus(null);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <div className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-500">
        No further status transitions available for this ticket.
      </div>
    );
  }

  // Separate reopen from forward-progress actions for clearer UX
  const forwardStatuses = nextStatuses.filter((s) => s !== 'IN_PROGRESS');
  const canReopen = nextStatuses.includes('IN_PROGRESS');

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {forwardStatuses.map((status) => {
          const isLoading = loadingStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => void handleTransition(status)}
              disabled={isAnyLoading}
              className={[
                'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
                statusButtonClass(status),
                isAnyLoading ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ').trim()}
            >
              {isLoading ? 'Updating…' : statusLabel(status)}
            </button>
          );
        })}
      </div>

      {/* Reopen — shown separately with a divider */}
      {canReopen && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="mb-1.5 text-xs text-gray-400">Reopen ticket</p>
          <button
            type="button"
            onClick={() => void handleTransition('IN_PROGRESS')}
            disabled={isAnyLoading}
            className={[
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
              statusButtonClass('IN_PROGRESS'),
              isAnyLoading ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ').trim()}
          >
            {loadingStatus === 'IN_PROGRESS' ? 'Reopening…' : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reopen
              </>
            )}
          </button>
        </div>
      )}

      {/* Inline error */}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type { StatusTransitionButtonsProps };
export { StatusTransitionButtons };
export default StatusTransitionButtons;
