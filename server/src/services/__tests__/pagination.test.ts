// Feature: mfg-ticket-system, Property 7: Pagination Completeness and Non-Duplication

/**
 * Property 7: Pagination Completeness and Non-Duplication
 * Validates: Requirements 4.8, 2.5
 *
 * 4.8 — The Ticket_Service SHALL support `page` and `limit` query parameters on
 *        GET /api/tickets; default page is 1 and default limit is 20; maximum
 *        limit is 100; responses SHALL include `total`, `page`, and `limit`
 *        metadata alongside paginated results.
 * 2.5 — The User_Service SHALL support `page` and `limit` query parameters on
 *        GET /api/users; paginated responses SHALL include `total`, `page`, and
 *        `limit` metadata.
 *
 * Strategy:
 *   1. Seed an in-memory ticket store with N distinct tickets (N drawn from
 *      fc.integer({ min: 1, max: 200 })).
 *   2. Choose a page size L (drawn from fc.integer({ min: 1, max: 50 })).
 *   3. Paginate through every page (ceil(N / L) pages) calling listTickets()
 *      with page=1..ceil(N/L) and limit=L.
 *   4. Collect all ticket IDs from every page's `data` array.
 *   5. Assert:
 *      a. The union contains exactly N IDs (completeness — none missed, none
 *         duplicated across pages).
 *      b. All collected IDs are unique (non-duplication within and across pages).
 *      c. Each response carries the correct `total`, `page`, and `limit` metadata.
 *      d. The last page contains the expected remainder (N % L, or L when evenly
 *         divisible).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── In-memory ticket store ────────────────────────────────────────────────────

/**
 * The mock Prisma client reads from / queries this array.
 * Replaced wholesale before each property run.
 */
let ticketStore: Array<{
  id: number;
  ticketNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  createdById: number;
  assignedToId: number | null;
  createdAt: Date;
  updatedAt: Date;
}> = [];

// ── Mock Prisma before importing the service ──────────────────────────────────

vi.mock("../../lib/prisma", () => ({
  default: {
    /**
     * Simulate prisma.$transaction([findMany, count]).
     *
     * The real listTickets passes an array of two promises to $transaction.
     * The mock needs to detect this pattern and resolve both:
     *   - index 0: paginated slice of the store (findMany equivalent)
     *   - index 1: total count of the store (count equivalent)
     *
     * Because the actual Prisma calls are already constructed before being
     * handed to $transaction, we intercept at the ticket.findMany /
     * ticket.count level instead.
     */
    $transaction: vi.fn(
      async (
        arg: unknown
      ): Promise<unknown> => {
        // listTickets passes an array [findManyPromise, countPromise]
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        // Fallback for callback-style transactions (not used by listTickets)
        if (typeof arg === "function") {
          return (arg as (tx: unknown) => unknown)({});
        }
        return arg;
      }
    ),
    ticket: {
      /**
       * Simulate prisma.ticket.findMany({ skip, take, where, orderBy, select }).
       * Applies skip/take against the in-memory store (no where/orderBy needed
       * because all test tickets are in the store and order is deterministic by id).
       */
      findMany: vi.fn(
        async ({
          skip = 0,
          take,
        }: {
          skip?: number;
          take?: number;
          where?: unknown;
          orderBy?: unknown;
          select?: unknown;
        }) => {
          const sliced =
            take !== undefined
              ? ticketStore.slice(skip, skip + take)
              : ticketStore.slice(skip);
          return sliced;
        }
      ),
      /**
       * Simulate prisma.ticket.count({ where }).
       * Always returns the full store size (no filters applied in this test).
       */
      count: vi.fn(async () => ticketStore.length),
    },
  },
}));

// ── Import service AFTER mocks are registered ─────────────────────────────────

import { listTickets } from "../ticket.service";

// ── Helper — build a minimal in-memory ticket ─────────────────────────────────

function makeTicket(id: number) {
  return {
    id,
    ticketNumber: `MFG-2026-${String(id).padStart(6, "0")}`,
    title: `Ticket ${id}`,
    category: "Other",
    priority: "LOW",
    status: "OPEN",
    createdById: 1,
    assignedToId: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, id)),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, id)),
  };
}

// ── Helper — seed the in-memory store with N distinct tickets ─────────────────

function seedStore(n: number): void {
  ticketStore = Array.from({ length: n }, (_, i) => makeTicket(i + 1));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 7: Pagination Completeness and Non-Duplication", () => {
  beforeEach(() => {
    ticketStore = [];
    vi.clearAllMocks();
  });

  it(
    "7: paginating through all pages yields every ticket exactly once (Validates: Requirements 4.8, 2.5)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 200 }), // N — total tickets
          fc.integer({ min: 1, max: 50 }), // L — page size (limit)
          async (n, l) => {
            // ── Seed store ────────────────────────────────────────────────────
            seedStore(n);

            // ── Paginate through every page ───────────────────────────────────
            const totalPages = Math.ceil(n / l);
            const collectedIds: number[] = [];

            for (let page = 1; page <= totalPages; page++) {
              const result = await listTickets({ page, limit: l });

              // ── Metadata assertions ─────────────────────────────────────────
              expect(result.total).toBe(n);
              expect(result.page).toBe(page);
              expect(result.limit).toBe(l);

              // ── Accumulate IDs ──────────────────────────────────────────────
              for (const ticket of result.data) {
                collectedIds.push(ticket.id);
              }
            }

            // ── Completeness: every ticket was returned exactly once ──────────
            expect(collectedIds.length).toBe(n);

            // ── Non-duplication: all collected IDs are unique ────────────────
            const uniqueIds = new Set(collectedIds);
            expect(uniqueIds.size).toBe(n);

            // ── All expected IDs [1..N] are present ──────────────────────────
            for (let id = 1; id <= n; id++) {
              expect(uniqueIds.has(id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "7b: last page contains the correct remainder (Validates: Requirement 4.8)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 1, max: 50 }),
          async (n, l) => {
            seedStore(n);

            const totalPages = Math.ceil(n / l);
            const expectedLastPageSize = n % l === 0 ? l : n % l;

            const lastResult = await listTickets({ page: totalPages, limit: l });

            expect(lastResult.data.length).toBe(expectedLastPageSize);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "7c: requesting a page beyond the last page returns an empty data array (Validates: Requirement 4.8)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 1, max: 50 }),
          async (n, l) => {
            seedStore(n);

            const totalPages = Math.ceil(n / l);
            const beyondPage = totalPages + 1;

            const result = await listTickets({ page: beyondPage, limit: l });

            expect(result.data).toHaveLength(0);
            expect(result.total).toBe(n);
            expect(result.page).toBe(beyondPage);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
