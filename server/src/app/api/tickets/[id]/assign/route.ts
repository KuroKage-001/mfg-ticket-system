import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import * as Ticket_Service from "@/services/ticket.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/tickets/:id/assign
 *
 * Assigns a ticket to a target user. ADMIN only.
 *
 * Request body:
 *   { assignedToId: number }
 *
 * Responses:
 * - 200  TicketDetail (updated ticket)
 * - 400  Non-numeric ticket ID or invalid assignedToId
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 * - 404  Ticket or target user not found
 * - 422  Ticket is CLOSED/CANCELLED, target user is inactive, or target user is ADMIN
 *
 * Satisfies Requirements 5.1–5.8
 */
export async function POST(
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

    const parsedAssignedToId = parseInt(body.assignedToId, 10);
    if (isNaN(parsedAssignedToId) || typeof body.assignedToId === "undefined") {
      throw new ApiError(400, "assignedToId must be a valid user ID.", "assignedToId");
    }

    const updated = await Ticket_Service.assignTicket(id, parsedAssignedToId, user);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
