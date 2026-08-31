/**
 * EmployeeStatusActions — single "Mark Resolved" action for the assigned employee.
 *
 * Employees always send RESOLVED to the API. The server automatically upgrades
 * SCTASK* and RITM* tickets to CLOSED in the same request, so no admin step
 * is needed for those ticket types.
 *
 * INC* tickets stay in RESOLVED until an admin closes them manually.
 *
 * Requirements: 7.1, 7.2, 7.6, 7.7
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transitionStatus } from '../../services/client-api-services/ticket.service';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';

interface EmployeeStatusActionsProps {
  ticketId: number;
  currentStatus: string;
  /** The id of the employee currently assigned to this ticket (null if unassigned). */
  assignedToId: number | null;
  onTransitioned: (updatedTicket: TicketDetail) => void;
}

function EmployeeStatusActions({
  ticketId,
  currentStatus,
  assignedToId,
  onTransitioned,
}: EmployeeStatusActionsProps): React.ReactElement | null {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Guard: only the assigned employee can use these actions (Req 7.6).
  if (!user || assignedToId !== user.id) return null;

  // Only show when ticket is actionable
  const canResolve = currentStatus === 'IN_PROGRESS';
  if (!canResolve) return null;

  async function handleResolve(): Promise<void> {
    setIsLoading(true);
    setError('');
    try {
      // Always send RESOLVED — the server auto-upgrades SCTASK/RITM to CLOSED.
      const updated = await transitionStatus(ticketId, 'RESOLVED');
      onTransitioned(updated);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to resolve ticket.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => { void handleResolve(); }}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Resolving…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark Resolved
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}

export type { EmployeeStatusActionsProps };
export { EmployeeStatusActions };
export default EmployeeStatusActions;
