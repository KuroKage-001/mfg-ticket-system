import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { getClosedRequestsTopResolvers } from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/closed-requests-top-resolvers?year=2025&month=0&topN=10
 *
 * Returns the top N assignees ranked by CLOSED ticket count for the given
 * year/month. Assignees beyond topN are aggregated into an "Other" entry.
 *
 * All ticket categories are covered (no title-prefix filter).
 *
 * Query params:
 *  - year  (optional) 4-digit year, defaults to current year
 *  - month (optional) 1–12, or 0 for full year (default 0)
 *  - topN  (optional) number of named entries before "Other" (default 10)
 *
 * Responses:
 * - 200  ClosedRequestTopResolverRow[]
 * - 400  Invalid parameter
 * - 401  Unauthenticated
 * - 503  Database unavailable
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await authGuard();

    const now        = new Date();
    const yearParam  = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");
    const topNParam  = req.nextUrl.searchParams.get("topN");

    const year  = yearParam  ? parseInt(yearParam,  10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : 0;
    const topN  = topNParam  ? parseInt(topNParam,  10) : 10;

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { message: "Invalid year parameter. Must be a 4-digit year between 2000 and 2100." },
        { status: 400 },
      );
    }

    if (isNaN(month) || month < 0 || month > 12) {
      return NextResponse.json(
        { message: "Invalid month parameter. Must be 0 (full year) or 1–12." },
        { status: 400 },
      );
    }

    if (isNaN(topN) || topN < 1 || topN > 100) {
      return NextResponse.json(
        { message: "Invalid topN parameter. Must be between 1 and 100." },
        { status: 400 },
      );
    }

    const data = await getClosedRequestsTopResolvers(year, month, topN);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
