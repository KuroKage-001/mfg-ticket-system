import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session";
import type { SessionUser } from "@/types/session.types";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";

/**
 * Resolves the current session and validates the user is authenticated and active.
 *
 * Must be called at the top of every protected route handler.
 *
 * - Throws ApiError(401, "Unauthorized") if no valid session exists.
 * - Re-queries the DB to check `isActive`; throws ApiError(401, "Account is inactive") if false.
 *
 * Satisfies Requirements 1.5, 13.1, 13.3, 13.4
 */
export async function authGuard(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.user) {
    throw new ApiError(401, "Unauthorized");
  }

  // Re-query DB on every request to detect accounts deactivated after session creation
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    throw new ApiError(401, "Account is inactive");
  }

  return session.user;
}
