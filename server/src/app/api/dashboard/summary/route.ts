import { NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import * as Dashboard_Service from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/summary
 *
 * Returns an aggregated dashboard summary for the authenticated user.
 * Includes per-status ticket counts, urgent count, unassigned count,
 * tickets assigned to the current user, and 10 most recent tickets.
 *
 * Responses:
 * - 200  DashboardSummary
 * - 401  Unauthenticated
 * - 503  Database unavailable
 *
 * Satisfies Requirements 11.1–11.7
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await authGuard();

    const summary = await Dashboard_Service.getSummary(user.id);

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
