/**
 * Dashboard API service — wraps the /api/dashboard/* endpoints.
 */

import { apiFetch } from '../../config/api.config';

/** Minimal ticket shape used in the dashboard recent-tickets list. */
export interface TicketSummary {
  id: number;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  assignedToId: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shape returned by GET /api/dashboard/summary.
 * Count fields map directly to the server's DashboardSummary type.
 */
export interface DashboardSummary {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  urgent: number;
  unassigned: number;
  myAssigned: number;
  recentTickets: TicketSummary[];
}

/**
 * GET /api/dashboard/summary
 * Returns aggregated ticket counts and the 10 most recently created tickets.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/dashboard/summary');
}

/** One row returned by GET /api/dashboard/resolved-incidents-monthly */
export interface ResolvedIncidentMonthRow {
  /** ISO month string, e.g. "2025-01" */
  month: string;
  assigneeName: string;
  count: number;
}

/**
 * GET /api/dashboard/resolved-incidents-monthly?year=YYYY
 *
 * Returns resolved INC* ticket counts grouped by calendar month and assignee.
 * Defaults to the current year when year is omitted.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getResolvedIncidentsMonthly(
  year?: number,
): Promise<ResolvedIncidentMonthRow[]> {
  const qs = year ? `?year=${year}` : '';
  return apiFetch<ResolvedIncidentMonthRow[]>(
    `/dashboard/resolved-incidents-monthly${qs}`,
  );
}

/** One row returned by GET /api/dashboard/resolved-incidents-daily */
export interface ResolvedIncidentDayRow {
  /** ISO date string, e.g. "2025-08-01" */
  date: string;
  count: number;
}

/**
 * GET /api/dashboard/resolved-incidents-daily?year=YYYY&month=M
 *
 * Returns resolved INC* ticket counts for every calendar day in the
 * requested month. Days with zero resolutions are included so the chart
 * renders a continuous line. Defaults to current year/month when omitted.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getResolvedIncidentsDaily(
  year?: number,
  month?: number,
): Promise<ResolvedIncidentDayRow[]> {
  const params = new URLSearchParams();
  if (year  != null) params.set('year',  String(year));
  if (month != null) params.set('month', String(month));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<ResolvedIncidentDayRow[]>(
    `/dashboard/resolved-incidents-daily${qs}`,
  );
}

/** One row returned by GET /api/dashboard/resolved-incidents-top-resolvers */
export interface TopResolverRow {
  assigneeName: string;
  count: number;
  /** 1-based rank position */
  rank: number;
}

/**
 * GET /api/dashboard/resolved-incidents-top-resolvers
 *      ?year=YYYY&month=M&topN=10
 *
 * Returns the top N assignees ranked by resolved INC* count.
 * month = 0 (default) means full year.
 * Assignees beyond topN are aggregated into a single "Other" entry.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getTopResolvers(
  year?: number,
  month?: number,
  topN?: number,
): Promise<TopResolverRow[]> {
  const params = new URLSearchParams();
  if (year  != null) params.set('year',  String(year));
  if (month != null) params.set('month', String(month));
  if (topN  != null) params.set('topN',  String(topN));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<TopResolverRow[]>(
    `/dashboard/resolved-incidents-top-resolvers${qs}`,
  );
}

/** One row returned by GET /api/dashboard/closed-requests-monthly */
export interface ClosedRequestMonthRow {
  /** ISO month string, e.g. "2025-01" */
  month: string;
  assigneeName: string;
  count: number;
}

/**
 * GET /api/dashboard/closed-requests-monthly?year=YYYY
 *
 * Returns closed ticket counts grouped by calendar month and assignee.
 * Covers ALL ticket categories (no INC prefix filter).
 * Defaults to the current year when year is omitted.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getClosedRequestsMonthly(
  year?: number,
): Promise<ClosedRequestMonthRow[]> {
  const qs = year ? `?year=${year}` : '';
  return apiFetch<ClosedRequestMonthRow[]>(
    `/dashboard/closed-requests-monthly${qs}`,
  );
}

/** One row returned by GET /api/dashboard/closed-requests-daily */
export interface ClosedRequestDayRow {
  /** ISO date string, e.g. "2025-08-01" */
  date: string;
  count: number;
}

/**
 * GET /api/dashboard/closed-requests-daily?year=YYYY&month=M
 *
 * Returns closed ticket counts for every calendar day in the requested
 * month. Days with zero closures are included for a continuous chart line.
 * Covers ALL ticket categories (no INC prefix filter).
 * Defaults to current year/month when omitted.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getClosedRequestsDaily(
  year?: number,
  month?: number,
): Promise<ClosedRequestDayRow[]> {
  const params = new URLSearchParams();
  if (year  != null) params.set('year',  String(year));
  if (month != null) params.set('month', String(month));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<ClosedRequestDayRow[]>(
    `/dashboard/closed-requests-daily${qs}`,
  );
}

/** One row returned by GET /api/dashboard/closed-requests-top-resolvers */
export interface ClosedRequestTopResolverRow {
  assigneeName: string;
  count: number;
  /** 1-based rank position */
  rank: number;
}

/**
 * GET /api/dashboard/closed-requests-top-resolvers?year=YYYY&month=M&topN=10
 *
 * Returns the top N assignees ranked by closed ticket count.
 * month = 0 (default) means full year.
 * Covers ALL ticket categories (no INC prefix filter).
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 503 — database unavailable
 */
export async function getClosedRequestsTopResolvers(
  year?: number,
  month?: number,
  topN?: number,
): Promise<ClosedRequestTopResolverRow[]> {
  const params = new URLSearchParams();
  if (year  != null) params.set('year',  String(year));
  if (month != null) params.set('month', String(month));
  if (topN  != null) params.set('topN',  String(topN));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<ClosedRequestTopResolverRow[]>(
    `/dashboard/closed-requests-top-resolvers${qs}`,
  );
}
