import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session";
import { authGuard } from "@/middleware/auth-guard";
import * as Auth_Service from "@/services/auth.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * POST /api/auth/logout
 *
 * Destroys the current session and clears the HTTP-only session cookie.
 * Requires an active, authenticated session.
 *
 * Responses:
 * - 200  { message: "Logged out successfully" }
 * - 401  No valid session (unauthenticated or expired)
 *
 * Satisfies Requirements 1.4, 1.5
 */
export async function POST(): Promise<NextResponse> {
  try {
    // Ensure the caller is authenticated before destroying the session
    await authGuard();

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    await Auth_Service.logout(session);

    return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
