/**
 * EmployeeStatusActions — single action button for the assigned employee.
 *
 * The terminal state depends on ticket type (inferred from the title prefix):
 *   INC*    → Mark Resolved  (status: RESOLVED)
 *   SCTASK* → Close          (status: CLOSED)
 *   RITM*   → Close          (status: CLOSED)
 *   other   → Close          (status: CLOSED)
 *
 * Requirements: 7.1, 7.2, 7.6, 7.7
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transitionStatus } from '../../services/client-api-services/ticket.service';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';
import { inferTicketType } from '../../hooks/system-hooks/useTicketTimer';

interface EmployeeStatusActionsProps {
  ticketId: number;
  currentStatus: string;
  /** The id of the employee currently assigned to this ticket (null if unassigned). */
  assignedToId: number | null;
  /** Ticket title used to infer type (INC → RESOLVED, SCTASK/RITM → CLOSED). */
  ticketTitle: string;
  onTransitioned: (updatedTicket: TicketDetail) => void;
}

function EmployeeStatusActions({
  ticketId,
  currentStatus,
  assignedToId,
  ticketTitle,
  onTransitioned,
}: EmployeeStatusActionsProps): React.ReactElement | null {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Guard: only the assigned employee can use these actions (Req 7.6).
  if (!user || assignedToId !== user.id) return null;

  // Only show when ticket is actionable
  const canAct = currentStatus === 'IN_PROGRESS';
  if (!canAct) return null;

  // Infer ticket type from the title prefix to determine the correct target status
  const ticketType = inferTicketType(ticketTitle);
  const isIncident = ticketType === 'INCIDENT';

  // INC tickets → RESOLVED; everything else (SCTASK, RITM, GENERAL) → CLOSED
  const targetStatus = isIncident ? 'RESOLVED' : 'CLOSED';
  const buttonLabel  = isIncident ? 'Mark Resolved' : 'Close';
  const loadingLabel = isIncident ? 'Resolving…'    : 'Closing…';

  async function handleAction(): Promise<void> {
    setIsLoading(true);
    setError('');
    try {
      const updated = await transitionStatus(ticketId, targetStatus);
      onTransitioned(updated);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? `Failed to ${buttonLabel.toLowerCase()} ticket.`);
    } finally {
      setIsLoading(false);
    }
  }

  const buttonColor = isIncident
    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500';

  return (
    <div>
      <button
        type="button"
        onClick={() => { void handleAction(); }}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {loadingLabel}
          </>
        ) : (
          <>
            {isIncident ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {buttonLabel}
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
