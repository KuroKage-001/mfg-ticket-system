/**
 * ClosedRequestsTopResolversChart
 *
 * "MFG IT ADPH 24/7 – CLOSED REQUESTS – Top Resolvers"
 *
 * Horizontal bar chart showing the top N assignees ranked by their closed
 * ticket count for a selected period (month/year or full year).
 *
 * Matches the reference design:
 *  - Bars sorted longest → shortest (top to bottom)
 *  - Green gradient bars (darkest for #1, lighter for lower ranks)
 *  - "Other" bucket at the bottom in slate
 *  - Year + Month selectors + three-dot export menu
 *  - Export: CSV · Excel (.xlsx) · PNG · JPEG
 *
 * Data formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL
 *  - ALL ticket categories (no INC prefix filter)
 *  - Grouped by assignee, ordered by count DESC
 *  - Assignees beyond topN collapsed into "Other"
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LabelList, ResponsiveContainer,
} from 'recharts';
import html2canvas from 'html2canvas';
import * as XLSXStyle from 'xlsx-js-style';
import {
  getClosedRequestsTopResolvers,
  type ClosedRequestTopResolverRow,
} from '../../services/system-api-services/dashboard.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Green gradient palette matching the screenshot:
 * rank 1 gets the darkest shade, lower ranks progressively lighter.
 * Cycles if more than 10 named entries.
 */
const GREEN_SHADES = [
  '#14532d', // green-900
  '#166534', // green-800
  '#15803d', // green-700
  '#16a34a', // green-600
  '#22c55e', // green-500
  '#4ade80', // green-400
  '#86efac', // green-300
  '#bbf7d0', // green-200
  '#dcfce7', // green-100
  '#f0fdf4', // green-50
];
const BAR_COLOR_OTHER = '#94a3b8'; // slate-400
const TOP_N_DEFAULT   = 10;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYear(): number { return new Date().getFullYear(); }

