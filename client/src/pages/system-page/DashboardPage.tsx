import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSummary } from '../../services/system-api-services/dashboard.service';
import type { DashboardSummary } from '../../services/system-api-services/dashboard.service';
import { listTickets } from '../../services/system-api-services/ticket.service';
import type { TicketSummary as TicketSummaryItem } from '../../services/system-api-services/ticket.service';
import TicketStatusBadge from '../../components/system-components/TicketStatusBadge';
import TicketPriorityBadge from '../../components/system-components/TicketPriorityBadge';
import MyTicketsBanner from '../../components/client-components/MyTicketsBanner';
import { useAuth } from '../../hooks/system-hooks/useAuth';
import ResolvedIncidentsChart from '../../components/system-components/ResolvedIncidentsChart';
import ResolvedIncidentsDailyChart from '../../components/system-components/ResolvedIncidentsDailyChart';
import TopResolversChart from '../../components/system-components/TopResolversChart';
import ClosedRequestsChart from '../../components/system-components/ClosedRequestsChart';
import ClosedRequestsDailyChart from '../../components/system-components/ClosedRequestsDailyChart';
import ClosedRequestsTopResolversChart from '../../components/system-components/ClosedRequestsTopResolversChart';
import * as XLSXStyle from 'xlsx-js-style';

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

/** Fetch ALL tickets by paginating the /api/tickets endpoint (max 100/page). */
async function fetchAllTicketsForExport(): Promise<TicketSummaryItem[]> {
  const LIMIT = 100;
  const first = await listTickets({ page: 1, limit: LIMIT });
  const totalPages = Math.max(1, Math.ceil(first.total / LIMIT));
  if (totalPages <= 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      listTickets({ page: i + 2, limit: LIMIT }),
    ),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

const EXPORT_HEADERS = [
  'Ticket #',
  'External ID',
  'Status',
  'Priority',
  'Category',
  'Manufacturing Site',
  'Contact Method',
  'Used KB',
  'Assigned To',
  'Resolved By (INC)',
  'Closed By (RITM/SCTASK)',
  'Created At',
  'Updated At',
  'Resolved At (INC)',
  'Closed At (RITM/SCTASK)',
] as const;

function ticketToRow(t: TicketSummaryItem): (string | number)[] {
  const fmt = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '';

  return [
    t.ticketNumber,
    t.title,           // title holds the raw external ID (e.g. INC0012345)
    t.status,
    t.priority,
    t.category,
    t.manufacturingSite ?? '',
    t.contactMethod ?? '',
    t.usedKnowledgeBase ? 'Yes' : 'No',
    t.assignedToName ?? 'Unassigned',
    t.resolvedByName ?? '',
    t.closedByName ?? '',
    fmt(t.createdAt),
    fmt(t.updatedAt),
    fmt(t.resolvedAt),
    fmt(t.closedAt),
  ];
}

function exportReportFilename(ext: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `tickets-report-${stamp}.${ext}`;
}

function exportCSV(tickets: TicketSummaryItem[]): void {
  const rows = [EXPORT_HEADERS, ...tickets.map(ticketToRow)];
  const csv = rows.map((r) =>
    r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
  ).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportReportFilename('csv');
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(tickets: TicketSummaryItem[]): void {
  const wb = XLSXStyle.utils.book_new();
  const sheetData: (string | number)[][] = [
    [...EXPORT_HEADERS],
    ...tickets.map(ticketToRow),
  ];
  const ws = XLSXStyle.utils.aoa_to_sheet(sheetData);

  // Style header row
  EXPORT_HEADERS.forEach((_, colIdx) => {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[addr]) ws[addr] = { v: EXPORT_HEADERS[colIdx], t: 's' };
    ws[addr] = {
      ...ws[addr],
      s: {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill:      { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          bottom: { style: 'thin', color: { rgb: '94A3B8' } },
          right:  { style: 'thin', color: { rgb: '94A3B8' } },
        },
      },
    };
  });

  // Alternate row shading on data rows
  tickets.forEach((_, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    EXPORT_HEADERS.forEach((_, colIdx) => {
      const addr = XLSXStyle.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr] = {
        ...ws[addr],
        s: {
          fill:      { fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' } },
          alignment: { vertical: 'center', wrapText: false },
          border: {
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right:  { style: 'thin', color: { rgb: 'E2E8F0' } },
          },
        },
      };
    });
  });

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // Ticket #
    { wch: 18 }, // External ID
    { wch: 14 }, // Status
    { wch: 10 }, // Priority
    { wch: 16 }, // Category
    { wch: 18 }, // Manufacturing Site
    { wch: 16 }, // Contact Method
    { wch: 9  }, // Used KB
    { wch: 24 }, // Assigned To
    { wch: 24 }, // Resolved By (INC)
    { wch: 26 }, // Closed By (RITM/SCTASK)
    { wch: 22 }, // Created At
    { wch: 22 }, // Updated At
    { wch: 22 }, // Resolved At (INC)
    { wch: 26 }, // Closed At (RITM/SCTASK)
  ];

  XLSXStyle.utils.book_append_sheet(wb, ws, 'Tickets Report');
  XLSXStyle.writeFile(wb, exportReportFilename('xlsx'));
}

