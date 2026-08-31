/**
 * ClosedRequestsChart
 *
 * "MFG IT ADPH 24/7 – CLOSED REQUESTS – Monthly Team Performance Count"
 *
 * Layout:
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  Header + year selector + export menu                           │
 *  ├──────────────────────┬──────────────────────────────────────────┤
 *  │  Gauge (RadialBar)   │  Stacked bar chart per month             │
 *  │  total vs 1 K target │  (one colour band per assignee)          │
 *  ├──────────────────────┴──────────────────────────────────────────┤
 *  │  Monthly summary table                                          │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * Data formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL
 *  - ALL ticket categories (no INC prefix filter)
 *  - Grouped by DATE_FORMAT(closed_at, '%Y-%m') and assignee
 *
 * Export formats: CSV · Excel (.xlsx) · PNG · JPEG
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
  Cell,
} from 'recharts';
import html2canvas from 'html2canvas';
import * as XLSXStyle from 'xlsx-js-style';
import {
  getClosedRequestsMonthly,
  type ClosedRequestMonthRow,
} from '../../services/system-api-services/dashboard.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAUGE_TARGET = 1000;

const MONTH_SHORT: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

/** Slate/indigo palette — visually distinct from the teal resolved-incidents chart */
const BAR_COLORS = [
  '#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#db2777',
  '#ea580c', '#65a30d', '#ca8a04', '#64748b', '#be123c',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortMonth(iso: string): string {
  const m = iso.split('-')[1] ?? '';
  return MONTH_SHORT[m] ?? iso;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return String(n);
}

function yearOptions(): number[] {
  const y = currentYear();
  return [y - 2, y - 1, y, y + 1, y + 2];
}

// ---------------------------------------------------------------------------
// Data transformation
// ---------------------------------------------------------------------------

interface MonthlyBarDatum {
  monthLabel: string;
  monthKey: string;
  total: number;
  [assignee: string]: string | number;
}

function buildBarData(
  rows: ClosedRequestMonthRow[],
  allMonths: string[],
  assignees: string[],
): MonthlyBarDatum[] {
  const byMonth: Record<string, Record<string, number>> = {};

  rows.forEach(({ month, assigneeName, count }) => {
    if (!byMonth[month]) byMonth[month] = {};
    byMonth[month][assigneeName] = (byMonth[month][assigneeName] ?? 0) + count;
  });

  return allMonths.map((m) => {
    const monthData = byMonth[m] ?? {};
    const total = assignees.reduce((s, a) => s + (monthData[a] ?? 0), 0);
    return {
      monthLabel: shortMonth(m),
      monthKey: m,
      total,
      ...Object.fromEntries(assignees.map((a) => [a, monthData[a] ?? 0])),
    };
  });
}

// ---------------------------------------------------------------------------
// Custom gauge label
// ---------------------------------------------------------------------------

interface GaugeLabelProps {
  cx?: number;
  cy?: number;
  total: number;
  target: number;
}

function GaugeLabel({ cx = 0, cy = 0, total, target }: GaugeLabelProps): React.ReactElement {
  return (
    <g>
      <text x={cx} y={cy - 4} textAnchor="middle">
        <tspan style={{ fontSize: 28, fontWeight: 700, fill: '#1e293b' }}>{formatK(total)}</tspan>
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 11, fill: '#94a3b8' }}>
        of {formatK(target)} target
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(
  rows: ClosedRequestMonthRow[],
  year: number,
  barData: MonthlyBarDatum[],
  assignees: string[],
): void {
  const headers = ['Month', ...assignees, 'Total'];
  const csvRows = barData.map((d) => [
    d.monthKey,
    ...assignees.map((a) => String(d[a] ?? 0)),
    String(d.total),
  ]);

  const raw = [
    [],
    ['--- Raw Data ---'],
    ['Month', 'Assignee', 'Count'],
    ...rows.map((r) => [r.month, r.assigneeName, String(r.count)]),
  ];

  const allRows = [headers, ...csvRows, ...raw];
  const csv = allRows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `closed-requests-${year}.csv`);
}

