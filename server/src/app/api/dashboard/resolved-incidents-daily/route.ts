import { type NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { getResolvedIncidentsDaily } from "@/services/dashboard.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * GET /api/dashboard/resolved-incidents-daily?year=2025&month=8
 *
 * Returns resolved incident counts for every calendar day in the requested
 * month. Days with zero resolutions are included so the chart renders a
 * continuous line.
 *
 * Query parameters:
 *  year  — 4-digit year  (defaults to current year)
 *  month — 1–12          (defaults to current month)
 *
 * Responses:
 *  200  ResolvedIncidentDayRow[]
 *  400  Invalid year or month parameter
 *  401  Unauthenticated
 *  503  Database unavailable
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
        { message: "Invalid year. Must be between 2000 and 2100." },
        { status: 400 },
      );
    }

    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { message: "Invalid month. Must be between 1 and 12." },
        { status: 400 },
      );
    }

    const data = await getResolvedIncidentsDaily(year, month);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
