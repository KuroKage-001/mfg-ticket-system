import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import * as Ticket_Service from "@/services/ticket.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import type { TicketListQuery, CreateTicketDto, Priority, Status } from "@/types/ticket.types";

const VALID_STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
const VALID_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/**
 * GET /api/tickets
 *
 * Returns a paginated, optionally filtered list of tickets.
 * Accessible by any authenticated user.
 *
 * Query parameters:
 * - page          (number, default 1)
 * - limit         (number, default 20, max 100)
 * - status        (Status enum value, optional)
 * - priority      (Priority enum value, optional)
 * - search        (string, optional — matches title or ticketNumber)
 * - assignedToId  (number, optional)
 *
 * Responses:
 * - 200  PaginatedResult<TicketSummary>
 * - 400  Invalid query parameter value
 * - 401  Unauthenticated
 *
 * Satisfies Requirements 4.1, 4.2, 4.4–4.9, 4.10
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await authGuard();

    const { searchParams } = req.nextUrl;

    // Parse page
    const pageRaw = searchParams.get("page");
    const page = pageRaw !== null ? parseInt(pageRaw, 10) : 1;

    // Parse limit
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw !== null ? Math.min(parseInt(limitRaw, 10), 100) : 20;

    // Parse status — must be a valid Status enum value if provided
    const statusRaw = searchParams.get("status");
    let status: Status | undefined;
    if (statusRaw !== null) {
      if (!(VALID_STATUSES as string[]).includes(statusRaw)) {
        throw new ApiError(
          400,
          `status must be one of: ${VALID_STATUSES.join(", ")}.`,
          "status"
        );
      }
      status = statusRaw as Status;
    }

    // Parse priority — must be a valid Priority enum value if provided
    const priorityRaw = searchParams.get("priority");
    let priority: Priority | undefined;
    if (priorityRaw !== null) {
      if (!(VALID_PRIORITIES as string[]).includes(priorityRaw)) {
        throw new ApiError(
          400,
          `priority must be one of: ${VALID_PRIORITIES.join(", ")}.`,
          "priority"
        );
      }
      priority = priorityRaw as Priority;
    }

    // Parse search
    const search = searchParams.get("search") ?? undefined;

    // Parse assignedToId
    const assignedToIdRaw = searchParams.get("assignedToId");
    let assignedToId: number | undefined;
    if (assignedToIdRaw !== null) {
      const parsed = parseInt(assignedToIdRaw, 10);
      if (!isNaN(parsed)) {
        assignedToId = parsed;
      }
    }

    const query: TicketListQuery = { page, limit, status, priority, search, assignedToId };
    if (searchParams.get("unassigned") === "true") {
      query.unassigned = true;
    }
    const result = await Ticket_Service.listTickets(query);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/tickets
 *
 * Creates a new ticket. Any authenticated user may create a ticket.
 * ADMIN users may optionally supply `assignedToId`; EMPLOYEE requests
 * have `assignedToId` silently ignored by the service.
 *
 * Request body: CreateTicketDto
 *   { title, description, category, priority, assignedToId? }
 *
 * Responses:
 * - 201  TicketDetail (created ticket)
 * - 400  Validation failure
 * - 401  Unauthenticated
 *
 * Satisfies Requirements 3.1–3.9
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await authGuard();

    const body = await req.json();
    const dto: CreateTicketDto = {
      title: body.title,
      description: body.description,
      category: body.category,
      priority: body.priority,
    };

    if (body.assignedToId !== undefined) {
      dto.assignedToId = body.assignedToId;
    }
    if (body.usedKnowledgeBase !== undefined) {
      dto.usedKnowledgeBase = Boolean(body.usedKnowledgeBase);
    }
    if (body.contactMethod !== undefined) {
      dto.contactMethod = body.contactMethod;
    }

    const ticket = await Ticket_Service.createTicket(dto, user);

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
