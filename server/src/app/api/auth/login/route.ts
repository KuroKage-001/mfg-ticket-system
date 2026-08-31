import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session";
import * as Auth_Service from "@/services/auth.service";
import { handleApiError } from "@/utils/handle-api-error";

/**
 * POST /api/auth/login
 *
 * Authenticates the user with their email and password.
 * On success, saves a SessionUser into the HTTP-only iron-session cookie and
 * returns the SafeUser object (passwordHash excluded).
 *
 * Request body: { email: string; password: string }
 *
 * Responses:
 * - 200  SafeUser object
 * - 400  Missing or empty email / password
 * - 401  Invalid credentials (generic — no credential enumeration)
 * - 403  Account is inactive
 *
 * Satisfies Requirements 1.1, 1.2, 1.3, 1.6, 1.7
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    const safeUser = await Auth_Service.login(email, password, session);

    return NextResponse.json(safeUser, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
