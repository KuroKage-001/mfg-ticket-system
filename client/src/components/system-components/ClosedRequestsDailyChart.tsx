/**
 * ClosedRequestsDailyChart
 *
 * "MFG IT ADGT – CLOSED REQUESTS – Daily Team Performance"
 *
 * Renders a filled area chart of closed ticket counts per calendar day
 * for a selected month/year, matching the reference design:
 *  - Teal/green gradient fill under the line
 *  - Teal stroke line (no dots)
 *  - X-axis: "Aug 1", "Aug 4", "Aug 7" … (every 3rd day)
 *  - Y-axis: auto-ranged with horizontal gridlines
 *  - Legend: teal square + "Task" label (as shown in screenshot)
 *  - Month/Year selector in the header
 *  - Three-dot export menu: CSV · Excel (.xlsx) · PNG · JPEG
 *
 * Data formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL
 *  - ALL ticket categories (no INC prefix filter)
 *  - Grouped by DATE_FORMAT(closed_at, '%Y-%m-%d')
 *  - Zero-filled for every calendar day in the month
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { exportImage } from '../../utilities/exportImage';
import * as XLSXStyle from 'xlsx-js-style';
import {
  getClosedRequestsDaily,
  type ClosedRequestDayRow,
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

// Teal palette — matches the screenshot's green area chart
const AREA_STROKE     = '#10b981'; // emerald-500
const AREA_GRAD_START = '#6ee7b7'; // emerald-300
const AREA_GRAD_END   = '#d1fae5'; // emerald-100

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYear():  number { return new Date().getFullYear(); }
function currentMonth(): number { return new Date().getMonth() + 1; }

function yearOptions(): number[] {
  const y = currentYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

/** "2025-08-13" → "Aug 13" */
function formatAxisDate(iso: string, monthIdx: number): string {
  const day = parseInt(iso.split('-')[2] ?? '0', 10);
  return `${MONTH_SHORT[monthIdx] ?? ''} ${day}`;
}

/** Show a tick every 3rd day — replicates "Aug 1, Aug 4, Aug 7…" */
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
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(year: number, month: number, ext: string): string {
  return `closed-requests-daily-${year}-${String(month).padStart(2, '0')}.${ext}`;
}

function exportCSV(rows: ClosedRequestDayRow[], year: number, month: number): void {
  const header = ['Date', 'Closed Requests'];
  const lines  = rows.map((r) => [`"${r.date}"`, r.count]);
  const csv    = [header, ...lines].map((r) => r.join(',')).join('\r\n');
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    buildFilename(year, month, 'csv'),
  );
}

function exportExcel(rows: ClosedRequestDayRow[], year: number, month: number): void {
  const wb = XLSXStyle.utils.book_new();

  const data: (string | number)[][] = [
    ['Date', 'Closed Requests'],
    ...rows.map((r) => [r.date, r.count]),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(data);

  // Style header cells
  (['A1', 'B1'] as const).forEach((addr) => {
    ws[addr] = {
      ...ws[addr],
      s: {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '10B981' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  ws['!cols'] = [{ wch: 14 }, { wch: 20 }];

  XLSXStyle.utils.book_append_sheet(
    wb, ws, `${MONTH_SHORT[month - 1] ?? ''} ${year}`,
  );
  XLSXStyle.writeFile(wb, buildFilename(year, month, 'xlsx'));
}

// ---------------------------------------------------------------------------
// Custom legend — matches "Task" label in screenshot
// ---------------------------------------------------------------------------

function TaskLegend(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 mt-1">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: AREA_STROKE }}
        aria-hidden="true"
      />
      <span className="text-xs text-gray-600">Task</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ClosedRequestsDailyChartProps {
  initialYear?:  number;
  initialMonth?: number;
}

export default function ClosedRequestsDailyChart({
  initialYear,
  initialMonth,
}: ClosedRequestsDailyChartProps): React.ReactElement {
  const [year,  setYear]  = useState<number>(initialYear  ?? currentYear());
  const [month, setMonth] = useState<number>(initialMonth ?? currentMonth());
  const [rows,       setRows]      = useState<ClosedRequestDayRow[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const exportMenuRef     = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch whenever year or month changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getClosedRequestsDaily(year, month)
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

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const monthIdx    = month - 1;
  const totalClosed = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  // Export handlers
  const handleExportCSV   = useCallback(() => { exportCSV(rows, year, month);   setExportOpen(false); }, [rows, year, month]);
  const handleExportExcel = useCallback(() => { exportExcel(rows, year, month); setExportOpen(false); }, [rows, year, month]);
  const handleExportPNG   = useCallback(() => { if (chartContainerRef.current) void exportImage(chartContainerRef.current, 'png',  buildFilename(year, month, 'png'));  setExportOpen(false); }, [year, month]);
  const handleExportJPEG  = useCallback(() => { if (chartContainerRef.current) void exportImage(chartContainerRef.current, 'jpeg', buildFilename(year, month, 'jpeg')); setExportOpen(false); }, [year, month]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            MFG IT ADGT
          </p>
          <h2 className="text-sm font-bold text-gray-800 leading-tight">
            CLOSED REQUESTS – Daily Team Performance
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Month selector */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
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
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            aria-label="Select year"
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Three-dot export menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-colors"
              aria-label="Export options"
              aria-haspopup="true"
              aria-expanded={exportOpen}
            >
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
            <div
              className="animate-spin h-8 w-8 rounded-full border-4 border-emerald-400 border-t-transparent"
              aria-label="Loading"
            />
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
                {MONTH_NAMES[monthIdx]} {year} — daily closed request count
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {totalClosed.toLocaleString()} total
              </span>
            </div>

            {rows.every((r) => r.count === 0) ? (
              <div className="flex items-center justify-center h-52 text-sm text-gray-400">
                No closed requests for {MONTH_NAMES[monthIdx]} {year}.
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
                      <linearGradient id="closedDailyGrad" x1="0" y1="0" x2="0" y2="1">
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
                      formatter={(value: unknown) => [Number(value), 'Closed'] as [number, string]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                      cursor={{ stroke: AREA_STROKE, strokeWidth: 1, strokeDasharray: '4 2' }}
                    />

                    <Legend content={<TaskLegend />} />

                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Task"
                      stroke={AREA_STROKE}
                      strokeWidth={2}
                      fill="url(#closedDailyGrad)"
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
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                          Date
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-emerald-600 uppercase tracking-wide">
                          Closed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {rows.map((row) => (
                        <tr key={row.date} className="hover:bg-emerald-50 transition-colors">
                          <td className="px-3 py-1.5 font-medium text-gray-700">
                            {formatAxisDate(row.date, monthIdx)}
                          </td>
                          <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${row.count > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                            {row.count > 0 ? row.count.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                        <td className="px-3 py-2 font-bold text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 tabular-nums">
                          {totalClosed.toLocaleString()}
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
