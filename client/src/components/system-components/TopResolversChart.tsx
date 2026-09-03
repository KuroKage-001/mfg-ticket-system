/**
 * TopResolversChart
 *
 * "MFG IT ADPH 24/7 – RESOLVED INCIDENTS – Top Resolvers"
 *
 * Horizontal bar chart showing the top N assignees ranked by their resolved
 * INC* ticket count for a selected period (month/year or full year).
 * Matches the reference design:
 *   - Bars sorted longest → shortest (top to bottom)
 *   - Teal/blue bars on a white card
 *   - "Other" bucket at the bottom for everyone outside the top N
 *   - Year + Month selectors + three-dot export menu
 *   - Export: CSV · Excel (.xlsx) · PNG · JPEG
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LabelList, ResponsiveContainer,
} from 'recharts';
import { exportImage } from '../../utilities/exportImage';
import * as XLSXStyle from 'xlsx-js-style';
import {
  getTopResolvers,
  type TopResolverRow,
} from '../../services/system-api-services/dashboard.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_COLOR       = '#3b82f6';  // blue-500  — main bars
const BAR_COLOR_OTHER = '#94a3b8';  // slate-400 — "Other" bucket
const TOP_N_DEFAULT   = 10;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYear():  number { return new Date().getFullYear(); }

function yearOptions(): number[] {
  const y = currentYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

/** Truncate long names with an ellipsis so Y-axis labels don't overflow */
function truncate(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function buildFilename(year: number, month: number, ext: string): string {
  const m = month > 0 ? `-${String(month).padStart(2, '0')}` : '';
  return `resolved-incidents-top-resolvers-${year}${m}.${ext}`;
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

function exportCSV(rows: TopResolverRow[], year: number, month: number): void {
  const header = ['Rank', 'Assignee', 'Resolved Count'];
  const lines  = rows.map((r) => [r.rank, `"${r.assigneeName}"`, r.count]);
  const csv    = [header, ...lines].map((r) => r.join(',')).join('\r\n');
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    buildFilename(year, month, 'csv'),
  );
}

function exportExcel(rows: TopResolverRow[], year: number, month: number): void {
  const wb = XLSXStyle.utils.book_new();

  const data: (string | number)[][] = [
    ['Rank', 'Assignee', 'Resolved Count'],
    ...rows.map((r) => [r.rank, r.assigneeName, r.count]),
  ];

  const ws = XLSXStyle.utils.aoa_to_sheet(data);

  // Style header row — teal
  (['A1', 'B1', 'C1'] as const).forEach((addr) => {
    ws[addr] = {
      ...ws[addr],
      s: {
        font:      { bold: true, color: { rgb: 'FFFFFF' } },
        fill:      { fgColor: { rgb: '3B82F6' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 16 }];

  const sheetName = month > 0
    ? `${MONTH_NAMES[month - 1]?.slice(0, 3) ?? ''} ${year}`
    : `${year} Full Year`;

  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);
  XLSXStyle.writeFile(wb, buildFilename(year, month, 'xlsx'));
}

// ---------------------------------------------------------------------------
// Custom bar label — count value shown at the right end of each bar
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

export interface TopResolversChartProps {
  initialYear?:  number;
  initialMonth?: number;
  /** How many named entries to show before "Other" (default 10) */
  topN?: number;
  /**
   * Called when the user clicks a named resolver bar or table row.
   * Receives the full assignee name. "Other" rows are not clickable.
   */
  onResolverClick?: (assigneeName: string) => void;
}

export default function TopResolversChart({
  initialYear,
  initialMonth,
  topN = TOP_N_DEFAULT,
  onResolverClick,
}: TopResolversChartProps): React.ReactElement {
  const [year,  setYear]  = useState<number>(initialYear  ?? currentYear());
  const [month, setMonth] = useState<number>(initialMonth ?? 0);  // 0 = full year

  const [rows,       setRows]       = useState<TopResolverRow[]>([]);
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
    getTopResolvers(year, month, topN)
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

  // Chart data — recharts horizontal bar needs the data in reverse order
  // (first entry renders at the top when layout="vertical")
  // so we keep rows as-is (rank 1 at top) and rely on recharts layout.
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

  const totalResolved = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);
  const maxCount      = useMemo(() => Math.max(...rows.map((r) => r.count), 0), [rows]);

  // Dynamic chart height — taller when more rows
  const chartHeight = Math.max(260, rows.length * 32 + 40);

  // Period label for the header pill
  const periodLabel = month > 0
    ? `${MONTH_NAMES[month - 1] ?? ''} ${year}`
    : `Full Year ${year}`;

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
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            MFG IT ADPH 24/7
          </p>
          <h2 className="text-sm font-bold text-gray-800 leading-tight">
            RESOLVED INCIDENTS – Top Resolvers
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Month selector — 0 = Full Year */}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
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
            className="text-xs rounded border border-gray-300 bg-white text-gray-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Select year"
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Export menu — three-dot */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
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
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-400 border-t-transparent" aria-label="Loading" />
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
                Top {Math.min(topN, rows.filter(r => r.assigneeName !== 'Other').length)} resolvers · {periodLabel}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                {totalResolved.toLocaleString()} total
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-sm text-gray-400">
                No resolved incidents for {periodLabel}.
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
                      formatter={(value: unknown) => [Number(value).toLocaleString(), 'Resolved']}
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
                      cursor={{ fill: '#f8fafc' }}
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
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.full}
                          fill={entry.full === 'Other' ? BAR_COLOR_OTHER : BAR_COLOR}
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
                        <th className="px-3 py-2 text-right font-semibold text-blue-600 uppercase tracking-wide">Resolved</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-400 uppercase tracking-wide">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {rows.map((row) => {
                        const pct = totalResolved > 0
                          ? ((row.count / totalResolved) * 100).toFixed(1)
                          : '0.0';
                        const isOther = row.assigneeName === 'Other';
                        return (
                          <tr
                            key={row.assigneeName}
                            onClick={() => {
                              if (!isOther && onResolverClick) onResolverClick(row.assigneeName);
                            }}
                            className={[
                              'transition-colors',
                              isOther ? 'text-gray-400' : '',
                              !isOther && onResolverClick ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-blue-50',
                            ].join(' ')}
                          >
                            <td className="px-3 py-1.5 font-mono text-gray-400 text-center">
                              {isOther ? '—' : row.rank}
                            </td>
                            <td className="px-3 py-1.5 font-medium text-gray-700">
                              {isOther ? (
                                <span className="italic text-gray-400">{row.assigneeName}</span>
                              ) : (
                                <span className={onResolverClick ? 'text-blue-700 hover:underline' : ''}>
                                  {row.assigneeName}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-blue-700">
                              {row.count.toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-500">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                      {/* Grand total */}
                      <tr className="bg-blue-50 border-t-2 border-blue-200 font-semibold">
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 text-gray-700">Grand Total</td>
                        <td className="px-3 py-2 text-right text-blue-700">{totalResolved.toLocaleString()}</td>
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
