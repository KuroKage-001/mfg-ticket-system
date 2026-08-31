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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import { useTickets } from '../../hooks/system-hooks/useTickets';
import type { TicketSummary, TicketListQuery } from '../../services/system-api-services/ticket.service';
import { transitionStatus } from '../../services/client-api-services/ticket.service';
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

const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const;
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const STATUS_LABELS: Record<string, string> = {
  '': 'All Statuses',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
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
// ConfirmResolveModal — shown when the current user is about to resolve a
// ticket that is not assigned to them.
// ---------------------------------------------------------------------------

interface ConfirmResolveModalProps {
  ticketNumber: string;
  assigneeName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmResolveModal({ ticketNumber, assigneeName, onConfirm, onCancel }: ConfirmResolveModalProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-resolve-title"
      // Stop all clicks inside the modal from reaching table rows beneath
      onClick={(e) => { e.stopPropagation(); }}
    >
      {/* Backdrop — clicking dismisses without resolving */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-amber-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <h2 id="confirm-resolve-title" className="text-sm font-semibold text-gray-900">
              Resolve ticket {ticketNumber}?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              This ticket is assigned to{' '}
              <span className="font-medium text-gray-700">{assigneeName ?? 'another user'}</span>.
              Resolving it will log your account as the actor in the activity feed.
            </p>
            <p className="mt-1.5 text-xs text-gray-400">This action will be recorded in the ticket activity log.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            Yes, Resolve
          </button>
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
  const { startedAt, start, complete, reset } = useTicketTimer(ticket.id);
  // Ref that is true while handleStart is in-flight so the stale-record
  // cleanup useEffect does not wipe the record we just wrote.
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

  const isOpenAndUnstarted = ticket.status === 'OPEN' && startedAt === null;

  const handleStart = useCallback(async (extId: string): Promise<void> => {
    isStartingRef.current = true;
    setStarting(true);
    try {
      start(extId);
      await transitionStatus(ticket.id, 'IN_PROGRESS');
      onStarted();
    } catch {
      onStarted();
    } finally {
      setStarting(false);
      // Keep the flag true for one more tick so the useEffect that runs after
      // the re-render triggered by onStarted() doesn't see OPEN+startedAt.
      setTimeout(() => { isStartingRef.current = false; }, 0);
    }
  }, [ticket.id, start, onStarted]);

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
      {...(isOpenAndUnstarted ? {
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
  const { user } = useAuth();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('ALL');

  // Filters
  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Inline resolve state: ticketId → loading
  const [, setResolvingId] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string>('');

  // Confirmation dialog state — shown before resolving a ticket not assigned to the current user
  const [confirmResolve, setConfirmResolve] = useState<{
    ticketId: number;
    ticketNumber: string;
    assigneeName: string | null;
    proceed: () => void;
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
  const executeResolve = useCallback(async (ticketId: number, completeTimer?: () => void): Promise<void> => {
    setResolvingId(ticketId);
    setResolveError('');
    try {
      const record = readAllTimerRecords().get(ticketId);
      const type = record?.ticketType ?? inferTicketType(
        allTickets.find((t) => t.id === ticketId)?.title ?? ''
      );
      const isAdmin = user?.role === 'ADMIN';
      const targetStatus = (isAdmin && type === 'TASK') ? 'CLOSED' : 'RESOLVED';
      await transitionStatus(ticketId, targetStatus);
      // Mark the local timer as done only after the server confirms the transition
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
  // `completeTimer` is the callback that marks the local timer as done — we
  // only invoke it after confirmation (if needed) and after the API succeeds.
  const handleInlineResolve = useCallback((ticketId: number, e: React.MouseEvent, ticket?: TicketSummary, completeTimer?: () => void): void => {
    e.stopPropagation();
    const t = ticket ?? allTickets.find((tk) => tk.id === ticketId);
    const isOwnTicket = t?.assignedToId === user?.id;

    if (!isOwnTicket && t) {
      // Show confirmation before resolving someone else's ticket.
      // completeTimer is called inside proceed — only on explicit confirm.
      setConfirmResolve({
        ticketId,
        ticketNumber: t.ticketNumber,
        assigneeName: t.assignedToName ?? null,
        proceed: () => {
          setConfirmResolve(null);
          void executeResolve(ticketId, completeTimer);
        },
      });
      return;
    }

    void executeResolve(ticketId, completeTimer);
  }, [user, allTickets, executeResolve]);

  // Reset page on filter changes
  const handleFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
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
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket #</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">External ID</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">KB</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
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
            // externalId: timer record is authoritative; fall back to the ticket title
            // which is stored as the raw external ID (e.g. "INC1278770").
            const externalId = record?.externalId || ticket.title;
            // Strip any legacy "[INC1278770] " bracket prefix for the clean title display.
            const titleMatch = /^\[([A-Z0-9]+)\]\s*/i.exec(ticket.title);
            const cleanTitle = titleMatch ? ticket.title.replace(titleMatch[0], '') : ticket.title;

            return (
              <tr
                key={ticket.id}
                onClick={() => void navigate(`/tickets/${ticket.id}`)}
                className="cursor-pointer transition-colors hover:bg-blue-50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-600">{ticket.ticketNumber}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {externalId ? (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ring-1 ring-inset ${TYPE_BADGE[type]}`}>
                      {externalId}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-800">
                  <span className="line-clamp-2 max-w-xs">{cleanTitle}</span>
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
                <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <TimerCell
                    ticket={ticket}
                    externalId={externalId}
                    compact
                    onCompleteIntent={(completeTimer) => {
                      handleInlineResolve(ticket.id, { stopPropagation: () => undefined } as React.MouseEvent, ticket, completeTimer);
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
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket #</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Priority</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">KB</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Assignee</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Timer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tickets.map((ticket) => {
            const record = timerRecords.get(ticket.id);
            // Infer type from timer record if available, else from the raw title string.
            const inferredType: TicketType = record
              ? record.ticketType
              : inferTicketType(ticket.title);
            // Strip any legacy "[INC...]" bracket prefix from the display title.
            const titleMatch = /^\[([A-Z0-9]+)\]\s*/i.exec(ticket.title);
            const cleanTitle = titleMatch ? ticket.title.replace(titleMatch[0], '') : ticket.title;

            return (
              <tr
                key={ticket.id}
                onClick={() => void navigate(`/tickets/${ticket.id}`)}
                className="cursor-pointer transition-colors hover:bg-blue-50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-blue-600">{ticket.ticketNumber}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${TYPE_BADGE[inferredType]}`}>
                    {ticketTypeLabel(inferredType)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-800">
                  <span className="line-clamp-2 max-w-xs">{cleanTitle}</span>
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
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {ticket.assignedToName ?? '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </td>
                <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <TimerCell
                    ticket={ticket}
                    externalId={record?.externalId || ticket.title}
                    compact
                    onCompleteIntent={(completeTimer) => {
                      handleInlineResolve(ticket.id, { stopPropagation: () => undefined } as React.MouseEvent, ticket, completeTimer);
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

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

      {/* Confirm-resolve dialog — shown when resolving a ticket not assigned to the current user */}
      {confirmResolve !== null && (
        <ConfirmResolveModal
          ticketNumber={confirmResolve.ticketNumber}
          assigneeName={confirmResolve.assigneeName}
          onConfirm={confirmResolve.proceed}
          onCancel={() => { setConfirmResolve(null); }}
        />
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
