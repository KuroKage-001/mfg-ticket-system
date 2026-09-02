/**
 * Category API service — wraps /api/categories endpoints.
 * Available to any authenticated user for reads; mutations are admin-only
 * (enforced server-side).
 */

import { apiFetch } from '../../config/api.config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TicketCategory {
  id:        number;
  name:      string;
  isActive:  boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name:       string;
  sortOrder?: number;
}

export interface UpdateCategoryDto {
  name?:      string;
  sortOrder?: number;
  isActive?:  boolean;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * GET /api/categories
 * Returns all active categories ordered by sortOrder then name.
 * Available to any authenticated user.
 */
export async function listCategories(): Promise<TicketCategory[]> {
  return apiFetch<TicketCategory[]>('/categories');
}

/**
 * POST /api/categories
 * Creates a new category. Admin only (enforced server-side).
 *
 * @throws {ApiError} 400 — missing/invalid name
 * @throws {ApiError} 409 — duplicate name
 */
export async function createCategory(dto: CreateCategoryDto): Promise<TicketCategory> {
  return apiFetch<TicketCategory>('/categories', {
    method: 'POST',
    body:   JSON.stringify(dto),
  });
}

/**
 * PATCH /api/categories/:id
 * Updates name, sortOrder, or isActive. Admin only.
 *
 * @throws {ApiError} 400 — invalid fields
 * @throws {ApiError} 404 — not found
 * @throws {ApiError} 409 — duplicate name
 */
export async function updateCategory(
  id:  number,
  dto: UpdateCategoryDto,
): Promise<TicketCategory> {
  return apiFetch<TicketCategory>(`/categories/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(dto),
  });
}

/**
 * DELETE /api/categories/:id
 * Hard-deletes a category. Admin only.
 *
 * @throws {ApiError} 404 — not found
 */
export async function deleteCategory(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}
