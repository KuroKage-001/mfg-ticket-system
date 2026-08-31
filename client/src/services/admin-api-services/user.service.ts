/**
 * Admin user API service — wraps the /api/users/* endpoints.
 * All endpoints are restricted to ADMIN users.
 */

import { apiFetch } from '../../config/api.config';
import type { SafeUser } from '../system-api-services/auth.service';
import type { PaginatedResult } from '../system-api-services/ticket.service';

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

/** Query parameters accepted by GET /api/users. */
export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  isActive?: boolean;
}

/** Body for POST /api/users — all fields required. */
export interface CreateUserDto {
  employeeId?: string;
  fullName: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
}

/** Body for PATCH /api/users/:id — all fields optional. */
export interface UpdateUserDto {
  employeeId?: string | null;
  fullName?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * GET /api/users
 * Returns a paginated list of users, optionally filtered by the supplied
 * query parameters.
 *
 * @throws {ApiError} 400 — invalid query parameter value (e.g. bad role/isActive)
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 */
export async function listUsers(
  query: UserListQuery = {},
): Promise<PaginatedResult<SafeUser>> {
  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.search !== undefined) params.set('search', query.search);
  if (query.role !== undefined) params.set('role', query.role);
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));

  const queryString = params.toString();
  const path = queryString ? `/users?${queryString}` : '/users';

  return apiFetch<PaginatedResult<SafeUser>>(path);
}

/**
 * POST /api/users
 * Creates a new user account. The server hashes the password before storage.
 *
 * @throws {ApiError} 400 — missing or invalid field
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 409 — email already exists
 */
export async function createUser(dto: CreateUserDto): Promise<SafeUser> {
  return apiFetch<SafeUser>('/users', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/**
 * GET /api/users/:id
 * Returns the user with the given ID.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 404 — user not found
 */
export async function getUserById(id: number): Promise<SafeUser> {
  return apiFetch<SafeUser>(`/users/${id}`);
}

/**
 * PATCH /api/users/:id
 * Updates only the supplied fields on the user with the given ID.
 *
 * @throws {ApiError} 400 — invalid or empty update body
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 404 — user not found
 * @throws {ApiError} 409 — updated email already belongs to another account
 */
export async function updateUser(id: number, dto: UpdateUserDto): Promise<SafeUser> {
  return apiFetch<SafeUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
