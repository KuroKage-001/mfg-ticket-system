import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { getClosedRequestsDaily } from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/closed-requests-daily?year=2025&month=8
 *
 * Returns the daily count of CLOSED tickets for every calendar day in the
 * requested month/year. Days with zero closures are included so the area
 * chart renders a continuous line.
 *
 * All ticket categories are covered (no title-prefix filter).
 *
 * Query params:
 *  - year  (optional) 4-digit year, defaults to current year
 *  - month (optional) 1–12, defaults to current month
 *
 * Responses:
 * - 200  ClosedRequestDayRow[]
 * - 400  Invalid year or month parameter
 * - 401  Unauthenticated
 * - 503  Database unavailable
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await authGuard();

    const now = new Date();
    const yearParam  = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");

    const year  = yearParam  ? parseInt(yearParam,  10) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { message: "Invalid year parameter. Must be a 4-digit year between 2000 and 2100." },
        { status: 400 },
      );
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { message: "Invalid month parameter. Must be between 1 and 12." },
        { status: 400 },
      );
    }

    const data = await getClosedRequestsDaily(year, month);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