function exportExcel(
  rows: ClosedRequestMonthRow[],
  year: number,
  barData: MonthlyBarDatum[],
  assignees: string[],
): void {
  const wb = XLSXStyle.utils.book_new();

  /* ── Summary sheet ── */
  const summaryHeader = ['Month', ...assignees, 'Total'];
  const summaryData: (string | number)[][] = [
    summaryHeader,
    ...barData.map((d) => [
      d.monthKey,
      ...assignees.map((a) => (d[a] as number) ?? 0),
      d.total,
    ]),
  ];
  const ws1 = XLSXStyle.utils.aoa_to_sheet(summaryData);

  summaryHeader.forEach((_, ci) => {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
    ws1[addr] = {
      ...ws1[addr],
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F46E5' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  ws1['!cols'] = summaryHeader.map((h) => ({ wch: Math.max(h.length + 2, 10) }));
  XLSXStyle.utils.book_append_sheet(wb, ws1, `${year} Summary`);

  /* ── Raw data sheet ── */
  const rawData: (string | number)[][] = [
    ['Month', 'Assignee', 'Count'],
    ...rows.map((r) => [r.month, r.assigneeName, r.count]),
  ];
  const ws2 = XLSXStyle.utils.aoa_to_sheet(rawData);
  ws2['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }];
  XLSXStyle.utils.book_append_sheet(wb, ws2, 'Raw Data');

  XLSXStyle.writeFile(wb, `closed-requests-${year}.xlsx`);
}

async function exportImage(
  containerRef: React.RefObject<HTMLDivElement | null>,
  format: 'png' | 'jpeg',
  year: number,
): Promise<void> {
  if (!containerRef.current) return;
  const canvas = await html2canvas(containerRef.current, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  canvas.toBlob(
    (blob) => {
      if (blob) downloadBlob(blob, `closed-requests-${year}.${format}`);
    },
    `image/${format}`,
    0.95,
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ClosedRequestsChartProps {
  initialYear?: number;
}

export default function ClosedRequestsChart({
  initialYear,
}: ClosedRequestsChartProps): React.ReactElement {
  const [year, setYear] = useState<number>(initialYear ?? currentYear());
  const [rows, setRows] = useState<ClosedRequestMonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch data on year change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getClosedRequestsMonthly(year)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e.message ?? 'Failed to load data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

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

  // Derived data
  const allMonths = useMemo(() => {
    const months: string[] = [];
    for (let m = 1; m <= 12; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return months;
  }, [year]);

  const assignees = useMemo(() => {
    const set = new Set(rows.map((r) => r.assigneeName));
    return Array.from(set).sort();
  }, [rows]);

  const barData = useMemo(
    () => buildBarData(rows, allMonths, assignees),
    [rows, allMonths, assignees],
  );

  const totalClosed = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  const gaugeData = useMemo(() => {
    const pct = Math.min(totalClosed / GAUGE_TARGET, 1);
    return [
      { name: 'Closed',    value: pct * 100,         fill: '#4f46e5' },
      { name: 'Remaining', value: (1 - pct) * 100,   fill: '#e2e8f0' },
    ];
  }, [totalClosed]);

  const handleExportCSV = useCallback((): void => {
    exportCSV(rows, year, barData, assignees);
    setExportOpen(false);
  }, [rows, year, barData, assignees]);

  const handleExportExcel = useCallback((): void => {
    exportExcel(rows, year, barData, assignees);
    setExportOpen(false);
  }, [rows, year, barData, assignees]);

  const handleExportPNG = useCallback((): void => {
    void exportImage(chartContainerRef, 'png', year);
    setExportOpen(false);
  }, [year]);

  const handleExportJPEG = useCallback((): void => {
    void exportImage(chartContainerRef, 'jpeg', year);
    setExportOpen(false);
  }, [year]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="bg-gray-900 px-5 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            MFG IT ADPH 24/7
          </p>
          <h2 className="text-sm font-bold text-white leading-tight">
            CLOSED REQUESTS – Monthly Team Performance Count
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Year selector */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded border border-gray-600 bg-gray-800 text-white px-2.5 py-1 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              aria-haspopup="true"
              aria-expanded={exportOpen}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
              </svg>
              Export
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {exportOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
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
      <div ref={chartContainerRef} className="p-5">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent" aria-label="Loading" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div role="alert" className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Charts */}
        {!loading && !error && (
          <>
            {/* ── Top row: gauge + bar chart ── */}
            <div className="flex flex-col lg:flex-row gap-6 mb-6">

              {/* Gauge */}
              <div className="flex flex-col items-center justify-center lg:w-56 shrink-0">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide text-center">
                  {year} Total Closed
                </p>
                <RadialBarChart
                  width={200}
                  height={130}
                  cx={100}
                  cy={120}
                  innerRadius={70}
                  outerRadius={110}
                  startAngle={180}
                  endAngle={0}
                  data={gaugeData}
                  barSize={22}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={4} background={false} angleAxisId={0}>
                    {gaugeData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </RadialBar>
                  <GaugeLabel cx={100} cy={120} total={totalClosed} target={GAUGE_TARGET} />
                </RadialBarChart>

                {/* Scale labels */}
                <div className="flex justify-between w-44 -mt-1 px-1">
                  <span className="text-xs text-gray-400">0</span>
                  <span className="text-xs text-gray-400">{formatK(GAUGE_TARGET)}</span>
                </div>

                {/* Summary stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-50">
                  <div className="text-center rounded-md bg-indigo-50 py-2 px-1">
                    <p className="text-lg font-bold text-indigo-700">{totalClosed}</p>
                    <p className="text-xs text-indigo-500 leading-tight">Total closed</p>
                  </div>
                  <div className="text-center rounded-md bg-gray-50 py-2 px-1">
                    <p className="text-lg font-bold text-gray-700">
                      {Math.round((totalClosed / GAUGE_TARGET) * 100)}%
                    </p>
                    <p className="text-xs text-gray-400 leading-tight">of target</p>
                  </div>
                </div>
              </div>

              {/* Stacked bar chart */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Monthly breakdown by assignee
                </p>
                {totalClosed === 0 ? (
                  <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                    No closed requests for {year}.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        iconType="circle"
                        iconSize={8}
                      />
                      {assignees.map((assignee, i) => (
                        <Bar
                          key={assignee}
                          dataKey={assignee}
                          stackId="a"
                          fill={BAR_COLORS[i % BAR_COLORS.length]}
                          radius={i === assignees.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Monthly summary table ── */}
            {totalClosed > 0 && (
              <div className="overflow-x-auto rounded-md border border-gray-100">
                <table className="min-w-full text-xs divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        Month
                      </th>
                      {assignees.map((a) => (
                        <th
                          key={a}
                          className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {a}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {barData.map((d) => (
                      <tr key={d.monthKey} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                          {d.monthKey}
                        </td>
                        {assignees.map((a) => (
                          <td key={a} className="px-3 py-2 text-right text-gray-500 tabular-nums">
                            {(d[a] as number) > 0 ? (d[a] as number) : '–'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold text-gray-700 tabular-nums">
                          {d.total > 0 ? d.total : '–'}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-indigo-50 font-semibold">
                      <td className="px-3 py-2 text-gray-700">TOTAL</td>
                      {assignees.map((a) => (
                        <td key={a} className="px-3 py-2 text-right text-indigo-700 tabular-nums">
                          {barData.reduce((s, d) => s + ((d[a] as number) ?? 0), 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right text-indigo-800 tabular-nums">
                        {totalClosed}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
