/**
 * TicketTimer — live elapsed timer with type-aware completion labels.
 *
 *  INCIDENT → "Resolve" button, "Resolved in X" when done
 *  TASK     → "Close"   button, "Closed in X"   when done
 *  others   → "Mark Done",     "Done in X"
 *
 * compact=true  → inline table-row variant (pulsing dot + elapsed + action)
 * compact=false → full card variant for the detail page
 */

import {
  useTicketTimer,
  formatDuration,
  doneActionLabel,
  doneStateLabel,
  ticketTypeLabel,
  type TicketType,
} from '../../hooks/system-hooks/useTicketTimer';

// ---------------------------------------------------------------------------
// Type badge colours (matches CreateTicketModal)
// ---------------------------------------------------------------------------

const TYPE_BADGE: Record<TicketType, string> = {
  INCIDENT: 'bg-red-100 text-red-700 ring-red-200',
  TASK:     'bg-blue-100 text-blue-700 ring-blue-200',
  REQUEST:  'bg-purple-100 text-purple-700 ring-purple-200',
  GENERAL:  'bg-gray-100 text-gray-500 ring-gray-200',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TicketTimerProps {
  ticketId: number;
  compact?: boolean;
  /** Optional callback fired when the user clicks the complete/done button. */
  onComplete?: () => void;
  /**
   * When provided, a "Start" button is shown while the timer has not yet been
   * started.  Pass the external ticket ID (e.g. "INC0012345") so the timer can
   * infer the ticket type from the prefix.
   *
   * If this prop is omitted the legacy "No timer" text is shown instead.
   */
  onStart?: (externalId: string) => void;
  /** External ticket ID forwarded to the timer when onStart fires. */
  externalTicketId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TicketTimer({ ticketId, compact = false, onComplete, onStart, externalTicketId = '' }: TicketTimerProps): React.ReactElement {
  const { elapsed, completedAt, startedAt, ticketType, externalId, start } =
    useTicketTimer(ticketId);

  // handleComplete signals intent only — it does NOT call complete() locally.
  // The caller (TimerCell) is responsible for calling completeTimer() only
  // after the API call succeeds. This prevents the timer from showing
  // "Resolved" before the server has confirmed the status change.
  const handleComplete = (): void => {
    onComplete?.();
  };

  const handleStart = (): void => {
    start(externalTicketId);
    onStart?.(externalTicketId);
  };

  const actionLabel = doneActionLabel(ticketType);
  const stateLabel = doneStateLabel(ticketType);
  const typeLabel = ticketTypeLabel(ticketType);
  const badgeClass = TYPE_BADGE[ticketType];

  // ── No timer started ────────────────────────────────────────────────────
  if (startedAt === null) {
    // When an onStart handler is provided, render a clickable "Start" button.
    if (onStart) {
      if (compact) {
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleStart(); }}
            title="Start timer for this ticket"
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start
          </button>
        );
      }
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { handleStart(); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Timer
          </button>
          <span className="text-xs text-gray-400">Timer not started yet</span>
        </div>
      );
    }

    return (
      <span className={compact ? 'text-xs text-gray-400' : 'text-sm text-gray-400'}>
        No timer
      </span>
    );
  }

  // ── Completed ───────────────────────────────────────────────────────────
  if (completedAt !== null) {
    const completedDate = new Date(completedAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {stateLabel} · {formatDuration(elapsed)}
        </span>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {stateLabel} in {formatDuration(elapsed)}
          </span>
          {externalId && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
              {typeLabel}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {externalId && <span className="font-mono mr-1">{externalId}</span>}
          Completed {completedDate}
        </span>
      </div>
    );
  }

  // ── Running ─────────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 min-w-max">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        <span className="text-xs font-mono font-medium text-orange-700 tabular-nums">
          {formatDuration(elapsed)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleComplete(); }}
          title={`${actionLabel} this ticket`}
          className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors whitespace-nowrap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {actionLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
        </span>
        <span className="font-mono text-base font-semibold text-orange-700 tabular-nums">
          {formatDuration(elapsed)}
        </span>
        <span className="text-sm text-gray-500">elapsed</span>
        {externalId && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}>
            {typeLabel}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => { handleComplete(); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {actionLabel}
      </button>
    </div>
  );
}

export default TicketTimer;
