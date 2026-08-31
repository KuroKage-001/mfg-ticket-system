// Feature: mfg-ticket-system, Property 8: Dashboard Count Consistency

/**
 * Property 8: Dashboard Count Consistency
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 *
 * 11.1 — Dashboard_Service SHALL return ticket counts keyed by status:
 *         open (OPEN), inProgress (IN_PROGRESS), resolved (RESOLVED),
 *         closed (CLOSED), and cancelled (CANCELLED).
 * 11.2 — Dashboard_Service SHALL return the count of tickets with URGENT
 *         priority as `urgent`.
 * 11.3 — Dashboard_Service SHALL return the count of tickets where
 *         assigned_to_id is null as `unassigned`.
 * 11.4 — Dashboard_Service SHALL return the count of tickets assigned to
 *         the currently authenticated user as `myAssigned`.
 *
 * Strategy:
 *   1. Generate an array of 0–100 ticket statuses via fast-check using
 *      fc.array(fc.constantFrom("OPEN","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED")).
 *   2. Build an in-memory ticket store from those statuses.
 *   3. Mock `prisma.$transaction` (array-style) so each count query is served
 *      from the in-memory store.
 *   4. Call `getSummary(actorId)` and assert the key invariant:
 *        open + inProgress + resolved + closed === totalNonCancelledTickets
 *      where totalNonCancelledTickets = tickets whose status is NOT "CANCELLED".
 *   5. Additionally verify each individual status count matches the in-memory
 *      store so Requirements 11.1–11.4 are validated directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "CANCELLED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface MockTicket {
  id: number;
  status: Status;
  priority: Priority;
  assignedToId: number | null;
}

// ── In-memory ticket store ────────────────────────────────────────────────────

/**
 * The mock Prisma client serves count queries from this array.
 * Reset before each property run.
 */
let ticketStore: MockTicket[] = [];

// The actorId used for myAssigned counts
const ACTOR_ID = 1;

// ── Mock Prisma before importing the service ──────────────────────────────────

/**
 * The Dashboard_Service calls prisma.$transaction with an ARRAY of Prisma
 * operation promises. The mock resolves each element by delegating to the
 * in-memory ticket.count / ticket.findMany mock implementations.
 *
 * Call order matches getSummary() in dashboard.service.ts:
 *   [0] count OPEN
 *   [1] count IN_PROGRESS
 *   [2] count RESOLVED
 *   [3] count CLOSED
 *   [4] count CANCELLED
 *   [5] count URGENT
 *   [6] count unassigned (assignedToId === null)
 *   [7] count myAssigned (assignedToId === actorId)
 *   [8] findMany recent tickets (take: 10)
 *
 * Each element in the array is already a resolved promise when it arrives
 * at $transaction, so we use Promise.all to unwrap the array.
 */
vi.mock("../../lib/prisma", () => {
  /**
   * ticketCountMock handles prisma.ticket.count({ where: { ... } }).
   * It inspects the `where` clause and counts matching records from ticketStore.
   */
  const ticketCountMock = vi.fn(
    async ({
      where,
    }: {
      where?: {
        status?: string;
        priority?: string;
        assignedToId?: number | null;
      };
    }) => {
      return ticketStore.filter((t) => {
        if (where?.status !== undefined && t.status !== where.status) return false;
        if (where?.priority !== undefined && t.priority !== where.priority) return false;
        if (where?.assignedToId === null && t.assignedToId !== null) return false;
        if (
          typeof where?.assignedToId === "number" &&
          t.assignedToId !== where.assignedToId
        )
          return false;
        return true;
      }).length;
    }
  );

  /**
   * ticketFindManyMock handles prisma.ticket.findMany({ ... }).
   * Returns up to `take` items from the store (most recent first by id desc).
   */
  const ticketFindManyMock = vi.fn(
    async ({ take }: { take?: number; orderBy?: unknown; select?: unknown }) => {
      const sorted = [...ticketStore].sort((a, b) => b.id - a.id);
      return take !== undefined ? sorted.slice(0, take) : sorted;
    }
  );

  return {
    default: {
      /**
       * Array-style transaction: each element is already a Promise, so we
       * resolve them all with Promise.all.
       */
      $transaction: vi.fn(async (arg: unknown): Promise<unknown> => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        // Callback-style fallback (not used by Dashboard_Service)
        if (typeof arg === "function") {
          return (arg as (tx: unknown) => unknown)({
            ticket: {
              count: ticketCountMock,
              findMany: ticketFindManyMock,
            },
          });
        }
        return arg;
      }),
      ticket: {
        count: ticketCountMock,
        findMany: ticketFindManyMock,
      },
    },
  };
});

// ── Import service AFTER mocks are registered ─────────────────────────────────

import { getSummary } from "../dashboard.service";

