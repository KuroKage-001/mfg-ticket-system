import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import * as Ticket_Service from "@/services/ticket.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import type { UpdateTicketDto } from "@/types/ticket.types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/tickets/:id
 *
 * Returns the full ticket detail including creator, assignee, all comments,
 * and all activities. Accessible by any authenticated user.
 *
 * Responses:
 * - 200  TicketDetail
 * - 400  Non-numeric ID
 * - 401  Unauthenticated
 * - 404  Ticket not found
 *
 * Satisfies Requirements 4.3, 4.10, 9.4, 10.2
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await authGuard();

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid ticket ID.", "id");
    }

    const ticket = await Ticket_Service.getTicketById(id);

    return NextResponse.json(ticket, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/tickets/:id
 *
 * Partially updates a ticket's mutable fields. ADMIN only.
 * Accepts any subset of: title, description, category, priority.
 * Only fields with changed values trigger activity log entries.
 *
 * Request body: UpdateTicketDto (partial)
 *   { title?, description?, category?, priority? }
 *
 * Responses:
 * - 200  TicketDetail (updated ticket)
 * - 400  Non-numeric ID, empty body, or validation failure
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 * - 404  Ticket not found
 *
 * Satisfies Requirements 6.1–6.6, 8.1–8.6
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await authGuard();
    requireRole(user, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid ticket ID.", "id");
    }

    const body = await req.json();
    const dto: UpdateTicketDto = {};

    if (body.title !== undefined) dto.title = body.title;
    if (body.description !== undefined) dto.description = body.description;
    if (body.category !== undefined) dto.category = body.category;
    if (body.priority !== undefined) dto.priority = body.priority;

    const updated = await Ticket_Service.updateTicket(id, dto, user);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
