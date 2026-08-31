/**
 * Admin ticket API service — wraps admin-only ticket action endpoints.
 * All endpoints require an ADMIN session.
 *
 * Shared read operations (listTickets, getTicketById) live in
 * system-api-services/ticket.service.ts and are available to all roles.
 */

import { apiFetch } from '../../config/api.config';
import type { TicketDetail } from '../system-api-services/ticket.service';

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

/**
 * Body for PATCH /api/tickets/:id.
 * All fields are optional — only supplied fields are updated.
 */
export interface UpdateTicketDto {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * PATCH /api/tickets/:id
 * Updates one or more of title, description, category, and priority on the
 * ticket with the given ID. Only changed fields are persisted.
 *
 * @throws {ApiError} 400 — invalid field value or empty body
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 404 — ticket not found
 */
export async function updateTicket(
  id: number,
  dto: UpdateTicketDto,
): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

/**
 * POST /api/tickets/:id/assign
 * Assigns the ticket to the specified active EMPLOYEE user.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 404 — ticket or assignee user not found
 * @throws {ApiError} 422 — assignee is inactive, is an ADMIN, or ticket is terminal
 */
export async function assignTicket(
  id: number,
  assignedToId: number,
): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/tickets/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedToId }),
  });
}

/**
 * POST /api/tickets/:id/status
 * Transitions the ticket to the given status. Valid admin transitions are:
 *   OPEN        → IN_PROGRESS | CANCELLED
 *   IN_PROGRESS → RESOLVED    | CANCELLED
 *   RESOLVED    → CLOSED
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — authenticated user is not ADMIN
 * @throws {ApiError} 404 — ticket not found
 * @throws {ApiError} 422 — transition is not allowed from the current status
 */
export async function transitionStatus(
  id: number,
  status: string,
): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/tickets/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