// ── Helper — build in-memory ticket store ────────────────────────────────────

/**
 * Creates a MockTicket for each status in the input array.
 * All tickets have LOW priority (non-urgent) and are unassigned by default,
 * so the status counts are the sole variable under test for Property 8.
 */
function buildTicketStore(statuses: Status[]): void {
  ticketStore = statuses.map((status, i) => ({
    id: i + 1,
    status,
    priority: "LOW" as Priority,
    assignedToId: null,
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 8: Dashboard Count Consistency", () => {
  beforeEach(() => {
    ticketStore = [];
    vi.clearAllMocks();
  });

  it(
    "8: open + inProgress + resolved + closed === totalNonCancelledTickets (Validates: Requirements 11.1, 11.2, 11.3, 11.4)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(
              "OPEN" as Status,
              "IN_PROGRESS" as Status,
              "RESOLVED" as Status,
              "CLOSED" as Status,
              "CANCELLED" as Status
            ),
            { minLength: 0, maxLength: 100 }
          ),
          async (statuses) => {
            // ── Seed the in-memory store ──────────────────────────────────────
            buildTicketStore(statuses);

            // ── Call the service ──────────────────────────────────────────────
            const summary = await getSummary(ACTOR_ID);

            // ── Derive expected values from the store ─────────────────────────
            const expectedOpen = statuses.filter((s) => s === "OPEN").length;
            const expectedInProgress = statuses.filter(
              (s) => s === "IN_PROGRESS"
            ).length;
            const expectedResolved = statuses.filter(
              (s) => s === "RESOLVED"
            ).length;
            const expectedClosed = statuses.filter((s) => s === "CLOSED").length;
            const expectedCancelled = statuses.filter(
              (s) => s === "CANCELLED"
            ).length;
            const totalNonCancelled =
              statuses.length - expectedCancelled;

            // ── Core invariant (Property 8) ───────────────────────────────────
            // open + inProgress + resolved + closed must equal all non-cancelled
            expect(summary.open + summary.inProgress + summary.resolved + summary.closed).toBe(
              totalNonCancelled
            );

            // ── Individual status count correctness (Req 11.1) ────────────────
            expect(summary.open).toBe(expectedOpen);
            expect(summary.inProgress).toBe(expectedInProgress);
            expect(summary.resolved).toBe(expectedResolved);
            expect(summary.closed).toBe(expectedClosed);
            expect(summary.cancelled).toBe(expectedCancelled);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "8b: urgent count matches tickets with URGENT priority across any status distribution (Validates: Requirement 11.2)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              status: fc.constantFrom(
                "OPEN" as Status,
                "IN_PROGRESS" as Status,
                "RESOLVED" as Status,
                "CLOSED" as Status,
                "CANCELLED" as Status
              ),
              priority: fc.constantFrom(
                "LOW" as Priority,
                "MEDIUM" as Priority,
                "HIGH" as Priority,
                "URGENT" as Priority
              ),
            }),
            { minLength: 0, maxLength: 100 }
          ),
          async (tickets) => {
            ticketStore = tickets.map((t, i) => ({
              id: i + 1,
              status: t.status,
              priority: t.priority,
              assignedToId: null,
            }));

            const summary = await getSummary(ACTOR_ID);

            const expectedUrgent = tickets.filter(
              (t) => t.priority === "URGENT"
            ).length;

            // Req 11.2 — urgent count matches real URGENT priority tickets
            expect(summary.urgent).toBe(expectedUrgent);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "8c: unassigned count matches tickets where assignedToId is null (Validates: Requirement 11.3)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              status: fc.constantFrom(
                "OPEN" as Status,
                "IN_PROGRESS" as Status,
                "RESOLVED" as Status,
                "CLOSED" as Status,
                "CANCELLED" as Status
              ),
              // assignedToId: null = unassigned, 1 = assigned to actor, 2 = assigned to other
              assignedToId: fc.constantFrom(null, ACTOR_ID, 2),
            }),
            { minLength: 0, maxLength: 100 }
          ),
          async (tickets) => {
            ticketStore = tickets.map((t, i) => ({
              id: i + 1,
              status: t.status,
              priority: "LOW" as Priority,
              assignedToId: t.assignedToId,
            }));

            const summary = await getSummary(ACTOR_ID);

            const expectedUnassigned = tickets.filter(
              (t) => t.assignedToId === null
            ).length;
            const expectedMyAssigned = tickets.filter(
              (t) => t.assignedToId === ACTOR_ID
            ).length;

            // Req 11.3 — unassigned count matches tickets with no assignee
            expect(summary.unassigned).toBe(expectedUnassigned);

            // Req 11.4 — myAssigned count matches tickets assigned to actor
            expect(summary.myAssigned).toBe(expectedMyAssigned);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
