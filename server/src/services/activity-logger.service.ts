import prisma from "../lib/prisma";

/**
 * All supported activity action types for ticket events.
 * Stored as strings in the database (ticket_activities.action column).
 */
export const ActivityAction = {
  TICKET_CREATED: "TICKET_CREATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  ASSIGNMENT_CHANGED: "ASSIGNMENT_CHANGED",
  FIELD_UPDATED: "FIELD_UPDATED",
  COMMENT_ADDED: "COMMENT_ADDED",
  /**
   * Logged when a resolved/closed ticket is reopened (transitioned back to
   * IN_PROGRESS).  oldValue carries the previous terminal timestamp
   * (resolvedAt or closedAt as an ISO string) so the history is preserved
   * in the activity feed without altering the database columns.
   */
  TICKET_REOPENED: "TICKET_REOPENED",
} as const;

export type ActivityAction = (typeof ActivityAction)[keyof typeof ActivityAction];

/**
 * The data required to create a single activity log entry.
 */
export interface ActivityEntry {
  action: ActivityAction;
  oldValue?: string | null;
  newValue?: string | null;
  ticketId: number;
  actorId: number;
}

/**
 * Activity_Logger — append-only service for recording ticket lifecycle events.
 *
 * This module only creates records; it has no update or delete methods.
 * It is called internally by Ticket_Service — never directly from route handlers.
 */
export const ActivityLogger = {
  /**
   * Appends an immutable activity record to the ticket_activities table.
   *
   * @param entry - The activity data to record.
   */
  async log(entry: ActivityEntry): Promise<void> {
    await prisma.ticketActivity.create({
      data: {
        action: entry.action,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        ticketId: entry.ticketId,
        actorId: entry.actorId,
      },
    });
  },
};
