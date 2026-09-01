import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import * as Ticket_Service from "@/services/ticket.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import type { Status } from "@/types/ticket.types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/tickets/:id/status
 *
 * Transitions a ticket's status. Accessible by any authenticated user,
 * subject to role-based transition rules enforced by the service.
 *
 * Request body:
 *   { status: Status }
 *
 * Responses:
 * - 200  TicketDetail (updated ticket)
 * - 400  Non-numeric ticket ID or missing/invalid status value
 * - 401  Unauthenticated
 * - 403  EMPLOYEE attempting a forbidden transition (close/cancel, or not assigned)
 * - 404  Ticket not found
 * - 422  Transition not allowed from current status
 *
 * Satisfies Requirements 7.1–7.10
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await authGuard();

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid ticket ID.", "id");
    }

    const body = await req.json();

    if (typeof body.status !== "string" || body.status.trim() === "") {
      throw new ApiError(400, "status must be a non-empty string.", "status");
    }

    const newStatus = body.status as Status;

    // Optional free-text note (e.g. which modal option the user selected).
    // Silently ignored if absent or not a string.
    const note: string | undefined =
      typeof body.note === "string" && body.note.trim().length > 0
        ? body.note.trim()
        : undefined;

    const updated = await Ticket_Service.transitionStatus(id, newStatus, user, note);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
