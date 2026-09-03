/**
 * ResolverTicketsPage — shows all resolved/closed tickets for a specific
 * resolver, navigated to from the Top Resolvers chart on the Dashboard.
 *
 * URL: /resolver-tickets?name=<assigneeName>&type=incidents|requests
 *
 * Strategy: fetch all tickets with the matching status (RESOLVED for
 * incidents, CLOSED for requests) in pages of 100, then filter client-side
 * by exact assignedToName match.  This avoids adding a new server endpoint
 * while still being accurate.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listTickets } from '../../services/system-api-services/ticket.service';
import type { TicketSummary } from '../../services/system-api-services/ticket.service';
import TicketStatusBadge from '../../components/system-components/TicketStatusBadge';
import TicketPriorityBadge from '../../components/system-components/TicketPriorityBadge';
import PaginationControls from '../../components/system-components/PaginationControls';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;
const FETCH_LIMIT = 100;

// Type badge colours — same as TicketListPage
const TYPE_BADGE_INCIDENT = 'bg-red-100 text-red-700 ring-red-200';
const TYPE_BADGE_REQUEST   = 'bg-purple-100 text-purple-700 ring-purple-200';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Loading skeleton rows  (9 columns to match the data table)
// ---------------------------------------------------------------------------

function SkeletonRow(): React.ReactElement {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-28" /><div className="mt-1 h-3 bg-gray-100 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-8" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-32" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// ResolverTicketsPage
// ---------------------------------------------------------------------------

function ResolverTicketsPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const resolverName = searchParams.get('name') ?? '';
  const chartType    = searchParams.get('type') === 'requests' ? 'requests' : 'incidents';

  const targetStatus = chartType === 'requests' ? 'CLOSED' : 'RESOLVED';
  const typeLabel    = chartType === 'requests' ? 'Closed Requests' : 'Resolved Incidents';
  const accentClass  = chartType === 'requests' ? 'text-green-700' : 'text-blue-700';
  const badgeBg      = chartType === 'requests'
    ? 'bg-green-50 ring-green-200 text-green-700'
    : 'bg-blue-50 ring-blue-200 text-blue-700';
  const typeBadge    = chartType === 'requests' ? TYPE_BADGE_REQUEST : TYPE_BADGE_INCIDENT;

  const [allTickets, setAllTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const loadTickets = useCallback(async (): Promise<void> => {
    if (!resolverName) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const first = await listTickets({ status: targetStatus, page: 1, limit: FETCH_LIMIT });
      const totalPages = Math.max(1, Math.ceil(first.total / FETCH_LIMIT));

      let combined = first.data;
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            listTickets({ status: targetStatus, page: i + 2, limit: FETCH_LIMIT }),
          ),
        );
        combined = [combined, ...rest.map((r) => r.data)].flat();
      }

      const filtered = combined.filter((t) => t.assignedToName === resolverName);

      filtered.sort((a, b) => {
        const aTime = (targetStatus === 'RESOLVED' ? a.resolvedAt : a.closedAt) ?? a.updatedAt;
        const bTime = (targetStatus === 'RESOLVED' ? b.resolvedAt : b.closedAt) ?? b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setAllTickets(filtered);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message ?? 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [resolverName, targetStatus]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const pageTickets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allTickets.slice(start, start + PAGE_SIZE);
  }, [allTickets, page]);

  // Column header labels
  const terminalTimeLabel = chartType === 'requests' ? 'Closed Time'    : 'Resolved Time';
  const terminalByLabel   = chartType === 'requests' ? 'Closed By'      : 'Resolved By';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8">

      {/* Back navigation */}
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-800 hover:underline transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${accentClass}`}>
            {resolverName || 'Unknown Resolver'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {typeLabel} assigned to this resolver
          </p>
        </div>

        {!loading && !error && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badgeBg}`}>
            {allTickets.length.toLocaleString()} ticket{allTickets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                {['Ticket #', 'Status', 'Priority', 'KB', 'Site', 'Assignee', 'Start Time', terminalTimeLabel, terminalByLabel].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* No resolver name */}
      {!loading && !error && !resolverName && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">No resolver name provided. Navigate here from the Top Resolvers chart.</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && resolverName && allTickets.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-500">
            No {typeLabel.toLowerCase()} found for <span className="font-medium text-gray-700">{resolverName}</span>.
          </p>
        </div>
      )}

      {/* Ticket table */}
      {!loading && !error && allTickets.length > 0 && (
        <>
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
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{terminalTimeLabel}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{terminalByLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pageTickets.map((ticket) => {
                  const terminalAt = chartType === 'requests' ? ticket.closedAt : ticket.resolvedAt;
                  const terminalBy = chartType === 'requests' ? ticket.closedByName : ticket.resolvedByName;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => void navigate(`/tickets/${ticket.id}`)}
                      className="cursor-pointer transition-colors hover:bg-blue-50"
                    >
                      {/* Stacked: MFG number + external ID badge */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block text-sm font-medium text-blue-600">
                          {ticket.ticketNumber}
                        </span>
                        {ticket.title && (
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold ring-1 ring-inset ${typeBadge}`}>
                            {ticket.title}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <TicketStatusBadge status={ticket.status} />
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <TicketPriorityBadge priority={ticket.priority} />
                      </td>

                      {/* KB */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {ticket.usedKnowledgeBase ? (
                          <span
                            className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            title="Resolved using Knowledge Base"
                          >
                            KB
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Site */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {ticket.manufacturingSite ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                            {ticket.manufacturingSite}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {ticket.assignedToName ?? <span className="italic text-gray-300">Unassigned</span>}
                      </td>

                      {/* Start Time */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {fmt(ticket.createdAt)}
                      </td>

                      {/* Resolved / Closed Time */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {fmt(terminalAt)}
                      </td>

                      {/* Resolved / Closed By */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {terminalBy ?? <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls
            page={page}
            limit={PAGE_SIZE}
            total={allTickets.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default ResolverTicketsPage;
