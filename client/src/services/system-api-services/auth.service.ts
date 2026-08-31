/**
 * Auth API service — wraps the /api/auth/* endpoints.
 *
 * The shape of `SafeUser` mirrors the server's SafeUser type (User without
 * passwordHash). It is purposely a superset of the `SessionUser` stored in
 * AuthContext so that the context can cast it down to the subset it needs.
 */

import { apiFetch } from '../../config/api.config';

/** Full user object returned by the API (passwordHash is never included). */
export interface SafeUser {
  id: number;
  employeeId: string | null;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/auth/login
 * Submits credentials. The server sets the session cookie on success.
 *
 * @throws {ApiError} 400 — missing/empty fields
 * @throws {ApiError} 401 — invalid credentials
 * @throws {ApiError} 403 — account inactive
 */
export async function login(email: string, password: string): Promise<SafeUser> {
  return apiFetch<SafeUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * POST /api/auth/logout
 * Destroys the session cookie on the server side.
 */
export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}

/**
 * GET /api/auth/me
 * Returns the currently authenticated user, or throws 401 if unauthenticated.
 */
export async function me(): Promise<SafeUser> {
  return apiFetch<SafeUser>('/auth/me');
}
