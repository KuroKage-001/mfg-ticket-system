/**
 * Ticket service — creation, listing, full-detail retrieval, update, assign,
 * and status transitions.
 *
 * Satisfies Requirements: 3.1–3.9, 4.1–4.9, 5.1–5.8, 6.1–6.6,
 *                         7.1–7.10, 8.1–8.6, 15.1–15.6
 */

import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { ApiError } from "../utils/api-error";
import { formatTicketNumber } from "../utils/ticket-number";
import { ActivityLogger, ActivityAction } from "./activity-logger.service";
import { isValidTransition, getAllowedTransitions } from "../utils/status-transitions";
import type {
  CreateTicketDto,
  UpdateTicketDto,
  TicketListQuery,
  TicketSummary,
  TicketDetail,
  Priority,
  Status,
  TicketCategory,
  ContactMethod,
} from "../types/ticket.types";
import { VALID_CATEGORIES as CATEGORIES, VALID_CONTACT_METHODS } from "../types/ticket.types";
import type { PaginatedResult } from "../types/pagination.types";
import type { SessionUser } from "../types/session.types";

// ─── Validation helpers ────────────────────────────────────────────────────────

const VALID_PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function validateTitle(value: unknown): void {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.length > 200
  ) {
    throw new ApiError(
      400,
      "title must be between 1 and 200 characters.",
      "title"
    );
  }
}

function validateDescription(value: unknown): void {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.length > 5000
  ) {
    throw new ApiError(
      400,
      "description must be between 1 and 5000 characters.",
      "description"
    );
  }
}

function validateCategory(value: unknown): void {
  if (!(CATEGORIES as string[]).includes(value as string)) {
    throw new ApiError(
      400,
      `category must be one of: ${CATEGORIES.join(", ")}.`,
      "category"
    );
  }
}

function validatePriority(value: unknown): void {
  if (!VALID_PRIORITIES.includes(value as Priority)) {
    throw new ApiError(
      400,
      `priority must be one of: ${VALID_PRIORITIES.join(", ")}.`,
      "priority"
    );
  }
}

function validateContactMethod(value: unknown): void {
  if (!(VALID_CONTACT_METHODS as string[]).includes(value as string)) {
    throw new ApiError(
      400,
      `contactMethod must be one of: ${VALID_CONTACT_METHODS.join(", ")}.`,
      "contactMethod"
    );
  }
}

// ─── Prisma include shapes ─────────────────────────────────────────────────────

