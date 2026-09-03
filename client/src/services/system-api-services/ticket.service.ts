/**
 * System ticket API service — wraps shared ticket endpoints available to
 * both ADMIN and EMPLOYEE roles.
 *
 * Admin-only and employee-only ticket actions live in their respective
 * service files under admin-api-services/ and client-api-services/.
 */

import { apiFetch } from '../../config/api.config';
import type { SafeUser } from './auth.service';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Minimal ticket record used in list responses. */
export interface TicketSummary {
  id: number;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  usedKnowledgeBase: boolean;
  contactMethod: string | null;
  manufacturingSite: string | null;
  assignedToId: number | null;
  assignedToName: string | null;
  resolvedById: number | null;
  resolvedByName: string | null;
  closedById: number | null;
  closedByName: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

/** A comment attached to a ticket. */
export interface TicketComment {
  id: number;
  content: string;
  ticketId: number;
  authorId: number;
  createdAt: string;
}

/** An immutable activity log entry for a ticket. */
export interface TicketActivity {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  ticketId: number;
  actorId: number;
  createdAt: string;
}

/** A file attachment on a ticket. */
export interface TicketAttachment {
  id: number;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** Full ticket detail including relations. */
export interface TicketDetail extends TicketSummary {
  description: string;
  usedKnowledgeBase: boolean;
  contactMethod: string | null;
  manufacturingSite: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdBy: SafeUser;
  assignedTo: SafeUser | null;
  resolvedBy: SafeUser | null;
  closedBy: SafeUser | null;
  comments: TicketComment[];
  activities: TicketActivity[];
  attachments: TicketAttachment[];
}

/** Query parameters accepted by GET /api/tickets. */
export interface TicketListQuery {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  assignedToId?: number;
  createdById?: number;
  /** When true, fetches only tickets with no assignee */
  unassigned?: boolean;
}

/** Paginated response wrapper. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * GET /api/tickets
 * Returns a paginated list of tickets, optionally filtered by the supplied
 * query parameters.
 *
 * @throws {ApiError} 400 — invalid query parameter value
 * @throws {ApiError} 401 — unauthenticated
 */
export async function listTickets(
  query: TicketListQuery = {},
): Promise<PaginatedResult<TicketSummary>> {
  // Build query string from non-undefined values only.
  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.status !== undefined) params.set('status', query.status);
  if (query.priority !== undefined) params.set('priority', query.priority);
  if (query.search !== undefined) params.set('search', query.search);
  if (query.assignedToId !== undefined) params.set('assignedToId', String(query.assignedToId));
  if (query.createdById !== undefined) params.set('createdById', String(query.createdById));
  if (query.unassigned === true) params.set('unassigned', 'true');

  const queryString = params.toString();
  const path = queryString ? `/tickets?${queryString}` : '/tickets';

  return apiFetch<PaginatedResult<TicketSummary>>(path);
}

/**
 * GET /api/tickets/:id
 * Returns the full ticket detail including creator, assignee, comments,
 * and activities.
 *
 * @throws {ApiError} 401 — unauthenticated
 * @throws {ApiError} 404 — ticket not found
 */
export async function getTicketById(id: number): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/tickets/${id}`);
}

/**
 * GET /api/tickets/:id/attachments
 * Returns all image attachments for the given ticket.
 */
export async function getTicketAttachments(id: number): Promise<TicketAttachment[]> {
  return apiFetch<TicketAttachment[]>(`/tickets/${id}/attachments`);
}
