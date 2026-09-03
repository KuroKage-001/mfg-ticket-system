/**
 * ResolvedIncidentsDailyChart
 *
 * "MFG IT ADPH 24/7 – RESOLVED INCIDENTS – Daily Team Performance"
 *
 * Renders a filled area chart of resolved INC* ticket counts per calendar day
 * for a selected month/year, matching the reference design:
 *  - Light-blue gradient fill under the line
 *  - Medium-blue stroke line (no dots)
 *  - X-axis: "Aug 1", "Aug 4", "Aug 7" … (every 3rd day)
 *  - Y-axis: auto-ranged with horizontal gridlines
 *  - Legend: blue square + "Incident" label
 *  - Month/Year selector in the header
 *  - Export: CSV · Excel (.xlsx) · PNG · JPEG
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import html2canvas from 'html2canvas';
import * as XLSXStyle from 'xlsx-js-style';
import {
  getResolvedIncidentsDaily,
  type ResolvedIncidentDayRow,
} from '../../services/system-api-services/dashboard.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Area chart colour — matches the screenshot's light-blue palette
const AREA_STROKE = '#3b82f6';   // blue-500
const AREA_GRAD_START = '#93c5fd'; // blue-300  (top of gradient)
const AREA_GRAD_END   = '#dbeafe'; // blue-100  (bottom of gradient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYear():  number { return new Date().getFullYear(); }
function currentMonth(): number { return new Date().getMonth() + 1; }

function yearOptions(): number[] {
  const y = currentYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

/**
 * Format "2025-08-13" → "Aug 13"
 */
function formatAxisDate(iso: string, monthIdx: number): string {
  const day = parseInt(iso.split('-')[2] ?? '0', 10);
  return `${MONTH_SHORT[monthIdx] ?? ''} ${day}`;
}

/**
 * Show a tick only every 3rd day so labels don't crowd — replicates the
 * "Aug 1, Aug 4, Aug 7…" pattern visible in the screenshot.
 */
function tickFormatter(value: string, monthIdx: number): string {
  const day = parseInt(value.split('-')[2] ?? '0', 10);
  return (day - 1) % 3 === 0 ? formatAxisDate(value, monthIdx) : '';
}

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(year: number, month: number, ext: string): string {
  const m = String(month).padStart(2, '0');
  return `resolved-incidents-daily-${year}-${m}.${ext}`;
}

function exportCSV(rows: ResolvedIncidentDayRow[], year: number, month: number): void {
  const header = ['Date', 'Resolved Incidents'];
  const lines  = rows.map((r) => [`"${r.date}"`, r.count]);
  const csv    = [header, ...lines].map((r) => r.join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), buildFilename(year, month, 'csv'));
}