/** Reusable include for full TicketDetail queries. */
const TICKET_DETAIL_INCLUDE = {
  createdBy: {
    select: { id: true, fullName: true, email: true },
  },
  assignedTo: {
    select: { id: true, fullName: true, email: true },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: {
        select: { id: true, fullName: true, email: true },
      },
    },
  },
  activities: {
    orderBy: { createdAt: "asc" as const },
    include: {
      actor: {
        select: { id: true, fullName: true, email: true },
      },
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      url: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
} satisfies Prisma.TicketInclude;

// ─── Ticket number generation ──────────────────────────────────────────────────

/**
 * Generates the next sequential ticket number for the given year using a
 * concurrency-safe `SELECT MAX ... FOR UPDATE` inside a Prisma transaction.
 *
 * The caller is responsible for running the actual ticket INSERT inside the
 * same transaction that is passed to this function.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */
async function generateTicketNumber(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  // Lock rows matching the year prefix to serialize concurrent requests
  const result = await tx.$queryRaw<[{ max_seq: bigint | number | null }]>(
    Prisma.sql`
      SELECT MAX(
        CAST(SUBSTRING(ticket_number, 10) AS UNSIGNED)
      ) AS max_seq
      FROM tickets
      WHERE ticket_number LIKE ${`MFG-${year}-%`}
      FOR UPDATE
    `
  );

  // MySQL returns CAST(... AS UNSIGNED) as BigInt over the Prisma wire.
  // Convert to a plain number before arithmetic.
  const raw = result[0].max_seq;
  const lastSeq: number = raw !== null && raw !== undefined ? Number(raw) : 0;
  const nextSeq = lastSeq + 1;

  if (nextSeq > 999999) {
    throw new ApiError(500, "Ticket sequence exhausted for this year.");
  }

  return formatTicketNumber(year, nextSeq);
}

// ─── createTicket ──────────────────────────────────────────────────────────────

/**
 * Validates fields, generates a concurrency-safe ticket number, creates the
 * ticket, and logs the TICKET_CREATED activity.
 *
 * Requirements: 3.1–3.9, 15.1–15.6
 */
export async function createTicket(
  dto: CreateTicketDto,
  actor: SessionUser
): Promise<TicketDetail> {
  // ── Validation ──────────────────────────────────────────────────────────────
  validateTitle(dto.title);
  validateDescription(dto.description);
  validateCategory(dto.category);
  validatePriority(dto.priority);
  if (dto.contactMethod !== undefined) {
    validateContactMethod(dto.contactMethod);
  }

  // ── Assignee resolution ─────────────────────────────────────────────────────
  let resolvedAssignedToId: number | null = null;

  if (actor.role === "ADMIN" && dto.assignedToId !== undefined) {
    const assignee = await prisma.user.findUnique({
      where: { id: dto.assignedToId },
    });

    if (!assignee) {
      throw new ApiError(400, "Assignee not found.", "assignedToId");
    }

    if (!assignee.isActive) {
      throw new ApiError(400, "Assignee is inactive.", "assignedToId");
    }

    resolvedAssignedToId = assignee.id;
  } else if (actor.role === "EMPLOYEE" && dto.assignedToId === actor.id) {
    // Employee may assign the ticket to themselves only
    resolvedAssignedToId = actor.id;
  }
  // Otherwise (EMPLOYEE assigning to someone else): ignore

  // ── Transaction: generate ticket number + insert atomically ─────────────────
  const year = new Date().getUTCFullYear();

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await generateTicketNumber(tx, year);

    return tx.ticket.create({
      data: {
        ticketNumber,
        title: dto.title.trim(),
        description: dto.description.trim(),
        category: dto.category,
        priority: dto.priority,
        status: resolvedAssignedToId !== null ? "IN_PROGRESS" : "OPEN",
        usedKnowledgeBase: dto.usedKnowledgeBase ?? false,
        contactMethod: dto.contactMethod ?? null,
        createdById: actor.id,
        assignedToId: resolvedAssignedToId,
      },
      include: TICKET_DETAIL_INCLUDE,
    });
  });

  // ── Activity log ─────────────────────────────────────────────────────────────
  await ActivityLogger.log({
    action: ActivityAction.TICKET_CREATED,
    newValue: ticket.ticketNumber,
    ticketId: ticket.id,
    actorId: actor.id,
  });

  // Cast to TicketDetail — Prisma include guarantees shape alignment
  return ticket as unknown as TicketDetail;
}

// ─── getTicketById ─────────────────────────────────────────────────────────────

/**
 * Retrieves the full ticket detail (creator, assignee, ordered comments and
 * activities) or throws ApiError(404) if the ticket does not exist.
 *
 * Requirements: 4.3
 */
export async function getTicketById(id: number): Promise<TicketDetail> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: TICKET_DETAIL_INCLUDE,
  });

  if (!ticket) {
    throw new ApiError(404, "Ticket not found.");
  }

  return ticket as unknown as TicketDetail;
}

// ─── listTickets ───────────────────────────────────────────────────────────────

/**
 * Returns a paginated, optionally filtered list of ticket summaries.
 *
 * Requirements: 4.1, 4.2, 4.4–4.9
 */
export async function listTickets(
  query: TicketListQuery
): Promise<PaginatedResult<TicketSummary>> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  // ── Build where clause ──────────────────────────────────────────────────────
  const where: Prisma.TicketWhereInput = {};

  if (query.status !== undefined) {
    where.status = query.status;
  }

  if (query.priority !== undefined) {
    where.priority = query.priority;
  }

  if (query.assignedToId !== undefined) {
    where.assignedToId = query.assignedToId;
  }

  if (query.unassigned === true) {
    where.assignedToId = null;
  }

  if (query.search) {
    const term = query.search;
    // MySQL's default collation (utf8mb4_general_ci) is case-insensitive,
    // so contains without mode is already case-insensitive on this DB.
    where.OR = [
      { title: { contains: term } },
      { ticketNumber: { contains: term } },
    ];
  }

  // ── Run findMany + count atomically ─────────────────────────────────────────
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        usedKnowledgeBase: true,
        // contactMethod is intentionally omitted here — the Prisma client
        // types are regenerated on server restart; the field is available
        // on TicketDetail (full fetch) which uses TICKET_DETAIL_INCLUDE.
        createdById: true,
        assignedToId: true,
        assignedTo: {
          select: { fullName: true },
        },
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        closedAt: true,
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    data: tickets.map((t) => ({
      ...t,
      assignedToName: (t.assignedTo as { fullName: string } | null)?.fullName ?? null,
      assignedTo: undefined,
    })) as unknown as TicketSummary[],
    total,
    page,
    limit,
  };
}

