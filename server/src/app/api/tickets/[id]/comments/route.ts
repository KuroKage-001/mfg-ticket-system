import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import * as Ticket_Service from "@/services/ticket.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/tickets/:id/comments
 *
 * Adds a comment to a ticket. Accessible by any authenticated user.
 *
 * Request body:
 *   { content: string }
 *
 * Responses:
 * - 201  TicketComment (newly created comment with author)
 * - 400  Non-numeric ticket ID or invalid content
 * - 401  Unauthenticated
 * - 404  Ticket not found
 * - 422  Ticket is in a terminal state (CLOSED or CANCELLED)
 *
 * Satisfies Requirements 9.1–9.7
 */
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await authGuard();

    const { id: idParam } = await params;
    const ticketId = parseInt(idParam, 10);
    if (isNaN(ticketId)) {
      throw new ApiError(400, "Invalid ticket ID.", "id");
    }

    const body = await req.json();
    const { content } = body;

    const comment = await Ticket_Service.addComment(ticketId, content, user);

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
