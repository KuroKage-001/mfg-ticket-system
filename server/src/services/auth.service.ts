import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { sessionOptions } from "@/lib/session";
import type { SessionData } from "@/lib/session";
import type { SessionUser } from "@/types/session.types";
import type { SafeUser } from "@/types/user.types";
import { ApiError } from "@/utils/api-error";
import { stripPasswordHash } from "@/utils/strip-password";

/**
 * Auth_Service — authentication and session management.
 *
 * Responsibilities:
 * - Validate login credentials (email lookup → bcrypt compare)
 * - Create and destroy iron-session sessions
 * - Expose getSession() helper for route handlers and middleware
 * - Enforce isActive check before granting a session
 *
 * Satisfies Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 13.4
 */

/**
 * Authenticates a user, saves a SessionUser into iron-session, and returns
 * the safe user object (no passwordHash).
 *
 * Error cases:
 * - 400: missing or empty email / password (Req 1.7)
 * - 401: email not found or password mismatch (Req 1.2) — generic message to
 *        prevent credential enumeration
 * - 403: valid credentials but account is inactive (Req 1.3)
 *
 * @param email    Raw email string from request body
 * @param password Raw password string from request body
 * @param session  IronSession instance (obtained via getIronSession in route handler)
 */
export async function login(
  email: string,
  password: string,
  session: IronSession<SessionData>
): Promise<SafeUser> {
  // --- Req 1.7: validate required fields ---
  if (!email || email.trim() === "") {
    throw new ApiError(400, "Email is required", "email");
  }
  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is required", "password");
  }

  // --- Req 1.2: look up user by email ---
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // --- Req 1.2: generic 401 — do NOT reveal whether email or password failed ---
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // --- Req 14.3: bcrypt comparison ---
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  // --- Req 1.3: inactive account check ---
  if (!user.isActive) {
    throw new ApiError(403, "Account is inactive");
  }

  // --- Req 1.1: build SessionUser payload and save into iron-session cookie ---
  const sessionUser: SessionUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as "ADMIN" | "EMPLOYEE",
  };

  session.user = sessionUser;
  await session.save();

  // --- Req 1.6: strip passwordHash before returning ---
  return stripPasswordHash(user) as SafeUser;
}

/**
 * Destroys the current session and clears the HTTP-only session cookie.
 *
 * Satisfies Requirement 1.4.
 *
 * @param session IronSession instance to destroy
 */
export async function logout(session: IronSession<SessionData>): Promise<void> {
  session.destroy();
}

/**
 * Retrieves the SessionUser from the current request's iron-session cookie.
 * Returns null if no valid session exists (absent, expired, or invalid).
 *
 * Satisfies Requirements 1.8, 1.9, 1.10.
 *
 * Uses next/headers cookies() so it can be called from App Router route
 * handlers and Server Components without passing req/res.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session.user ?? null;
}
