import { NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { stripPasswordHash } from "@/utils/strip-password";
import { handleApiError } from "@/utils/handle-api-error";
import prisma from "@/lib/prisma";

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user mapped to the SafeUser shape
 * (passwordHash excluded). Re-fetches the full user record from the database
 * so the response always reflects the latest account state.
 *
 * Responses:
 * - 200  SafeUser object
 * - 401  No valid session or session is expired / user is inactive
 *
 * Satisfies Requirements 1.8, 1.9, 1.10
 */
export async function GET(): Promise<NextResponse> {
  try {
    const sessionUser = await authGuard();

    // Fetch the full user record to return a complete SafeUser shape
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
    });

    return NextResponse.json(stripPasswordHash(user), { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
