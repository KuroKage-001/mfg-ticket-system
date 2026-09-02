/**
 * TicketListPage — tabbed ticket list with separate views for
 * Incidents, Tasks, Requests, and All tickets.
 *
 * Tab filtering is done client-side using the localStorage timer records
 * (which store the ticket type inferred from the external ID prefix).
 * Tickets that have no timer record appear only in the "All" tab.
 *
 * Each tab shows a dedicated table with columns relevant to that type:
 *  - Incidents  : Ticket # | External ID | Title | Status | Priority | Timer (→ Resolved)
 *  - Tasks      : Ticket # | External ID | Title | Status | Priority | Timer (→ Closed)
 *  - Requests   : Ticket # | External ID | Title | Status | Priority | Timer (→ Done)
 *  - All        : Ticket # | Type | Title | Status | Priority | Assignee | Created | Timer
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import { useTickets } from '../../hooks/system-hooks/useTickets';
import type { TicketSummary, TicketListQuery } from '../../services/system-api-services/ticket.service';
import { transitionStatus, selfAssignTicket } from '../../services/client-api-services/ticket.service';
import { useTicketTimer } from '../../hooks/system-hooks/useTicketTimer';
import PaginationControls from '../../components/system-components/PaginationControls';
import TicketStatusBadge from '../../components/system-components/TicketStatusBadge';
import TicketPriorityBadge from '../../components/system-components/TicketPriorityBadge';
import TicketTimer from '../../components/system-components/TicketTimer';
import {
  inferTicketType,
  ticketTypeLabel,
  type TicketType,
} from '../../hooks/system-hooks/useTicketTimer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const STATUS_LABELS: Record<string, string> = {
  '': 'All Statuses',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  '': 'All Priorities',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const PAGE_LIMIT = 15;

type TabId = 'ALL' | 'INCIDENT' | 'TASK' | 'REQUEST';

const TABS: { id: TabId; label: string; badgeClass: string }[] = [
  { id: 'ALL',      label: 'All',       badgeClass: 'bg-gray-100 text-gray-600' },
  { id: 'INCIDENT', label: 'Incidents', badgeClass: 'bg-red-100 text-red-700' },
  { id: 'TASK',     label: 'Tasks',     badgeClass: 'bg-blue-100 text-blue-700' },
  { id: 'REQUEST',  label: 'Requests',  badgeClass: 'bg-purple-100 text-purple-700' },
];

const TYPE_BADGE: Record<TicketType, string> = {
  INCIDENT: 'bg-red-100 text-red-700 ring-red-200',
  TASK:     'bg-blue-100 text-blue-700 ring-blue-200',
  REQUEST:  'bg-purple-100 text-purple-700 ring-purple-200',
  GENERAL:  'bg-gray-100 text-gray-500 ring-gray-200',
};

// ---------------------------------------------------------------------------
// ConfirmResolveModal
// ---------------------------------------------------------------------------

interface ConfirmResolveModalProps {
  ticketNumber: string;
  actionLabel: string;
  /** When set, the ticket belongs to someone else — show the two-option layout */
  assigneeName: string | null;
  onResolveOnly: () => void;
  onAssignAndResolve: () => void;
  onCancel: () => void;
}