// ─── updateTicket ──────────────────────────────────────────────────────────────

/**
 * Updates one or more mutable fields on a ticket (ADMIN only).
 * Only logs activity for fields whose value actually changed.
 *
 * Requirements: 6.1–6.6, 8.1–8.6
 */
export async function updateTicket(
  id: number,
  dto: UpdateTicketDto,
  actor: SessionUser
): Promise<TicketDetail> {
  // ── Recognised fields check ─────────────────────────────────────────────────
  const recognised: (keyof UpdateTicketDto)[] = [
    "title",
    "description",
    "category",
    "priority",
  ];
  const supplied = recognised.filter((k) => k in dto);

  if (supplied.length === 0) {
    throw new ApiError(
      400,
      "Request body must contain at least one updatable field: title, description, category, priority."
    );
  }

  // ── Per-field validation ────────────────────────────────────────────────────
  if ("title" in dto) validateTitle(dto.title);
  if ("description" in dto) validateDescription(dto.description);
  if ("category" in dto) validateCategory(dto.category);
  if ("priority" in dto) validatePriority(dto.priority);

  // ── Fetch current ticket ────────────────────────────────────────────────────
  const current = await prisma.ticket.findUnique({ where: { id } });
  if (!current) {
    throw new ApiError(404, "Ticket not found.");
  }

  // ── Build diff — only update fields that actually changed ───────────────────
  const data: Prisma.TicketUpdateInput = {};
  const activityLogs: Array<() => Promise<void>> = [];

  if ("title" in dto && dto.title !== undefined && dto.title.trim() !== current.title) {
    data.title = dto.title.trim();
    const oldValue = current.title;
    const newValue = dto.title.trim();
    activityLogs.push(() =>
      ActivityLogger.log({
        action: ActivityAction.FIELD_UPDATED,
        oldValue,
        newValue,
        ticketId: id,
        actorId: actor.id,
      })
    );
  }

  if (
    "description" in dto &&
    dto.description !== undefined &&
    dto.description.trim() !== current.description
  ) {
    data.description = dto.description.trim();
    const oldValue = current.description;
    const newValue = dto.description.trim();
    activityLogs.push(() =>
      ActivityLogger.log({
        action: ActivityAction.FIELD_UPDATED,
        oldValue,
        newValue,
        ticketId: id,
        actorId: actor.id,
      })
    );
  }

  if (
    "category" in dto &&
    dto.category !== undefined &&
    dto.category !== (current.category as TicketCategory)
  ) {
    data.category = dto.category;
    const oldValue = current.category;
    const newValue = dto.category;
    activityLogs.push(() =>
      ActivityLogger.log({
        action: ActivityAction.FIELD_UPDATED,
        oldValue,
        newValue,
        ticketId: id,
        actorId: actor.id,
      })
    );
  }

  if (
    "priority" in dto &&
    dto.priority !== undefined &&
    dto.priority !== (current.priority as Priority)
  ) {
    data.priority = dto.priority;
    const oldValue = current.priority;
    const newValue = dto.priority;
    activityLogs.push(() =>
      ActivityLogger.log({
        action: ActivityAction.PRIORITY_CHANGED,
        oldValue,
        newValue,
        ticketId: id,
        actorId: actor.id,
      })
    );
  }

  // ── Persist and fetch updated detail ────────────────────────────────────────
  const updated = await prisma.ticket.update({
    where: { id },
    data,
    include: TICKET_DETAIL_INCLUDE,
  });

  // ── Fire activity logs after successful update ───────────────────────────────
  for (const log of activityLogs) {
    await log();
  }

  return updated as unknown as TicketDetail;
}

// ─── assignTicket ──────────────────────────────────────────────────────────────

/**
 * Assigns a ticket to a target user (ADMIN only).
 *
 * Requirements: 5.1–5.8
 */
