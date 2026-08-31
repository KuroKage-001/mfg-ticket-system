import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { getTopResolvers } from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/resolved-incidents-top-resolvers
 *      ?year=2025&month=8&topN=10
 *
 * Returns the top N assignees ranked by resolved INC* ticket count for the
 * given period. Assignees beyond topN are aggregated into a single "Other"
 * entry so the chart always shows a meaningful tail.
 *
 * Query parameters:
 *   year  — 4-digit year             (default: current year)
 *   month — 1–12, or 0 for full year (default: 0 = full year)
 *   topN  — named slots before Other  (default: 10, max: 50)
 *
 * Responses:
 *   200  TopResolverRow[]
 *   400  Invalid parameter
 *   401  Unauthenticated
 *   503  Database unavailable
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await authGuard();

    const now   = new Date();
    const sp    = req.nextUrl.searchParams;

    const year  = sp.get("year")  ? parseInt(sp.get("year")!,  10) : now.getFullYear();
    const month = sp.get("month") ? parseInt(sp.get("month")!, 10) : 0;
    const topN  = sp.get("topN")  ? parseInt(sp.get("topN")!,  10) : 10;

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ message: "Invalid year. Must be between 2000 and 2100." }, { status: 400 });
    }

    if (isNaN(month) || month < 0 || month > 12) {
      return NextResponse.json({ message: "Invalid month. Must be 0 (full year) or 1–12." }, { status: 400 });
    }

    if (isNaN(topN) || topN < 1 || topN > 50) {
      return NextResponse.json({ message: "Invalid topN. Must be between 1 and 50." }, { status: 400 });
    }

    const data = await getTopResolvers(year, month, topN);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
