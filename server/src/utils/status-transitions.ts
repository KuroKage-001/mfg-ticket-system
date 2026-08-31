import type { Status } from "@/types/ticket.types";
import type { Role } from "@/types/user.types";

export interface TransitionContext {
  currentStatus: Status;
  requestedStatus: Status;
  role: Role;
  isAssigned: boolean; // is the requesting EMPLOYEE the assigned user?
}

const ADMIN_TRANSITIONS: Record<Status, Status[]> = {
  OPEN:        ["IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED",   "CLOSED",   "CANCELLED"],
  // RESOLVED is terminal for INC tickets — admin cannot close them
  RESOLVED:    ["IN_PROGRESS"],
  CLOSED:      ["IN_PROGRESS"],
  CANCELLED:   ["IN_PROGRESS"],
};

const EMPLOYEE_TRANSITIONS: Record<Status, Status[]> = {
  OPEN:        ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED",   "CLOSED"],
  RESOLVED:    ["IN_PROGRESS"],   // any employee can reopen
  CLOSED:      ["IN_PROGRESS"],   // any employee can reopen
  CANCELLED:   [],
};

/**
 * Determines whether a status transition is valid given the actor's role
 * and assignment status.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function isValidTransition(ctx: TransitionContext): boolean {
  const { currentStatus, requestedStatus, role, isAssigned } = ctx;

  if (role === "ADMIN") {
    return ADMIN_TRANSITIONS[currentStatus]?.includes(requestedStatus) ?? false;
  }

  // EMPLOYEE: OPEN → IN_PROGRESS is always valid (taking an unassigned ticket).
  // All other transitions require the employee to be assigned.
  if (currentStatus === "OPEN" && requestedStatus === "IN_PROGRESS") {
    return true;
  }

  if (!isAssigned) return false;

  return EMPLOYEE_TRANSITIONS[currentStatus]?.includes(requestedStatus) ?? false;
}

/**
 * Returns the list of valid target statuses from the given status for the
 * given role/ownership combination. Used to populate 422 error response bodies.
 *
 * Requirements: 7.5
 */
export function getAllowedTransitions(
  status: Status,
  role: Role,
  isAssigned: boolean,
): Status[] {
  if (role === "ADMIN") {
    return ADMIN_TRANSITIONS[status] ?? [];
  }

  // EMPLOYEE with no assignment has no allowed transitions
  if (!isAssigned) return [];

  return EMPLOYEE_TRANSITIONS[status] ?? [];
}