export async function assignTicket(
  id: number,
  assignedToId: number,
  actor: SessionUser
): Promise<TicketDetail> {
  // ── Fetch ticket ────────────────────────────────────────────────────────────
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new ApiError(404, "Ticket not found.");
  }

  // ── Closed/Cancelled guard ──────────────────────────────────────────────────
  if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") {
    throw new ApiError(
      422,
      "Cannot assign a ticket that is CLOSED or CANCELLED."
    );
  }

  // ── Fetch target user ───────────────────────────────────────────────────────
  const targetUser = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!targetUser) {
    throw new ApiError(404, "Target user not found.");
  }

  // ── Active check ─────────────────────────────────────────────────────────────
  if (!targetUser.isActive) {
    throw new ApiError(422, "Cannot assign a ticket to an inactive user.");
  }

  // ── Role check — only EMPLOYEE may be assigned ──────────────────────────────
  if (targetUser.role === "ADMIN") {
    throw new ApiError(422, "Cannot assign a ticket to an ADMIN user.");
  }

  // ── Persist ──────────────────────────────────────────────────────────────────
  const previousAssignedToId = ticket.assignedToId;

  // Fetch the previous assignee's name for a human-readable activity log
  const previousAssignee = previousAssignedToId
    ? await prisma.user.findUnique({
        where: { id: previousAssignedToId },
        select: { fullName: true },
      })
    : null;

  const updated = await prisma.ticket.update({
    where: { id },
    data: { assignedToId },
    include: TICKET_DETAIL_INCLUDE,
  });

  // ── Activity log — store names, not IDs ──────────────────────────────────────
  await ActivityLogger.log({
    action: ActivityAction.ASSIGNMENT_CHANGED,
    oldValue: previousAssignee?.fullName ?? null,
    newValue: targetUser.fullName,
    ticketId: id,
    actorId: actor.id,
  });

  return updated as unknown as TicketDetail;
}

// ─── transitionStatus ─────────────────────────────────────────────────────────

/**
 * Transitions a ticket's status according to the role-based transition rules.
 *
 * @param note  Optional free-text note logged as a FIELD_UPDATED activity
 *              immediately after the status transition (e.g. "Assign to Me +
 *              Resolve" or "Resolve Only").  Limited to 500 characters.
 *
 * Requirements: 7.1–7.10
 */
export async function transitionStatus(
  id: number,
  newStatus: Status,
  actor: SessionUser,
  note?: string
): Promise<TicketDetail> {
  // ── Fetch ticket ────────────────────────────────────────────────────────────
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new ApiError(404, "Ticket not found.");
  }

  const currentStatus = ticket.status as Status;
  const isAssigned = ticket.assignedToId === actor.id;

  // ── EMPLOYEE-specific guards (403 before 422) ────────────────────────────────
  if (actor.role === "EMPLOYEE") {
    // Req 7.7 — employees can never cancel tickets
    if (newStatus === "CANCELLED") {
      throw new ApiError(403, "Employees cannot cancel tickets.");
    }
    // Any employee may now resolve/close/reopen any ticket regardless of assignment
  }

  // ── Transition validity check ────────────────────────────────────────────────
  const valid = isValidTransition({
    currentStatus,
    requestedStatus: newStatus,
    role: actor.role,
    isAssigned,
  });

  if (!valid) {
    const allowedTransitions = getAllowedTransitions(
      currentStatus,
      actor.role,
      isAssigned
    );
    throw new ApiError(
      422,
      `Cannot transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${
        allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "none"
      }.`
    );
  }

  // ── Build update payload ─────────────────────────────────────────────────────
  // Auto-upgrade RESOLVED → CLOSED for SCTASK and RITM tickets.
  // These ticket types don't require a separate admin close step.
  const titleUpper = ticket.title.trim().toUpperCase();
  const isTaskOrRequest =
    titleUpper.startsWith("SCTASK") || titleUpper.startsWith("RITM");

  const effectiveStatus =
    newStatus === "RESOLVED" && isTaskOrRequest ? "CLOSED" : newStatus;

  const data: Prisma.TicketUpdateInput = { status: effectiveStatus };

  if (effectiveStatus === "RESOLVED") {
    data.resolvedAt = new Date();
  }

  if (effectiveStatus === "CLOSED") {
    // For auto-upgraded SCTASK/RITM tickets set both timestamps so the
    // closed requests charts and the resolved date field both populate.
    if (isTaskOrRequest && newStatus === "RESOLVED") {
      data.resolvedAt = new Date();
    }
    data.closedAt = new Date();
  }

  // Reopening clears both resolved and closed timestamps
  if (effectiveStatus === "IN_PROGRESS") {
    data.resolvedAt = null;
    data.closedAt   = null;
  }

  // When an employee takes an unassigned OPEN ticket (clicks "Start"), auto-assign
  // them and log the assignment change alongside the status change.
  const isSelfAssigning =
    actor.role === "EMPLOYEE" &&
    currentStatus === "OPEN" &&
    newStatus === "IN_PROGRESS" &&
    ticket.assignedToId === null;

  if (isSelfAssigning) {
    data.assignedTo = { connect: { id: actor.id } };
  }

  // ── Persist ──────────────────────────────────────────────────────────────────
  const updated = await prisma.ticket.update({
    where: { id },
    data,
    include: TICKET_DETAIL_INCLUDE,
  });

  // ── Activity log ─────────────────────────────────────────────────────────────
  await ActivityLogger.log({
    action: ActivityAction.STATUS_CHANGED,
    oldValue: currentStatus,
    newValue: effectiveStatus,
    ticketId: id,
    actorId: actor.id,
  });

  // Log the self-assignment as a separate activity entry
  if (isSelfAssigning) {
    await ActivityLogger.log({
      action: ActivityAction.ASSIGNMENT_CHANGED,
      oldValue: null,
      newValue: actor.fullName,
      ticketId: id,
      actorId: actor.id,
    });
  }

  // When reopening, preserve the previous terminal timestamps in the activity
  // feed so history is never lost even after resolvedAt/closedAt are cleared.
  // oldValue = previous resolvedAt ISO, newValue = previous closedAt ISO.
  if (
    effectiveStatus === "IN_PROGRESS" &&
    (currentStatus === "RESOLVED" || currentStatus === "CLOSED" || currentStatus === "CANCELLED")
  ) {
    const prevResolvedAt = ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null;
    const prevClosedAt   = ticket.closedAt   ? ticket.closedAt.toISOString()   : null;
    await ActivityLogger.log({
      action: ActivityAction.TICKET_REOPENED,
      oldValue: prevResolvedAt ?? prevClosedAt ?? null,
      newValue: prevClosedAt ?? prevResolvedAt ?? null,
      ticketId: id,
      actorId: actor.id,
    });
  }

  // Log the optional caller-supplied note (e.g. which modal option was chosen)
  if (note && note.trim().length > 0) {
    await ActivityLogger.log({
      action: ActivityAction.FIELD_UPDATED,
      oldValue: null,
      newValue: note.trim().substring(0, 500),
      ticketId: id,
      actorId: actor.id,
    });
  }

  return updated as unknown as TicketDetail;
}

