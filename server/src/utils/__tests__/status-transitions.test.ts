// Feature: mfg-ticket-system, Property 1: Status Transition Completeness

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isValidTransition } from "../status-transitions";
import type { Status } from "@/types/ticket.types";
import type { Role } from "@/types/user.types";

/**
 * Property 1: Status Transition Completeness
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * For any (currentStatus, requestedStatus, role, isAssigned) combination,
 * isValidTransition() returns `true` if and only if the combination appears
 * in the explicit transition table, and `false` for every other combination.
 */

// ── Explicit transition table (single source of truth for the test) ──────────

const VALID_STATUSES: Status[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

const VALID_ROLES: Role[] = ["ADMIN", "EMPLOYEE"];

/**
 * The complete set of allowed (currentStatus → requestedStatus) pairs per role
 * and isAssigned flag, mirroring the design document and requirements exactly.
 *
 * ADMIN transitions (Requirements 7.1–7.4):
 *   OPEN        → IN_PROGRESS, CANCELLED
 *   IN_PROGRESS → RESOLVED, CANCELLED
 *   RESOLVED    → CLOSED
 *
 * EMPLOYEE transitions (Requirements 7.1, 7.2, 7.6, 7.7):
 *   Assigned only:
 *     OPEN        → IN_PROGRESS
 *     IN_PROGRESS → RESOLVED
 *   Not assigned: no transitions allowed
 */
type TransitionKey = `${Status}|${Status}|${Role}|${boolean}`;

function makeKey(
  currentStatus: Status,
  requestedStatus: Status,
  role: Role,
  isAssigned: boolean
): TransitionKey {
  return `${currentStatus}|${requestedStatus}|${role}|${isAssigned}`;
}

const ALLOWED_TRANSITIONS = new Set<TransitionKey>([
  // ADMIN — isAssigned value is irrelevant for ADMIN but test both to be thorough
  makeKey("OPEN",        "IN_PROGRESS", "ADMIN", true),
  makeKey("OPEN",        "IN_PROGRESS", "ADMIN", false),
  makeKey("OPEN",        "CANCELLED",   "ADMIN", true),
  makeKey("OPEN",        "CANCELLED",   "ADMIN", false),
  makeKey("IN_PROGRESS", "RESOLVED",    "ADMIN", true),
  makeKey("IN_PROGRESS", "RESOLVED",    "ADMIN", false),
  makeKey("IN_PROGRESS", "CANCELLED",   "ADMIN", true),
  makeKey("IN_PROGRESS", "CANCELLED",   "ADMIN", false),
  makeKey("RESOLVED",    "CLOSED",      "ADMIN", true),
  makeKey("RESOLVED",    "CLOSED",      "ADMIN", false),

  // EMPLOYEE (assigned only)
  makeKey("OPEN",        "IN_PROGRESS", "EMPLOYEE", true),
  makeKey("IN_PROGRESS", "RESOLVED",    "EMPLOYEE", true),
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpectedToBeAllowed(
  currentStatus: Status,
  requestedStatus: Status,
  role: Role,
  isAssigned: boolean
): boolean {
  return ALLOWED_TRANSITIONS.has(
    makeKey(currentStatus, requestedStatus, role, isAssigned)
  );
}

// ── Property test ─────────────────────────────────────────────────────────────

describe("status-transitions — isValidTransition()", () => {
  it(
    "Property 1: isValidTransition() returns true iff the combination is in the explicit transition table",
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_STATUSES),   // currentStatus
          fc.constantFrom(...VALID_STATUSES),   // requestedStatus
          fc.constantFrom(...VALID_ROLES),      // role
          fc.boolean(),                         // isAssigned
          (currentStatus, requestedStatus, role, isAssigned) => {
            const result = isValidTransition({
              currentStatus,
              requestedStatus,
              role,
              isAssigned,
            });

            const expected = isExpectedToBeAllowed(
              currentStatus,
              requestedStatus,
              role,
              isAssigned
            );

            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