// ---------------------------------------------------------------------------
// ExportButton — handles loading state + dropdown
// ---------------------------------------------------------------------------

function ExportButton(): React.ReactElement {
  const [open, setOpen]       = useState(false);
  const [busy, setBusy]       = useState(false);
  const [exportErr, setExportErr] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = useCallback(async (format: 'csv' | 'xlsx'): Promise<void> => {
    setOpen(false);
    setBusy(true);
    setExportErr('');
    try {
      const tickets = await fetchAllTicketsForExport();
      if (format === 'csv') exportCSV(tickets);
      else                  exportExcel(tickets);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setExportErr(e.message ?? 'Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {exportErr && (
        <p className="absolute -top-7 right-0 text-xs text-red-600 whitespace-nowrap">{exportErr}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => { setOpen((o) => !o); }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {busy ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Exporting…
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export Report
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </>
        )}
      </button>

      {open && !busy && (
        <div className="absolute right-0 mt-1.5 z-20 w-44 rounded-lg bg-white border border-gray-200 shadow-lg py-1">
          <button
            type="button"
            onClick={() => { void run('csv'); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6M5 21h14a2 2 0 002-2V7l-5-5H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => { void run('xlsx'); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
            Download Excel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function SkeletonCard(): React.ReactElement {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-16" />
    </div>
  );
}

function SkeletonRow(): React.ReactElement {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-28" /><div className="mt-1 h-3 bg-gray-100 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-8" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-28" /></td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Status tickets modal
// ---------------------------------------------------------------------------

type ModalStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED' | 'URGENT' | 'UNASSIGNED' | 'MY_ASSIGNED';

const STATUS_LABELS: Record<ModalStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved (INC)',
  CLOSED: 'Closed (SCTASK/RITM)',
  CANCELLED: 'Cancelled',
  URGENT: 'Urgent',
  UNASSIGNED: 'Unassigned',
  MY_ASSIGNED: 'My Assigned',
};

interface StatusTicketsModalProps {
  status: ModalStatus;
  onClose: () => void;
}

function StatusTicketsModal({ status, onClose }: StatusTicketsModalProps): React.ReactElement {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async (): Promise<void> => {
      setIsLoading(true);
      setError('');
      try {
        // Derive the correct listTickets query from the modal status key
        const query = (() => {
          switch (status) {
            case 'OPEN':        return { status: 'OPEN',        page, limit };
            case 'IN_PROGRESS': return { status: 'IN_PROGRESS', page, limit };
            case 'RESOLVED':    return { status: 'RESOLVED',    page, limit };
            case 'CLOSED':      return { status: 'CLOSED',      page, limit };
            case 'CANCELLED':   return { status: 'CANCELLED',   page, limit };
            case 'URGENT':      return { priority: 'URGENT',    page, limit };
            case 'UNASSIGNED':  return { unassigned: true,      page, limit };
            case 'MY_ASSIGNED': return { assignedToId: user?.id, page, limit };
          }
        })();
        const result = await listTickets(query);
        if (!cancelled) {
          setTickets(result.data);
          setTotal(result.total);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e.message ?? 'Failed to load tickets.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetch();
    return () => { cancelled = true; };
  }, [status, page, user?.id]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const accentMap: Record<ModalStatus, string> = {
    OPEN: 'text-sky-600',
    IN_PROGRESS: 'text-amber-600',
    RESOLVED: 'text-emerald-600',
    CLOSED: 'text-gray-600',
    CANCELLED: 'text-rose-600',
    URGENT: 'text-red-600',
    UNASSIGNED: 'text-orange-600',
    MY_ASSIGNED: 'text-indigo-600',
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${STATUS_LABELS[status]} tickets`}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[95vw] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className={`text-lg font-bold ${accentMap[status]}`}>
              {STATUS_LABELS[status]} Tickets
            </h2>
            {!isLoading && !error && (
              <p className="text-xs text-gray-400 mt-0.5">{total} ticket{total !== 1 ? 's' : ''} found</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="overflow-x-auto h-full">
          {isLoading ? (
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['Ticket #', 'Status', 'Priority', 'KB', 'Site', 'Assignee', 'Start Time', 'Resolved/Closed Time', 'Resolved/Closed By'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          ) : error ? (
            <div role="alert" className="m-6 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
              <p className="font-semibold mb-1">Could not load tickets</p>
              <p>{error}</p>
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">No {STATUS_LABELS[status].toLowerCase()} tickets found.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Ticket #', 'Status', 'Priority', 'KB', 'Site', 'Assignee', 'Start Time', 'Resolved/Closed Time', 'Resolved/Closed By'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map((ticket) => {
                  const startTime = new Date(ticket.createdAt).toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  });
                  const endTimeRaw = ticket.resolvedAt ?? ticket.closedAt;
                  const endTime = endTimeRaw
                    ? new Date(endTimeRaw).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })
                    : '—';
                  const resolvedClosedBy = ticket.resolvedByName ?? ticket.closedByName ?? null;

                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Stacked: MFG number + external ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          onClick={onClose}
                          className="block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {ticket.ticketNumber}
                        </Link>
                        {ticket.title && (
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
                            {ticket.title}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TicketStatusBadge status={ticket.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TicketPriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ticket.usedKnowledgeBase ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200" title="Resolved using Knowledge Base">
                            KB
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {ticket.manufacturingSite ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                            {ticket.manufacturingSite}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {ticket.assignedToName ?? <span className="italic text-gray-300">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{startTime}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{endTime}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {resolvedClosedBy ?? <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          </div>
        </div>

        {/* Footer — pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  /** Tailwind color token used for the value text and the icon background tint */
  accent: string;
  /** Icon background tint class */
  iconBg: string;
  icon: React.ReactElement;
  onClick?: () => void;
}

function StatCard({ label, value, accent, iconBg, icon, onClick }: StatCardProps): React.ReactElement {
  const isClickable = typeof onClick === 'function';
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      className={[
        'bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4',
        isClickable ? 'cursor-pointer hover:border-gray-300 hover:shadow-md active:scale-[0.98] transition-all select-none' : '',
      ].join(' ')}
    >
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className={`text-3xl font-bold ${accent} leading-none`}>{value}</p>
      </div>
      <div className={`shrink-0 flex items-center justify-center h-11 w-11 rounded-xl ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icon helpers (inline, no external dep)
// ---------------------------------------------------------------------------

function IconInbox({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 5H6l-2-5m16 0H4" />
    </svg>
  );
}

function IconSpinner({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function IconUserSlash({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-6.04 3.47M3 3l18 18" />
    </svg>
  );
}

function IconUser({ className }: { className?: string }): React.ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 0112 15a9 9 0 016.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

function DashboardPage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [chartsExpanded, setChartsExpanded] = useState<boolean>(false);
  const [closedExpanded, setClosedExpanded] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<ModalStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async (): Promise<void> => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getSummary();
        if (!cancelled) setSummary(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const apiErr = err as { message?: string };
          setError(
            typeof apiErr.message === 'string' && apiErr.message.length > 0
              ? apiErr.message
              : 'Failed to load dashboard data.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchSummary();
    return () => { cancelled = true; };
  }, []);

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="h-7 bg-gray-200 rounded w-40 animate-pulse" />
          <div className="mt-1 h-4 bg-gray-100 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="h-5 bg-gray-200 rounded w-36 animate-pulse" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Ticket #', 'Status', 'Priority', 'KB', 'Site', 'Assignee', 'Start Time', 'Resolved/Closed Time', 'Resolved/Closed By'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Error
  // ------------------------------------------------------------------
  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
          <p className="font-semibold mb-1">Unable to load dashboard</p>
          <p>{error}</p>
          <p className="mt-2 text-red-400 text-xs">
            If this persists, the service may be temporarily unavailable. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!summary) return <></>;

  const statCards: (StatCardProps & { cardKey: string })[] = [
    {
      cardKey: 'Open',
      label: 'Open',
      value: summary.open,
      accent: 'text-sky-600',
      iconBg: 'bg-sky-50',
      icon: <IconInbox className="h-5 w-5 text-sky-500" />,
      onClick: () => { setActiveModal('OPEN'); },
    },
    {
      cardKey: 'In Progress',
      label: 'In Progress',
      value: summary.inProgress,
      accent: 'text-amber-600',
      iconBg: 'bg-amber-50',
      icon: <IconSpinner className="h-5 w-5 text-amber-500" />,
      onClick: () => { setActiveModal('IN_PROGRESS'); },
    },
    {
      cardKey: 'Resolved',
      label: 'Resolved (INC)',
      value: summary.resolved,
      accent: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      icon: <IconCheckCircle className="h-5 w-5 text-emerald-500" />,
      onClick: () => { setActiveModal('RESOLVED'); },
    },
    {
      cardKey: 'Closed',
      label: 'Closed (SCTASK/RITM)',
      value: summary.closed,
      accent: 'text-gray-600',
      iconBg: 'bg-gray-100',
      icon: <IconLock className="h-5 w-5 text-gray-400" />,
      onClick: () => { setActiveModal('CLOSED'); },
    },
    {
      cardKey: 'Urgent',
      label: 'Urgent',
      value: summary.urgent,
      accent: 'text-red-600',
      iconBg: 'bg-red-50',
      icon: <IconBolt className="h-5 w-5 text-red-500" />,
      onClick: () => { setActiveModal('URGENT'); },
    },
    {
      cardKey: 'Unassigned',
      label: 'Unassigned',
      value: summary.unassigned,
      accent: 'text-orange-600',
      iconBg: 'bg-orange-50',
      icon: <IconUserSlash className="h-5 w-5 text-orange-500" />,
      onClick: () => { setActiveModal('UNASSIGNED'); },
    },
    {
      cardKey: 'My Assigned',
      label: 'My Assigned',
      value: summary.myAssigned,
      accent: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
      icon: <IconUser className="h-5 w-5 text-indigo-500" />,
      onClick: () => { setActiveModal('MY_ASSIGNED'); },
    },
  ];

  // ------------------------------------------------------------------
  // Collapse toggle button
  // ------------------------------------------------------------------
  function CollapseToggle({
    expanded,
    onToggle,
  }: {
    expanded: boolean;
    onToggle: () => void;
  }): React.ReactElement {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Collapse
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Expand
          </>
        )}
      </button>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Page heading */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-400">Overview of current ticket activity</p>
          </div>
          <ExportButton />
        </div>
      </div>

      {/* Employee banner */}
      {user?.role === 'EMPLOYEE' && (
        <div className="mb-6">
          <MyTicketsBanner myAssigned={summary.myAssigned} />
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ cardKey, ...card }) => (
          <StatCard key={cardKey} {...card} />
        ))}
      </div>

      {/* Resolved Incidents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Resolved Incidents
          </h2>
          <CollapseToggle
            expanded={chartsExpanded}
            onToggle={() => { setChartsExpanded((p) => !p); }}
          />
        </div>
        {chartsExpanded && (
          <div className="space-y-8">
            <ResolvedIncidentsChart />
            <ResolvedIncidentsDailyChart />
            <TopResolversChart
              onResolverClick={(name) => {
                void navigate(`/resolver-tickets?name=${encodeURIComponent(name)}&type=incidents`);
              }}
            />
          </div>
        )}
      </div>

      {/* Closed Requests */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Closed Requests
          </h2>
          <CollapseToggle
            expanded={closedExpanded}
            onToggle={() => { setClosedExpanded((p) => !p); }}
          />
        </div>
        {closedExpanded && (
          <div className="space-y-8">
            <ClosedRequestsChart />
            <ClosedRequestsDailyChart />
            <ClosedRequestsTopResolversChart
              onResolverClick={(name) => {
                void navigate(`/resolver-tickets?name=${encodeURIComponent(name)}&type=requests`);
              }}
            />
          </div>
        )}
      </div>

      {/* Recent tickets */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">Recent Tickets</h2>
          <Link
            to="/tickets"
            className="text-xs font-medium text-gray-400 hover:text-gray-700 hover:underline transition-colors"
          >
            View all →
          </Link>
        </div>

        {summary.recentTickets.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">
            No tickets have been created yet.
          </p>
        ) : (
          /* Single scrollable container — one table so thead/tbody columns are always in sync */
          <div className="overflow-x-auto">
            <div className="overflow-y-auto max-h-72">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {['Ticket #', 'Status', 'Priority', 'KB', 'Site', 'Assignee', 'Start Time', 'Resolved/Closed Time', 'Resolved/Closed By'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {summary.recentTickets.map((ticket) => {
                    const startTime = new Date(ticket.createdAt).toLocaleString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    });
                    const endTimeRaw = ticket.resolvedAt ?? ticket.closedAt;
                    const endTime = endTimeRaw
                      ? new Date(endTimeRaw).toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })
                      : '—';
                    const resolvedClosedBy = ticket.resolvedByName ?? ticket.closedByName ?? null;

                    return (
                      <tr key={ticket.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Stacked: MFG number + external ID */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link
                            to={`/tickets/${ticket.id}`}
                            className="block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {ticket.ticketNumber}
                          </Link>
                          {ticket.title && (
                            <span className="mt-0.5 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
                              {ticket.title}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TicketStatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <TicketPriorityBadge priority={ticket.priority} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {ticket.usedKnowledgeBase ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200" title="Resolved using Knowledge Base">
                              KB
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {ticket.manufacturingSite ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
                              {ticket.manufacturingSite}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {ticket.assignedToName ?? <span className="italic text-gray-300">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{startTime}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{endTime}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {resolvedClosedBy ?? <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Status tickets modal */}
      {activeModal && (
        <StatusTicketsModal
          status={activeModal}
          onClose={() => { setActiveModal(null); }}
        />
      )}

    </div>
  );
}

export default DashboardPage;