// ─── addComment ────────────────────────────────────────────────────────────────

/**
 * Adds a comment to a ticket.
 *
 * Requirements: 9.1–9.7
 *
 * @param ticketId - The ID of the ticket to comment on.
 * @param content  - The comment body (1–5000 characters).
 * @param actor    - The authenticated user posting the comment.
 * @returns The newly created TicketComment record (with author).
 *
 * @throws {ApiError} 400 if content is empty or exceeds 5000 characters.
 * @throws {ApiError} 404 if the ticket does not exist.
 * @throws {ApiError} 422 if the ticket status is CLOSED or CANCELLED.
 */
export async function addComment(
  ticketId: number,
  content: string,
  actor: SessionUser
): Promise<{
  id: number;
  content: string;
  ticketId: number;
  authorId: number;
  createdAt: Date;
  author: { id: number; fullName: string; email: string };
}> {
  // ── Validate content ────────────────────────────────────────────────────────
  if (
    typeof content !== "string" ||
    content.trim().length < 1 ||
    content.length > 5000
  ) {
    throw new ApiError(
      400,
      "content must be between 1 and 5000 characters.",
      "content"
    );
  }

  // ── Verify ticket exists ────────────────────────────────────────────────────
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    throw new ApiError(404, `Ticket with id ${ticketId} not found.`);
  }

  // ── Reject comments on terminal tickets (Req 9.7) ─────────────────────────
  if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") {
    throw new ApiError(
      422,
      `Cannot add a comment to a ticket with status ${ticket.status}. The ticket is in a terminal state.`
    );
  }

  // ── Create comment ──────────────────────────────────────────────────────────
  const comment = await prisma.ticketComment.create({
    data: {
      content,
      ticketId,
      authorId: actor.id,
    },
    include: {
      author: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  // ── Activity log (Req 9.5) ─────────────────────────────────────────────────
  await ActivityLogger.log({
    action: ActivityAction.COMMENT_ADDED,
    oldValue: null,
    newValue: String(comment.id),
    ticketId,
    actorId: actor.id,
  });

  return comment;
}
