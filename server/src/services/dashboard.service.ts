/**
 * Dashboard service — aggregates ticket counts and recent activity for the
 * authenticated user's dashboard view.
 *
 * Satisfies Requirements: 11.1–11.7
 */

import prisma from "../lib/prisma";
import { ApiError } from "../utils/api-error";
import type { DashboardSummary, RecentTicket } from "../types/ticket.types";

// ─── Select shape for recent tickets ──────────────────────────────────────────

const RECENT_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  title: true,
  status: true,
  priority: true,
  createdAt: true,
} as const;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns an aggregated summary of ticket counts and the 10 most recently
 * created tickets for the given actor.
 *
 * All count queries and the recent-tickets fetch are executed inside a single
 * `prisma.$transaction` call so the snapshot is consistent.
 *
 * @param actorId - The `id` of the currently authenticated user (Req 11.4)
 * @throws {ApiError} 503 if the database is unavailable (Req 11.7)
 */
export async function getSummary(actorId: number): Promise<DashboardSummary> {
  try {
    const [
      open,
      inProgress,
      resolved,
      closed,
      cancelled,
      urgent,
      unassigned,
      myAssigned,
      recentTickets,
    ] = await prisma.$transaction([
      // Req 11.1 — count by status
      prisma.ticket.count({ where: { status: "OPEN" } }),
      prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { status: "RESOLVED" } }),
      prisma.ticket.count({ where: { status: "CLOSED" } }),
      prisma.ticket.count({ where: { status: "CANCELLED" } }),

      // Req 11.2 — count URGENT priority tickets
      prisma.ticket.count({ where: { priority: "URGENT" } }),

      // Req 11.3 — count tickets with no assignee
      prisma.ticket.count({ where: { assignedToId: null } }),

      // Req 11.4 — count tickets assigned to the requesting user
      prisma.ticket.count({ where: { assignedToId: actorId } }),

      // Req 11.5 — 10 most recent tickets
      prisma.ticket.findMany({
        select: RECENT_TICKET_SELECT,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      open,
      inProgress,
      resolved,
      closed,
      cancelled,
      urgent,
      unassigned,
      myAssigned,
      recentTickets: recentTickets as RecentTicket[],
    };
  } catch (error) {
    // Re-throw any ApiError as-is (e.g., validation errors from callers)
    if (error instanceof ApiError) {
      throw error;
    }
    // Req 11.7 — DB unavailability surfaces as 503
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Resolved Incidents Monthly ───────────────────────────────────────────────

export interface ResolvedIncidentMonthRow {
  /** e.g. "2025-01" */
  month: string;
  assigneeName: string;
  count: number;
}

/**
 * Returns the count of RESOLVED incidents (title starts with "INC") grouped
 * by calendar month and assignee for the given year (defaults to current year).
 *
 * Only tickets with status = 'RESOLVED' AND resolvedAt IS NOT NULL are counted.
 * The incident type is inferred from the title prefix "INC" (case-insensitive),
 * which matches how CreateTicketModal stores external ticket IDs.
 *
 * Uses a raw SQL query so MySQL can GROUP BY on DATE_FORMAT efficiently —
 * avoids fetching all rows into JS for aggregation.
 */
export async function getResolvedIncidentsMonthly(
  year: number
): Promise<ResolvedIncidentMonthRow[]> {
  try {
    // Prisma.$queryRaw returns BigInt for COUNT(*) — we cast in JS
    const rows = await prisma.$queryRaw<
      Array<{ month: string; assignee_name: string; cnt: bigint }>
    >`
      SELECT
        DATE_FORMAT(t.resolved_at, '%Y-%m')   AS month,
        COALESCE(u.full_name, 'Unassigned')   AS assignee_name,
        COUNT(*)                              AS cnt
      FROM tickets t
      LEFT JOIN users u ON u.id = t.assigned_to_id
      WHERE
        t.status       = 'RESOLVED'
        AND t.resolved_at IS NOT NULL
        AND UPPER(t.title) LIKE 'INC%'
        AND YEAR(t.resolved_at) = ${year}
      GROUP BY month, assignee_name
      ORDER BY month ASC, assignee_name ASC
    `;

    return rows.map((r) => ({
      month: r.month,
      assigneeName: r.assignee_name,
      count: Number(r.cnt),
    }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Resolved Incidents Daily ─────────────────────────────────────────────────

export interface ResolvedIncidentDayRow {
  /** ISO date string, e.g. "2025-08-01" */
  date: string;
  count: number;
}

/**
 * Returns the daily count of RESOLVED incidents (title starts with "INC")
 * for every calendar day in the given month/year.
 *
 * Days with zero resolved incidents are still included so the area chart
 * renders a continuous line rather than skipping dates.
 *
 * Query logic:
 *  - status = 'RESOLVED'
 *  - resolved_at IS NOT NULL  (guard against legacy data)
 *  - UPPER(title) LIKE 'INC%' (incident prefix convention)
 *  - YEAR(resolved_at) = :year AND MONTH(resolved_at) = :month
 *
 * Zero-fill is done in JS so we avoid a LEFT JOIN against a generated
 * date series (not portable across MySQL versions).
 */
export async function getResolvedIncidentsDaily(
  year: number,
  month: number,
): Promise<ResolvedIncidentDayRow[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ day: string; cnt: bigint }>
    >`
      SELECT
        DATE_FORMAT(t.resolved_at, '%Y-%m-%d') AS day,
        COUNT(*)                               AS cnt
      FROM tickets t
      WHERE
        t.status        = 'RESOLVED'
        AND t.resolved_at IS NOT NULL
        AND UPPER(t.title)  LIKE 'INC%'
        AND YEAR(t.resolved_at)  = ${year}
        AND MONTH(t.resolved_at) = ${month}
      GROUP BY day
      ORDER BY day ASC
    `;

    // Build a complete map of day → count from the query results
    const resultMap = new Map<string, number>(
      rows.map((r) => [r.day, Number(r.cnt)]),
    );

    // Determine how many days are in the requested month
    const daysInMonth = new Date(year, month, 0).getDate();

    // Zero-fill every calendar day so the chart has a continuous x-axis
    const filled: ResolvedIncidentDayRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      filled.push({ date: key, count: resultMap.get(key) ?? 0 });
    }

    return filled;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Top Resolvers ────────────────────────────────────────────────────────────

export interface TopResolverRow {
  assigneeName: string;
  count: number;
  /** Rank position (1 = highest count) */
  rank: number;
}

/**
 * Returns the top N resolvers of INC* tickets for the given year/month,
 * ordered by resolved count descending.
 *
 * If month is 0 (or omitted), the full year is used.
 * Assignees beyond the top N are grouped into an "Other" bucket so the
 * chart always has a meaningful tail entry — matching the reference design.
 *
 * Query logic:
 *  - status = 'RESOLVED'
 *  - resolved_at IS NOT NULL
 *  - UPPER(title) LIKE 'INC%'
 *  - Filtered by year; optionally by month when month > 0
 *
 * @param year   4-digit year
 * @param month  1–12, or 0 for full year
 * @param topN   Number of named assignees to show before "Other" bucket (default 10)
 */
export async function getTopResolvers(
  year: number,
  month: number,
  topN = 10,
): Promise<TopResolverRow[]> {
  try {
    // Build the optional month filter fragment in a type-safe way
    const monthFilter =
      month > 0
        ? prisma.$queryRaw<Array<{ assignee_name: string; cnt: bigint }>>`
            SELECT
              COALESCE(u.full_name, 'Unassigned') AS assignee_name,
              COUNT(*)                            AS cnt
            FROM tickets t
            LEFT JOIN users u ON u.id = t.assigned_to_id
            WHERE
              t.status        = 'RESOLVED'
              AND t.resolved_at IS NOT NULL
              AND UPPER(t.title) LIKE 'INC%'
              AND YEAR(t.resolved_at)  = ${year}
              AND MONTH(t.resolved_at) = ${month}
            GROUP BY assignee_name
            ORDER BY cnt DESC
          `
        : prisma.$queryRaw<Array<{ assignee_name: string; cnt: bigint }>>`
            SELECT
              COALESCE(u.full_name, 'Unassigned') AS assignee_name,
              COUNT(*)                            AS cnt
            FROM tickets t
            LEFT JOIN users u ON u.id = t.assigned_to_id
            WHERE
              t.status        = 'RESOLVED'
              AND t.resolved_at IS NOT NULL
              AND UPPER(t.title) LIKE 'INC%'
              AND YEAR(t.resolved_at) = ${year}
            GROUP BY assignee_name
            ORDER BY cnt DESC
          `;

    const rows = await monthFilter;

    if (rows.length === 0) return [];

    // Take top N; everything else goes into an "Other" bucket
    const top     = rows.slice(0, topN);
    const rest    = rows.slice(topN);
    const otherSum = rest.reduce((s, r) => s + Number(r.cnt), 0);

    const result: TopResolverRow[] = top.map((r, i) => ({
      assigneeName: r.assignee_name,
      count: Number(r.cnt),
      rank: i + 1,
    }));

    if (otherSum > 0) {
      result.push({ assigneeName: 'Other', count: otherSum, rank: top.length + 1 });
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Closed Requests Monthly ──────────────────────────────────────────────────

export interface ClosedRequestMonthRow {
  /** e.g. "2025-01" */
  month: string;
  assigneeName: string;
  count: number;
}

/**
 * Returns the count of CLOSED tickets grouped by calendar month and assignee
 * for the given year (defaults to current year).
 *
 * Formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL  (guard against legacy data)
 *  - No title prefix filter — closed requests cover ALL ticket categories
 *  - Grouped by DATE_FORMAT(closed_at, '%Y-%m') and assignee full_name
 *
 * Uses raw SQL so MySQL can efficiently GROUP BY on DATE_FORMAT.
 * COUNT(*) returns BigInt in Prisma — cast to Number in JS.
 */
export async function getClosedRequestsMonthly(
  year: number,
): Promise<ClosedRequestMonthRow[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ month: string; assignee_name: string; cnt: bigint }>
    >`
      SELECT
        DATE_FORMAT(COALESCE(t.closed_at, t.updated_at), '%Y-%m') AS month,
        COALESCE(u.full_name, 'Unassigned')                       AS assignee_name,
        COUNT(*)                                                   AS cnt
      FROM tickets t
      LEFT JOIN users u ON u.id = t.assigned_to_id
      WHERE
        t.status = 'CLOSED'
        AND YEAR(COALESCE(t.closed_at, t.updated_at)) = ${year}
      GROUP BY month, assignee_name
      ORDER BY month ASC, assignee_name ASC
    `;

    return rows.map((r) => ({
      month: r.month,
      assigneeName: r.assignee_name,
      count: Number(r.cnt),
    }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Closed Requests Daily ────────────────────────────────────────────────────

export interface ClosedRequestDayRow {
  /** ISO date string, e.g. "2025-08-01" */
  date: string;
  count: number;
}

/**
 * Returns the daily count of CLOSED tickets for every calendar day in the
 * given month/year.
 *
 * Formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL
 *  - ALL ticket categories (no title prefix filter)
 *  - YEAR(closed_at) = :year AND MONTH(closed_at) = :month
 *
 * Days with zero closed tickets are zero-filled in JS so the area chart
 * renders a continuous line rather than skipping dates.
 */
export async function getClosedRequestsDaily(
  year: number,
  month: number,
): Promise<ClosedRequestDayRow[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ day: string; cnt: bigint }>
    >`
      SELECT
        DATE_FORMAT(COALESCE(t.closed_at, t.updated_at), '%Y-%m-%d') AS day,
        COUNT(*)                                                      AS cnt
      FROM tickets t
      WHERE
        t.status = 'CLOSED'
        AND YEAR(COALESCE(t.closed_at, t.updated_at))  = ${year}
        AND MONTH(COALESCE(t.closed_at, t.updated_at)) = ${month}
      GROUP BY day
      ORDER BY day ASC
    `;

    const resultMap = new Map<string, number>(
      rows.map((r) => [r.day, Number(r.cnt)]),
    );

    const daysInMonth = new Date(year, month, 0).getDate();
    const filled: ClosedRequestDayRow[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      filled.push({ date: key, count: resultMap.get(key) ?? 0 });
    }

    return filled;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}

// ─── Closed Requests Top Resolvers ───────────────────────────────────────────

export interface ClosedRequestTopResolverRow {
  assigneeName: string;
  count: number;
  /** 1-based rank position */
  rank: number;
}

/**
 * Returns the top N closers of tickets for the given year/month,
 * ordered by closed count descending.
 *
 * Formula:
 *  - status = 'CLOSED'
 *  - closed_at IS NOT NULL
 *  - ALL ticket categories (no title prefix filter)
 *  - Filtered by year; optionally by month when month > 0
 *
 * Assignees beyond the top N are grouped into an "Other" bucket.
 *
 * @param year   4-digit year
 * @param month  1–12, or 0 for full year
 * @param topN   Number of named assignees before "Other" bucket (default 10)
 */
export async function getClosedRequestsTopResolvers(
  year: number,
  month: number,
  topN = 10,
): Promise<ClosedRequestTopResolverRow[]> {
  try {
    const rows = await (
      month > 0
        ? prisma.$queryRaw<Array<{ assignee_name: string; cnt: bigint }>>`
            SELECT
              COALESCE(u.full_name, 'Unassigned') AS assignee_name,
              COUNT(*)                            AS cnt
            FROM tickets t
            LEFT JOIN users u ON u.id = t.assigned_to_id
            WHERE
              t.status = 'CLOSED'
              AND YEAR(COALESCE(t.closed_at, t.updated_at))  = ${year}
              AND MONTH(COALESCE(t.closed_at, t.updated_at)) = ${month}
            GROUP BY assignee_name
            ORDER BY cnt DESC
          `
        : prisma.$queryRaw<Array<{ assignee_name: string; cnt: bigint }>>`
            SELECT
              COALESCE(u.full_name, 'Unassigned') AS assignee_name,
              COUNT(*)                            AS cnt
            FROM tickets t
            LEFT JOIN users u ON u.id = t.assigned_to_id
            WHERE
              t.status = 'CLOSED'
              AND YEAR(COALESCE(t.closed_at, t.updated_at)) = ${year}
            GROUP BY assignee_name
            ORDER BY cnt DESC
          `
    );

    if (rows.length === 0) return [];

    const top      = rows.slice(0, topN);
    const rest     = rows.slice(topN);
    const otherSum = rest.reduce((s, r) => s + Number(r.cnt), 0);

    const result: ClosedRequestTopResolverRow[] = top.map((r, i) => ({
      assigneeName: r.assignee_name,
      count: Number(r.cnt),
      rank: i + 1,
    }));

    if (otherSum > 0) {
      result.push({ assigneeName: 'Other', count: otherSum, rank: top.length + 1 });
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Service temporarily unavailable. Please try again later.");
  }
}
