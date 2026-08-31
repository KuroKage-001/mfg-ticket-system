/**
 * Employee ticket API service — wraps ticket endpoints scoped to the
 * EMPLOYEE role (ticket creation and permitted status transitions).
 *
 * Shared read operations (listTickets, getTicketById) live in
 * system-api-services/ticket.service.ts and are available to all roles.
 * Admin-only ticket actions live in admin-api-services/ticket.service.ts.
 */

import { apiFetch, BASE_URL } from '../../config/api.config';
import type { ApiError } from '../../config/api.config';
import type { TicketDetail } from '../system-api-services/ticket.service';

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

/**
 * Body for POST /api/tickets.
 * `assignedToId` is accepted in the request but ignored by the server when
 * the requester is an EMPLOYEE (per Req 3.6).
 */
export interface CreateTicketDto {
  title: string;
  description: string;
  category: string;
  priority: string;
  assignedToId?: number;
  usedKnowledgeBase?: boolean;
  contactMethod?: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * POST /api/tickets
 * Creates a new ticket with status OPEN. The authenticated user is recorded
 * as the creator.
 *
 * @throws {ApiError} 400 — missing or invalid field
 * @throws {ApiError} 401 — unauthenticated
 */
export async function createTicket(dto: CreateTicketDto): Promise<TicketDetail> {
  return apiFetch<TicketDetail>('/tickets', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

/**
 * POST /api/tickets/:id/attachments
 * Uploads image files as multipart/form-data.
 * Returns the saved attachment records.
 */
export async function uploadAttachments(
  ticketId: number,
  files: File[],
): Promise<unknown[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  // Use raw fetch — apiFetch forces Content-Type: application/json
  const response = await fetch(`${BASE_URL}/tickets/${ticketId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) {
    let errorBody: { message?: string; field?: string } = {};
    try { errorBody = await response.json() as typeof errorBody; } catch { /* ignore */ }
    throw { message: errorBody.message ?? `Upload failed with status ${response.status}`, field: errorBody.field } as ApiError;
  }
  return response.json() as Promise<unknown[]>;
}

/**
 * POST /api/tickets/:id/status
 * Transitions the ticket to the given status. Valid employee transitions
 * (only on tickets assigned to the requesting user) are:
 *   OPEN        → IN_PROGRESS
 *   IN_PROGRESS → RESOLVED
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 403 — ticket not assigned to the requesting user, or
 *                          attempting a CLOSED/CANCELLED transition
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
