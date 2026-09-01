import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";
import { ActivityLogger, ActivityAction } from "@/services/activity-logger.service";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/tickets/:id/self-assign
 *
 * Assigns the ticket to the currently authenticated user.
 * Available to any authenticated role (ADMIN or EMPLOYEE).
 *
 * Responses:
 * - 200  { assignedToId, assignedToName }
 * - 400  Non-numeric ticket ID
 * - 401  Unauthenticated
 * - 404  Ticket not found
 * - 422  Ticket is CLOSED or CANCELLED
 */
export async function POST(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const actor = await authGuard();

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid ticket ID.", "id");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, status: true, assignedToId: true },
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found.");
    }

    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") {
      throw new ApiError(422, `Cannot assign a ticket with status ${ticket.status}.`);
    }

    const previousAssigneeId = ticket.assignedToId;

    // Get previous assignee name for activity log
    const previousAssignee = previousAssigneeId
      ? await prisma.user.findUnique({
          where: { id: previousAssigneeId },
          select: { fullName: true },
        })
      : null;

    const updated = await prisma.ticket.update({
      where: { id },
      data: { assignedTo: { connect: { id: actor.id } } },
      select: {
        id: true,
        assignedToId: true,
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    await ActivityLogger.log({
      action: ActivityAction.ASSIGNMENT_CHANGED,
      oldValue: previousAssignee?.fullName ?? null,
      newValue: actor.fullName,
      ticketId: id,
      actorId: actor.id,
    });

    return NextResponse.json(
      {
        assignedToId: updated.assignedToId,
        assignedToName: updated.assignedTo?.fullName ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