function exportExcel(rows: ResolvedIncidentDayRow[], year: number, month: number): void {
  const wb = XLSXStyle.utils.book_new();

  const data: (string | number)[][] = [
    ['Date', 'Resolved Incidents'],
    ...rows.map((r) => [r.date, r.count]),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(data);

  // Style header row
  (['A1', 'B1'] as const).forEach((addr) => {
    ws[addr] = {
      ...ws[addr],
      s: {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  ws['!cols'] = [{ wch: 14 }, { wch: 22 }];

  XLSXStyle.utils.book_append_sheet(
    wb, ws, `${MONTH_SHORT[month - 1] ?? ''} ${year}`,
  );
  XLSXStyle.writeFile(wb, buildFilename(year, month, 'xlsx'));
}

async function exportImage(
  ref: React.RefObject<HTMLDivElement | null>,
  format: 'png' | 'jpeg',
  year: number,
  month: number,
): Promise<void> {
  if (!ref.current) return;
  const canvas = await html2canvas(ref.current, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    onclone: (_doc, el) => {
      el.querySelectorAll<HTMLElement>('*').forEach((node) => {
        const s = node.style;
        for (let i = s.length - 1; i >= 0; i--) {
          const prop = s.item(i);
          if (s.getPropertyValue(prop).includes('oklch')) s.removeProperty(prop);
        }
      });
      const style = _doc.createElement('style');
      style.textContent = `*, *::before, *::after {
        --tw-ring-color: rgba(59,130,246,0.5) !important;
        --tw-shadow-color: rgba(0,0,0,0.1) !important;
        color-scheme: light !important;
      }`;
      _doc.head.appendChild(style);
    },
  });
  canvas.toBlob(
    (blob) => { if (blob) downloadBlob(blob, buildFilename(year, month, format)); },
    `image/${format}`,
    0.95,
  );
}

// ---------------------------------------------------------------------------
// Custom legend
// ---------------------------------------------------------------------------

function IncidentLegend(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 mt-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: AREA_STROKE }} aria-hidden="true" />
      <span className="text-xs text-gray-600">Incident</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ResolvedIncidentsDailyChartProps {
  initialYear?:  number;
  initialMonth?: number;
}

export default function ResolvedIncidentsDailyChart({
  initialYear,
  initialMonth,
}: ResolvedIncidentsDailyChartProps): React.ReactElement {
  const [year,  setYear]  = useState<number>(initialYear  ?? currentYear());
  const [month, setMonth] = useState<number>(initialMonth ?? currentMonth());
  const [rows,     setRows]     = useState<ResolvedIncidentDayRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const exportMenuRef   = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch whenever year or month changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getResolvedIncidentsDaily(year, month)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e.message ?? 'Failed to load data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, month]);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const monthIdx = month - 1; // 0-based index for MONTH_SHORT / MONTH_NAMES

  // Total for the selected month
  const totalResolved = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  // Export handlers
  const handleExportCSV   = useCallback(() => { exportCSV(rows, year, month);   setExportOpen(false); }, [rows, year, month]);
  const handleExportExcel = useCallback(() => { exportExcel(rows, year, month); setExportOpen(false); }, [rows, year, month]);
  const handleExportPNG   = useCallback(() => { void exportImage(chartContainerRef, 'png',  year, month); setExportOpen(false); }, [year, month]);
  const handleExportJPEG  = useCallback(() => { void exportImage(chartContainerRef, 'jpeg', year, month); setExportOpen(false); }, [year, month]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            MFG IT ADPH 24/7
          </p>
          <h2 className="text-sm font-bold text-gray-800 leading-tight">
            RESOLVED INCIDENTS – Daily Team Performance
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Month selector */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Select month"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>

          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Select year"
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Export menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
              aria-label="Export options"
              aria-haspopup="true"
              aria-expanded={exportOpen}
            >
              {/* Three-dot icon matching the screenshot */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="10" cy="4"  r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-1 w-38 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1 min-w-37">
                {[
                  { label: 'CSV',           icon: '📄', fn: handleExportCSV   },
                  { label: 'Excel (.xlsx)', icon: '📊', fn: handleExportExcel },
                  { label: 'PNG image',     icon: '🖼️', fn: handleExportPNG   },
                  { label: 'JPEG image',    icon: '📷', fn: handleExportJPEG  },
                ].map(({ label, icon, fn }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={fn}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div ref={chartContainerRef} className="px-5 pt-4 pb-5">

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center justify-center h-52">
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-400 border-t-transparent" aria-label="Loading" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Chart */}
        {!loading && !error && (
          <>
            {/* Month total pill */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">
                {MONTH_NAMES[monthIdx]} {year} — daily resolved incident count
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                {totalResolved.toLocaleString()} total
              </span>
            </div>

            {rows.every((r) => r.count === 0) ? (
              <div className="flex items-center justify-center h-52 text-sm text-gray-400">
                No resolved incidents for {MONTH_NAMES[monthIdx]} {year}.
              </div>
            ) : (
              <>
                {/* Area chart */}
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={rows}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AREA_GRAD_START} stopOpacity={0.9} />
                        <stop offset="95%" stopColor={AREA_GRAD_END}   stopOpacity={0.2} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => tickFormatter(v, monthIdx)}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />

                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={32}
                    />

                    <Tooltip
                      labelFormatter={(label: unknown) => formatAxisDate(String(label), monthIdx)}
                      formatter={(value: unknown) => [Number(value), 'Resolved'] as [number, string]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                      cursor={{ stroke: AREA_STROKE, strokeWidth: 1, strokeDasharray: '4 2' }}
                    />

                    <Legend content={<IncidentLegend />} />

                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Incident"
                      stroke={AREA_STROKE}
                      strokeWidth={2}
                      fill="url(#incidentGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: AREA_STROKE, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {/* ── Daily summary table ── */}
                <div className="mt-4 border border-gray-100 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs divide-y divide-gray-100">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="px-3 py-2 text-right font-semibold text-blue-600 uppercase tracking-wide">Resolved</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {rows.map((row) => (
                        <tr key={row.date} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-1.5 font-medium text-gray-700">
                            {formatAxisDate(row.date, monthIdx)}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${row.count > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                            {row.count > 0 ? row.count.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="bg-blue-50 border-t-2 border-blue-200">
                        <td className="px-3 py-2 font-bold text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">
                          {totalResolved.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