function ConfirmResolveModal({
  ticketNumber,
  actionLabel,
  assigneeName,
  onResolveOnly,
  onAssignAndResolve,
  onCancel,
}: ConfirmResolveModalProps): React.ReactElement {
  const block = (e: React.MouseEvent): void => { e.stopPropagation(); e.preventDefault(); };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const isOthersTicket = assigneeName !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-resolve-title"
      onClick={block}
      onMouseDown={block}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={(e) => { block(e); onCancel(); }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 p-6" onClick={block}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 id="confirm-resolve-title" className="text-sm font-semibold text-gray-900">
              {actionLabel} ticket {ticketNumber}?
            </h2>
            {isOthersTicket ? (
              <p className="mt-1 text-sm text-gray-500">
                This ticket is currently assigned to{' '}
                <span className="font-medium text-gray-700">{assigneeName}</span>.
                How would you like to proceed?
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">
                This will mark the ticket as {actionLabel.toLowerCase()}d and stop the timer.
                This action is logged in the activity feed.
              </p>
            )}
          </div>
        </div>

        {/* Two-option layout for other people's tickets */}
        {isOthersTicket ? (
          <div className="space-y-2 mb-4">
            <button
              type="button"
              onClick={(e) => { block(e); onAssignAndResolve(); }}
              className="w-full flex items-start gap-3 rounded-lg border-2 border-green-200 bg-green-50 px-4 py-3 text-left hover:border-green-400 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-800">Assign to Me + {actionLabel}</p>
                <p className="text-xs text-green-700 mt-0.5">Reassign this ticket to yourself, then {actionLabel.toLowerCase()} it.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => { block(e); onResolveOnly(); }}
              className="w-full flex items-start gap-3 rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 text-left hover:border-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-700">{actionLabel} Only</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {actionLabel} without changing the assignment. Ticket stays assigned to{' '}
                  <span className="font-medium">{assigneeName}</span>.
                </p>
              </div>
            </button>
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { block(e); onCancel(); }}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Cancel
          </button>
          {/* Simple confirm — only shown for own/unassigned tickets */}
          {!isOthersTicket && (
            <button
              type="button"
              onClick={(e) => { block(e); onResolveOnly(); }}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            >
              Yes, {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimerCell — wraps TicketTimer per row so hooks can be called per-ticket.
// Handles the Start action: starts the local timer AND transitions status
// from OPEN → IN_PROGRESS on the server.
// ---------------------------------------------------------------------------

interface TimerCellProps {
  ticket: TicketSummary;
  externalId: string;
  compact: boolean;
  /**
   * Called when the timer action button is clicked.
   * Receives a `completeTimer` function — call it to mark the local timer as
   * done.  Separating the intent signal from the actual completion allows the
   * caller to show a confirmation dialog first and only commit on confirm.
   */
  onCompleteIntent: (completeTimer: () => void) => void;
  onStarted: () => void;
}

function TimerCell({ ticket, externalId, compact, onCompleteIntent, onStarted }: TimerCellProps): React.ReactElement {
  const { startedAt, completedAt, start, complete, reset } = useTicketTimer(ticket.id);
  const isStartingRef = useRef(false);
  const [starting, setStarting] = useState(false);

  // Remove stale localStorage records when the server says the ticket is OPEN
  // (e.g. after a DB reset or ID reuse), but ONLY when we are not in the
  // middle of starting the timer ourselves.
  useEffect(() => {
    if (ticket.status === 'OPEN' && startedAt !== null && !isStartingRef.current) {
      reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.status, startedAt]);

  // Auto-complete the local timer when the server confirms the ticket is
  // terminal (RESOLVED / CLOSED / CANCELLED) but the localStorage record
  // is still running (completedAt === null). This handles the case where
  // the user resolves/closes from the confirm modal and the API succeeds but
  // the completeTimer callback wasn't invoked (e.g. page refresh, or the
  // ticket was closed externally).
  useEffect(() => {
    const isTerminal =
      ticket.status === 'RESOLVED' ||
      ticket.status === 'CLOSED' ||
      ticket.status === 'CANCELLED';
    if (isTerminal && startedAt !== null && completedAt === null && !isStartingRef.current) {
      complete();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.status, startedAt, completedAt]);

  // Show Start button when:
  //  - ticket is OPEN and no timer has been started yet (normal first start)
  //  - ticket is IN_PROGRESS and no timer record exists (after a reopen)
  const isStartable =
    (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && startedAt === null;

  const handleStart = useCallback(async (extId: string): Promise<void> => {
    isStartingRef.current = true;
    setStarting(true);
    try {
      start(extId);
      // Only transition OPEN→IN_PROGRESS; reopened tickets are already IN_PROGRESS
      if (ticket.status === 'OPEN') {
        await transitionStatus(ticket.id, 'IN_PROGRESS');
      }
      onStarted();
    } catch {
      onStarted();
    } finally {
      setStarting(false);
      setTimeout(() => { isStartingRef.current = false; }, 0);
    }
  }, [ticket.id, ticket.status, start, onStarted]);

  // Called by TicketTimer when the user clicks the action button (Resolve / Close / Mark Done).
  // We do NOT call complete() here — instead we pass a completeTimer callback to
  // onCompleteIntent so the parent can confirm first, then call it on approval.
  const handleCompleteIntent = useCallback((): void => {
    onCompleteIntent(() => { complete(); });
  }, [onCompleteIntent, complete]);

  if (starting) {
    return <span className="text-xs text-gray-400 animate-pulse">Starting…</span>;
  }

  return (
    <TicketTimer
      ticketId={ticket.id}
      compact={compact}
      onComplete={handleCompleteIntent}
      {...(isStartable ? {
        onStart: (extId) => { void handleStart(extId); },
        externalTicketId: externalId,
      } : {})}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers — read all timer records from localStorage
// ---------------------------------------------------------------------------

interface StoredTimerRecord {
  ticketType: TicketType;
  externalId: string;
  completedAt: string | null;
}

function readAllTimerRecords(): Map<number, StoredTimerRecord> {
  const map = new Map<number, StoredTimerRecord>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('ticket_timer_')) continue;
      const ticketId = parseInt(key.replace('ticket_timer_', ''), 10);
      if (isNaN(ticketId)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<StoredTimerRecord>;
      map.set(ticketId, {
        ticketType: parsed.ticketType ?? 'GENERAL',
        externalId: parsed.externalId ?? '',
        completedAt: parsed.completedAt ?? null,
      });
    }
  } catch {
    // ignore
  }
  return map;
}

// ---------------------------------------------------------------------------
// TicketListPage
// ---------------------------------------------------------------------------

function TicketListPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('ALL');

  // Filters
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  // "My Tickets" — when true, only tickets created by the current user are shown
  const [myTickets, setMyTickets] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Read ?myTickets=1 from the URL on first mount so the banner link
  // lands directly in the filtered view.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('myTickets') === '1') {
      setMyTickets(true);
      setActiveTab('ALL');
    }
    // Only run on mount — location.search intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inline resolve state
  const [, setResolvingId] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string>('');

  // Confirmation dialog state
  const pendingCompleteTimerRef = useRef<(() => void) | null>(null);
  const confirmOpenRef = useRef(false);
  const [confirmResolve, setConfirmResolve] = useState<{
    ticketId: number;
    ticketNumber: string;
    actionLabel: string;
    /** null = own/unassigned ticket; string = someone else's assignee name */
    assigneeName: string | null;
    proceedOnly: () => void;
    proceedWithAssign: () => void;
  } | null>(null);

  // Bump to force re-fetch after an inline resolve
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Re-fetch on every mount so navigating back from TicketDetailPage
  // always shows the latest status from the server.
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const query: TicketListQuery = {
    page,
    limit: PAGE_LIMIT,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(myTickets && user?.id ? { createdById: user.id } : {}),
    ...(user?.role === 'ADMIN' && assignedToId.trim()
      ? { assignedToId: Number(assignedToId) }
      : {}),
  };

  const { data, loading, error } = useTickets(query, refreshKey);

  // All tickets from API — declared early so callbacks below can reference it
  const allTickets = data?.data ?? [];
  const total = data?.total ?? 0;

  // Read timer records once per render for type filtering
  const timerRecords = useMemo(() => readAllTimerRecords(), [data]);

  // Perform the actual resolve API call — called directly when no confirmation
  // needed, or after the user confirms in the dialog.
  // `completeTimer` is called after a successful API transition to mark the
  // local timer as done; it is a no-op when undefined (e.g. called from an
  // external source rather than the timer button).
  // `note` is an optional free-text string logged as a FIELD_UPDATED activity
  // on the server so the activity feed records which modal option was chosen.
  const executeResolve = useCallback(async (ticketId: number, completeTimer?: () => void, assignFirst = false, note?: string): Promise<void> => {
    setResolvingId(ticketId);
    setResolveError('');
    try {
      const record = readAllTimerRecords().get(ticketId);
      const type = record?.ticketType ?? inferTicketType(
        allTickets.find((t) => t.id === ticketId)?.title ?? ''
      );
      const isAdmin = user?.role === 'ADMIN';
      const targetStatus = (isAdmin && type === 'TASK') ? 'CLOSED' : 'RESOLVED';
      // Self-assign first if requested, then transition status
      if (assignFirst) {
        await selfAssignTicket(ticketId);
      }
      await transitionStatus(ticketId, targetStatus, note);
      completeTimer?.();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      const msg = apiErr.message ?? '';
      const isAlreadyTerminal =
        msg.includes('422') ||
        /invalid transition/i.test(msg) ||
        /not allowed/i.test(msg) ||
        /already/i.test(msg);
      if (!isAlreadyTerminal) {
        setResolveError(msg || 'Failed to update ticket status.');
      }
    } finally {
      setRefreshKey((k) => k + 1);
      setResolvingId(null);
    }
  }, [user, allTickets]);

  // Called by TimerCell when the user clicks the action button.
  // Always shows a confirmation dialog before executing the resolve/close.
  const handleInlineResolve = useCallback((ticketId: number, e: React.MouseEvent, ticket?: TicketSummary, completeTimer?: () => void): void => {
    e.stopPropagation();
    e.preventDefault();

    if (confirmOpenRef.current) return;

    const t = ticket ?? allTickets.find((tk) => tk.id === ticketId);
    if (!t) { void executeResolve(ticketId, completeTimer); return; }

    const record = readAllTimerRecords().get(ticketId);
    const type = record?.ticketType ?? inferTicketType(t.title);
    const isAdmin = user?.role === 'ADMIN';
    const actionLabel = (isAdmin && type === 'TASK') ? 'Close' : type === 'INCIDENT' ? 'Resolve' : 'Close';

    // Determine if this ticket belongs to someone else
    const isOwnOrUnassigned = t.assignedToId === null || t.assignedToId === user?.id;
    const assigneeName = isOwnOrUnassigned ? null : (t.assignedToName ?? 'another user');

    pendingCompleteTimerRef.current = completeTimer ?? null;
    confirmOpenRef.current = true;

    const dismiss = (): void => {
      pendingCompleteTimerRef.current = null;
      confirmOpenRef.current = false;
      setConfirmResolve(null);
    };

    setConfirmResolve({
      ticketId,
      ticketNumber: t.ticketNumber,
      actionLabel,
      assigneeName,
      proceedOnly: () => {
        const cb = pendingCompleteTimerRef.current;
        dismiss();
        void executeResolve(ticketId, cb ?? undefined, false, `${actionLabel} Only`);
      },
      proceedWithAssign: () => {
        const cb = pendingCompleteTimerRef.current;
        dismiss();
        void executeResolve(ticketId, cb ?? undefined, true, `Assign to Me + ${actionLabel}`);
      },
    });
  }, [user, allTickets, executeResolve]);

  // Reset page on filter changes
  const handleFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const handleMyTicketsToggle = (): void => {
    setMyTickets((prev) => {
      const next = !prev;
      // My Tickets is a cross-type filter — always show in All tab
      if (next) setActiveTab('ALL');
      return next;
    });
    setPage(1);
  };

  const handleTabChange = (tab: TabId): void => {
    setActiveTab(tab);
    setPage(1);
  };

  // Filter to the active tab
  const visibleTickets = useMemo((): TicketSummary[] => {
    if (activeTab === 'ALL') return allTickets;
    return allTickets.filter((t) => {
      const record = timerRecords.get(t.id);
      // Use timer record type if available, otherwise infer directly from the title string.
      // The title is stored as the raw external ID (e.g. "INC1278770"), so inferTicketType
      // handles prefix matching without needing bracket delimiters.
      const type = record ? record.ticketType : inferTicketType(t.title);
      return type === activeTab;
    });
  }, [allTickets, activeTab, timerRecords]);

  // Count per tab (from current page data — used for badge numbers)
  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = { ALL: allTickets.length, INCIDENT: 0, TASK: 0, REQUEST: 0 };
    allTickets.forEach((t) => {
      const record = timerRecords.get(t.id);
      // Same fallback logic: timer record is authoritative, otherwise infer from title.
      const type: TicketType = record ? record.ticketType : inferTicketType(t.title);
      if (type === 'INCIDENT') counts.INCIDENT++;
      else if (type === 'TASK') counts.TASK++;
      else if (type === 'REQUEST') counts.REQUEST++;
    });
    return counts;
  }, [allTickets, timerRecords]);

  const inputBase =
    'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  // ---------------------------------------------------------------------------
  // Shared table header + rows for typed tabs (Incident / Task / Request)
  // ---------------------------------------------------------------------------

  const renderTypedTable = (tickets: TicketSummary[], type: TicketType): React.ReactElement => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket #</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">KB</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Site</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Start Time</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {type === 'INCIDENT' ? 'Resolved Time' : 'Closed Time'}
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              {type === 'INCIDENT' ? 'Resolved By' : 'Closed By'}
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-36">
              Timer
              <span className="ml-1 text-gray-400 font-normal normal-case">
                ({type === 'INCIDENT' ? 'Resolve' : type === 'TASK' ? 'Close' : 'Done'})
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tickets.map((ticket) => {
            const record = timerRecords.get(ticket.id);
            const externalId = record?.externalId || ticket.title;

            const startTime = ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';

            const endTimeRaw = type === 'INCIDENT' ? ticket.resolvedAt : ticket.closedAt;
            const endTime = endTimeRaw
              ? new Date(endTimeRaw).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';

            return (
              <tr
                key={ticket.id}
                onClick={() => void navigate(`/tickets/${ticket.id}`)}
                className="cursor-pointer transition-colors hover:bg-blue-50"
              >
                {/* Stacked: MFG number + external ID badge */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="block text-sm font-medium text-blue-600">{ticket.ticketNumber}</span>
                  {externalId ? (
                    <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ring-1 ring-inset ${TYPE_BADGE[type]}`}>
                      {externalId}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <TicketStatusBadge status={ticket.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {ticket.usedKnowledgeBase ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200" title="Resolved using Knowledge Base">
                      KB
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {ticket.manufacturingSite ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {ticket.manufacturingSite}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{startTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{endTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {type === 'INCIDENT'
                    ? (ticket.resolvedByName ?? <span className="text-gray-300">—</span>)
                    : (ticket.closedByName ?? <span className="text-gray-300">—</span>)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 min-w-36" onClick={(e) => e.stopPropagation()}>
                  <TimerCell
                    ticket={ticket}
                    externalId={externalId}
                    compact
                    onCompleteIntent={(completeTimer) => {
                      handleInlineResolve(ticket.id, { stopPropagation: () => undefined, preventDefault: () => undefined } as React.MouseEvent, ticket, completeTimer);
                    }}
                    onStarted={() => { setRefreshKey((k) => k + 1); }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // All-tickets table (original columns + type badge)
  // ---------------------------------------------------------------------------

  const renderAllTable = (tickets: TicketSummary[]): React.ReactElement => (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket #</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">KB</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Site</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Assignee</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Start Time</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Resolved/Closed Time</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Resolved/Closed By</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 min-w-36">Timer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tickets.map((ticket) => {
            const record = timerRecords.get(ticket.id);
            // Infer type from timer record if available, else from the raw title string.
            const inferredType: TicketType = record
              ? record.ticketType
              : inferTicketType(ticket.title);

            const startTime = ticket.createdAt
              ? new Date(ticket.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';

            const endTimeRaw = ticket.resolvedAt ?? ticket.closedAt;
            const endTime = endTimeRaw
              ? new Date(endTimeRaw).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';

            return (
              <tr
                key={ticket.id}
                onClick={() => void navigate(`/tickets/${ticket.id}`)}
                className="cursor-pointer transition-colors hover:bg-blue-50"
              >
                {/* Stacked: MFG number + type badge + external ID */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="block text-sm font-medium text-blue-600">{ticket.ticketNumber}</span>
                  <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TYPE_BADGE[inferredType]}`}>
                      {ticketTypeLabel(inferredType)}
                    </span>
                    {(record?.externalId || ticket.title) && (
                      <span className="inline-flex items-center text-xs font-mono text-gray-500">
                        {record?.externalId || ticket.title}
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <TicketStatusBadge status={ticket.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {ticket.usedKnowledgeBase ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200" title="Resolved using Knowledge Base">
                      KB
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {ticket.manufacturingSite ? (
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                      {ticket.manufacturingSite}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {ticket.assignedToName ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{startTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{endTime}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {(ticket.resolvedByName ?? ticket.closedByName) ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 min-w-36" onClick={(e) => e.stopPropagation()}>
                  <TimerCell
                    ticket={ticket}
                    externalId={record?.externalId || ticket.title}
                    compact
                    onCompleteIntent={(completeTimer) => {
                      handleInlineResolve(ticket.id, { stopPropagation: () => undefined, preventDefault: () => undefined } as React.MouseEvent, ticket, completeTimer);
                    }}
                    onStarted={() => { setRefreshKey((k) => k + 1); }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
        <p className="mt-1 text-sm text-gray-500">Browse and filter all support tickets.</p>
      </div>

      {/* Type tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Ticket type tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { handleTabChange(tab.id); }}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 rounded-t-md',
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ].join(' ')}
                aria-selected={isActive}
                role="tab"
              >
                {tab.label}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${tab.badgeClass}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filter controls */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-xs font-medium text-gray-600">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Ticket number or title…"
            value={search}
            onChange={(e) => { handleFilter(setSearch)(e.target.value); }}
            className={`${inputBase} w-56`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-gray-600">Status</label>
          <select
            id="status"
            value={status}
            onChange={(e) => { handleFilter(setStatus)(e.target.value); }}
            className={`${inputBase} w-40`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{STATUS_LABELS[opt]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className="text-xs font-medium text-gray-600">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => { handleFilter(setPriority)(e.target.value); }}
            className={`${inputBase} w-40`}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{PRIORITY_LABELS[opt]}</option>
            ))}
          </select>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="assignedToId" className="text-xs font-medium text-gray-600">Assigned To (User ID)</label>
            <input
              id="assignedToId"
              type="number"
              min={1}
              placeholder="User ID…"
              value={assignedToId}
              onChange={(e) => { handleFilter(setAssignedToId)(e.target.value); }}
              className={`${inputBase} w-36`}
            />
          </div>
        )}

        {/* My Tickets toggle */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">My Tickets</span>
          <button
            type="button"
            onClick={handleMyTicketsToggle}
            aria-pressed={myTickets}
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
              myTickets
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400',
            ].join(' ')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {myTickets ? 'My Tickets ✓' : 'My Tickets'}
          </button>
        </div>

        {/* Active filter pill — shown when My Tickets is on */}
        {myTickets && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-transparent select-none">·</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 pl-3 pr-1.5 py-1 text-xs font-medium text-indigo-700">
              Showing tickets created by you
              <button
                type="button"
                onClick={handleMyTicketsToggle}
                aria-label="Clear My Tickets filter"
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-3" role="status" aria-label="Loading tickets">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-gray-200" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Confirm-resolve dialog */}
      {confirmResolve !== null && createPortal(
        <ConfirmResolveModal
          ticketNumber={confirmResolve.ticketNumber}
          actionLabel={confirmResolve.actionLabel}
          assigneeName={confirmResolve.assigneeName}
          onResolveOnly={confirmResolve.proceedOnly}
          onAssignAndResolve={confirmResolve.proceedWithAssign}
          onCancel={() => {
            pendingCompleteTimerRef.current = null;
            confirmOpenRef.current = false;
            setConfirmResolve(null);
          }}
        />,
        document.body,
      )}

      {/* Inline resolve error */}
      {resolveError && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{resolveError}</span>
          <button type="button" onClick={() => { setResolveError(''); }} className="ml-4 text-red-500 hover:text-red-700 text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Tables */}
      {!loading && !error && (
        <>
          {visibleTickets.length === 0 ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {activeTab === 'ALL'
                  ? 'No tickets found matching your filters.'
                  : `No ${ticketTypeLabel(activeTab as TicketType)} tickets on this page. Try switching to the All tab.`}
              </p>
            </div>
          ) : activeTab === 'ALL' ? (
            renderAllTable(visibleTickets)
          ) : (
            renderTypedTable(visibleTickets, activeTab as TicketType)
          )}

          <PaginationControls
            page={page}
            limit={PAGE_LIMIT}
            total={activeTab === 'ALL' ? total : visibleTickets.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default TicketListPage;
