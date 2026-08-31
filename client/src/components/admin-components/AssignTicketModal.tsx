/**
 * AssignTicketModal — admin component for assigning a ticket to an employee.
 *
 * Opens a modal with a dropdown of active EMPLOYEE users.
 * Calls assignTicket(ticketId, selectedUserId) on submit.
 * Shows inline error on 422/404 responses.
 */

import { useState, useEffect } from 'react';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';
import type { SafeUser } from '../../services/system-api-services/auth.service';
import { listUsers } from '../../services/admin-api-services/user.service';
import { assignTicket } from '../../services/admin-api-services/ticket.service';
import type { ApiError } from '../../config/api.config';

interface AssignTicketModalProps {
  ticketId: number;
  currentAssigneeId: number | null;
  onAssigned: (updatedTicket: TicketDetail) => void;
}

function AssignTicketModal({
  ticketId,
  currentAssigneeId,
  onAssigned,
}: AssignTicketModalProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(currentAssigneeId);
  const [isFetchingUsers, setIsFetchingUsers] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch active employees when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsFetchingUsers(true);
    setError('');

    listUsers({ role: 'EMPLOYEE', isActive: true, limit: 100 })
      .then((result) => {
        if (!cancelled) {
          setUsers(result.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load users.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetchingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  function handleOpen(): void {
    setSelectedUserId(currentAssigneeId);
    setError('');
    setIsOpen(true);
  }

  function handleClose(): void {
    if (isSubmitting) return;
    setIsOpen(false);
    setError('');
  }

  async function handleSubmit(): Promise<void> {
    if (selectedUserId === null) {
      setError('Please select an employee to assign.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const updatedTicket = await assignTicket(ticketId, selectedUserId);
      onAssigned(updatedTicket);
      setIsOpen(false);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to assign ticket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
      >
        Assign Ticket
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* Modal panel */}
          <div className="relative z-10 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2
              id="assign-modal-title"
              className="mb-4 text-base font-semibold text-gray-900"
            >
              Assign Ticket #{ticketId}
            </h2>

            {/* User dropdown */}
            {isFetchingUsers ? (
              <p className="mb-4 text-sm text-gray-500 opacity-50">Loading employees…</p>
            ) : (
              <div className="mb-4">
                <label
                  htmlFor="assign-employee-select"
                  className="mb-1 block text-xs font-medium text-gray-600"
                >
                  Employee
                </label>
                <select
                  id="assign-employee-select"
                  value={selectedUserId ?? ''}
                  onChange={(e) =>
                    setSelectedUserId(e.target.value === '' ? null : Number(e.target.value))
                  }
                  disabled={isSubmitting}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">— Unassigned —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Inline error */}
            {error && (
              <p className="mb-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isFetchingUsers || isSubmitting || selectedUserId === null}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export type { AssignTicketModalProps };
export { AssignTicketModal };
export default AssignTicketModal;
