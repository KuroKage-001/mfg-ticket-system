/**
 * FloatingCreateButton — fixed chat-bubble-style FAB in the bottom-right
 * corner of every authenticated page.
 *
 * Clicking it opens the CreateTicketModal. After a successful creation the
 * timer is automatically started for the new ticket, then the user is
 * navigated to the ticket detail page.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateTicketModal from './CreateTicketModal';
import { useTicketTimer } from '../../hooks/system-hooks/useTicketTimer';
import type { TicketDetail } from '../../services/system-api-services/ticket.service';

// ---------------------------------------------------------------------------
// Internal bridge: starts the timer for a newly created ticket then notifies
// the parent so it can navigate.  Rendered only briefly (unmounts after done).
// ---------------------------------------------------------------------------

interface TimerBridgeProps {
  ticketId: number;
  externalId: string;
  onReady: (ticketId: number) => void;
}

function TimerBridge({ ticketId, externalId, onReady }: TimerBridgeProps): null {
  const { start } = useTicketTimer(ticketId);

  useEffect(() => {
    start(externalId);
    onReady(ticketId);
  // We intentionally run this only once on mount — start/onReady are stable refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// NavigateBridge: navigates to the ticket detail page WITHOUT starting a
// timer.  Used when a ticket is created without an assignee (status = OPEN).
// ---------------------------------------------------------------------------

interface NavigateBridgeProps {
  ticketId: number;
  onReady: (ticketId: number) => void;
}

function NavigateBridge({ ticketId, onReady }: NavigateBridgeProps): null {
  useEffect(() => {
    onReady(ticketId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// FloatingCreateButton
// ---------------------------------------------------------------------------

function FloatingCreateButton(): React.ReactElement {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pendingTicket, setPendingTicket] = useState<{ id: number; externalId: string; autoStart: boolean } | null>(null);

  const handleCreated = useCallback((ticket: TicketDetail, externalId: string, autoStart: boolean): void => {
    setPendingTicket({ id: ticket.id, externalId, autoStart });
  }, []);

  const handleTimerReady = useCallback((ticketId: number): void => {
    setPendingTicket(null);
    setIsModalOpen(false);
    navigate(`/tickets/${ticketId}`);
  }, [navigate]);

  return (
    <>
      {/* FAB — chat bubble shape */}
      <button
        type="button"
        onClick={() => { setIsModalOpen(true); }}
        aria-label="Create new ticket"
        title="Create new ticket"
        className="fixed bottom-6 right-6 z-40 group flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg ring-1 ring-gray-700 hover:bg-gray-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200"
      >
        {/* Clipboard-check icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>

        {/* Chat bubble tail — rotated square peeking from bottom-right */}
        <span
          className="absolute -bottom-1.5 right-2 h-3.5 w-3.5 rotate-45 rounded-sm bg-gray-900"
          aria-hidden="true"
        />
      </button>

      {/* Hover tooltip */}
      <div className="fixed bottom-21 right-6 z-40 pointer-events-none" aria-hidden="true">
        <span className="inline-block rounded-md bg-gray-800 px-2.5 py-1 text-xs font-medium text-white shadow opacity-0 transition-opacity whitespace-nowrap">
          New Ticket
        </span>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CreateTicketModal
          onClose={() => {
            if (pendingTicket === null) setIsModalOpen(false);
          }}
          onCreated={handleCreated}
        />
      )}

      {/* Timer bridge — mounts only after creation with an assignee, unmounts once timer is started */}
      {pendingTicket !== null && pendingTicket.autoStart && (
        <TimerBridge
          ticketId={pendingTicket.id}
          externalId={pendingTicket.externalId}
          onReady={handleTimerReady}
        />
      )}

      {/* No-timer bridge — for unassigned tickets, just navigate without starting the timer */}
      {pendingTicket !== null && !pendingTicket.autoStart && (
        <NavigateBridge
          ticketId={pendingTicket.id}
          onReady={handleTimerReady}
        />
      )}
    </>
  );
}

export default FloatingCreateButton;
