/**
 * PrioritySelector — admin component for updating a ticket's priority.
 *
 * Renders a dropdown with LOW / MEDIUM / HIGH / URGENT.
 * Calls updateTicket(ticketId, { priority }) immediately on change.
 * Shows inline error on failure and reverts to the previous value.
 * Disables the select while the request is in-flight.
 */

import { useState } from 'react';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import { updateTicket } from '../../services/admin-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';

interface PrioritySelectorProps {
  ticketId: number;
  currentPriority: string;
  onUpdated: (updatedTicket: TicketDetail) => void;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

function PrioritySelector({
  ticketId,
  currentPriority,
  onUpdated,
}: PrioritySelectorProps): React.ReactElement {
  const [priority, setPriority] = useState<string>(currentPriority);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function handleChange(newPriority: string): Promise<void> {
    const previousPriority = priority;
    setPriority(newPriority);
    setIsLoading(true);
    setError('');

    try {
      const updatedTicket = await updateTicket(ticketId, { priority: newPriority });
      onUpdated(updatedTicket);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to update priority.');
      // Revert to previous value on error
      setPriority(previousPriority);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <label
          htmlFor="priority-selector"
          className="text-sm font-medium text-gray-600 whitespace-nowrap"
        >
          Priority
        </label>
        <div className="relative flex items-center">
          <select
            id="priority-selector"
            value={priority}
            onChange={(e) => void handleChange(e.target.value)}
            disabled={isLoading}
            className="block rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          {isLoading && (
            <span className="ml-2 text-xs text-gray-400 whitespace-nowrap">Saving…</span>
          )}
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type { PrioritySelectorProps };
export { PrioritySelector };
export default PrioritySelector;
