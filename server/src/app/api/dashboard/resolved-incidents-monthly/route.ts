import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { getResolvedIncidentsMonthly } from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/resolved-incidents-monthly?year=2025
 *
 * Returns resolved incident counts grouped by month and assignee for the
 * requested year (defaults to the current year when omitted).
 *
 * Incidents are identified by tickets whose title begins with "INC" —
 * the prefix convention used when creating external-reference tickets.
 *
 * Responses:
 * - 200  ResolvedIncidentMonthRow[]
 * - 400  Invalid year parameter
 * - 401  Unauthenticated
 * - 503  Database unavailable
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await authGuard();

    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { message: "Invalid year parameter. Must be a 4-digit year between 2000 and 2100." },
        { status: 400 }
      );
    }

    const data = await getResolvedIncidentsMonthly(year);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