function yearOptions(): number[] {
  const y = currentYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

function truncate(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function buildFilename(year: number, month: number, ext: string): string {
  const m = month > 0 ? `-${String(month).padStart(2, '0')}` : '';
  return `closed-requests-top-resolvers-${year}${m}.${ext}`;
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

function exportCSV(rows: ClosedRequestTopResolverRow[], year: number, month: number): void {
  const header = ['Rank', 'Assignee', 'Closed Count'];
  const lines  = rows.map((r) => [r.rank, `"${r.assigneeName}"`, r.count]);
  const csv    = [header, ...lines].map((r) => r.join(',')).join('\r\n');
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    buildFilename(year, month, 'csv'),
  );
}

function exportExcel(rows: ClosedRequestTopResolverRow[], year: number, month: number): void {
  const wb = XLSXStyle.utils.book_new();

  const data: (string | number)[][] = [
    ['Rank', 'Assignee', 'Closed Count'],
    ...rows.map((r) => [r.rank, r.assigneeName, r.count]),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(data);

  // Header row — dark green
  (['A1', 'B1', 'C1'] as const).forEach((addr) => {
    ws[addr] = {
      ...ws[addr],
      s: {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '15803D' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 14 }];

  const sheetName = month > 0
    ? `${MONTH_NAMES[month - 1]?.slice(0, 3) ?? ''} ${year}`
    : `${year} Full Year`;

  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
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
// Custom bar value label
// ---------------------------------------------------------------------------

interface BarLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}

function BarValueLabel({ x = 0, y = 0, width = 0, height = 0, value = 0 }: BarLabelProps): React.ReactElement | null {
  if (!value) return null;
  return (
    <text
      x={x + width + 5}
      y={y + height / 2}
      dominantBaseline="middle"
      style={{ fontSize: 11, fill: '#475569' }}
    >
      {value.toLocaleString()}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ClosedRequestsTopResolversChartProps {
  initialYear?:  number;
  initialMonth?: number;
  topN?: number;
  /**
   * Called when the user clicks a named resolver bar or table row.
   * Receives the full assignee name. "Other" rows are not clickable.
   */
  onResolverClick?: (assigneeName: string) => void;
}

export default function ClosedRequestsTopResolversChart({
  initialYear,
  initialMonth,
  topN = TOP_N_DEFAULT,
  onResolverClick,
}: ClosedRequestsTopResolversChartProps): React.ReactElement {
  const [year,  setYear]  = useState<number>(initialYear  ?? currentYear());
  const [month, setMonth] = useState<number>(initialMonth ?? 0); // 0 = full year

  const [rows,       setRows]       = useState<ClosedRequestTopResolverRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  const exportMenuRef     = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch on period change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getClosedRequestsTopResolvers(year, month, topN)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e.message ?? 'Failed to load data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, month, topN]);

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

  // Chart data
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name:  truncate(r.assigneeName),
        full:  r.assigneeName,
        count: r.count,
        rank:  r.rank,
      })),
    [rows],
  );

  const totalClosed = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);
  const maxCount    = useMemo(() => Math.max(...rows.map((r) => r.count), 0), [rows]);

  // Dynamic height — taller when more rows
  const chartHeight = Math.max(260, rows.length * 32 + 40);

  const periodLabel = month > 0
    ? `${MONTH_NAMES[month - 1] ?? ''} ${year}`
    : `Full Year ${year}`;

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
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
            MFG IT ADPH 24/7
          </p>
          <h2 className="text-sm font-bold text-gray-800 leading-tight">
            CLOSED REQUESTS – Top Resolvers
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Month selector — 0 = Full Year */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
            aria-label="Select month"
          >
            <option value={0}>Full Year</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>

          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
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
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
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
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1 min-w-37">
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-52">
            <div
              className="animate-spin h-8 w-8 rounded-full border-4 border-green-500 border-t-transparent"
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

        {/* Chart + table */}
        {!loading && !error && (
          <>
            {/* Period pill + total */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">
                Top {Math.min(topN, rows.filter((r) => r.assigneeName !== 'Other').length)} resolvers · {periodLabel}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
                {totalClosed.toLocaleString()} total
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-sm text-gray-400">
                No closed requests for {periodLabel}.
              </div>
            ) : (
              <>
                {/* ── Horizontal bar chart ── */}
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />

                    <XAxis
                      type="number"
                      domain={[0, Math.ceil(maxCount * 1.15)]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 11, fill: '#374151' }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      formatter={(value: unknown) => [Number(value).toLocaleString(), 'Closed']}
                      labelFormatter={(label: unknown) => {
                        const row = chartData.find((d) => d.name === String(label));
                        return row?.full ?? String(label);
                      }}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                      cursor={{ fill: '#f0fdf4' }}
                    />

                    <Bar
                      dataKey="count"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={22}
                      style={{ cursor: onResolverClick ? 'pointer' : 'default' }}
                      onClick={(data) => {
                        const full = (data as unknown as { full?: string }).full;
                        if (onResolverClick && full && full !== 'Other') {
                          onResolverClick(full);
                        }
                      }}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.full}
                          fill={
                            entry.full === 'Other'
                              ? BAR_COLOR_OTHER
                              : (GREEN_SHADES[index % GREEN_SHADES.length] ?? GREEN_SHADES[0])
                          }
                        />
                      ))}
                      <LabelList content={(props) => <BarValueLabel {...(props as BarLabelProps)} />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* ── Ranking table ── */}
                <div className="mt-4 border border-gray-100 rounded-lg overflow-x-auto">
                  <table className="min-w-full text-xs divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
                        <th className="px-3 py-2 text-right font-semibold text-green-700 uppercase tracking-wide">Closed</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-400 uppercase tracking-wide">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {rows.map((row, index) => {
                        const pct = totalClosed > 0
                          ? ((row.count / totalClosed) * 100).toFixed(1)
                          : '0.0';
                        const isOther = row.assigneeName === 'Other';
                        const barColor = isOther
                          ? BAR_COLOR_OTHER
                          : (GREEN_SHADES[index % GREEN_SHADES.length] ?? GREEN_SHADES[0]);
                        return (
                          <tr
                            key={row.assigneeName}
                            onClick={() => {
                              if (!isOther && onResolverClick) onResolverClick(row.assigneeName);
                            }}
                            className={[
                              'transition-colors',
                              !isOther && onResolverClick ? 'cursor-pointer hover:bg-green-50' : 'hover:bg-green-50',
                            ].join(' ')}
                          >
                            <td className="px-3 py-1.5 font-mono text-gray-400 text-center">
                              {isOther ? '—' : row.rank}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-gray-700">
                              <span className="flex items-center gap-2">
                                {/* Colour swatch matching bar */}
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: barColor }}
                                  aria-hidden="true"
                                />
                                {isOther ? (
                                  <span className="italic text-gray-400">{row.assigneeName}</span>
                                ) : (
                                  <span className={onResolverClick ? 'text-green-700 hover:underline' : ''}>
                                    {row.assigneeName}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-green-700 tabular-nums">
                              {row.count.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-500 tabular-nums">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                      {/* Grand total */}
                      <tr className="bg-green-50 border-t-2 border-green-200 font-semibold">
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-gray-700">Grand Total</td>
                        <td className="px-3 py-2 text-right text-green-700 tabular-nums">
                          {totalClosed.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">100%</td>
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
