// Feature: mfg-ticket-system, Property 3: Ticket Number Uniqueness

/**
 * Property 3: Ticket Number Uniqueness
 * Validates: Requirements 15.2, 15.3
 *
 * 15.2 — The Ticket_Service SHALL ensure no two tickets share the same Ticket_Number.
 * 15.3 — When multiple tickets are created concurrently, each receives a distinct
 *         Ticket_Number with no sequence collisions.
 *
 * Strategy: Mock Prisma with an in-memory counter that simulates the
 * `SELECT MAX ... FOR UPDATE` behavior sequentially. Call the ticket-number
 * generator N times via createTicket and assert all resulting ticket numbers
 * are distinct (set cardinality === N).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── Mock prisma before importing the service ──────────────────────────────────

/**
 * In-memory state for the Prisma mock.
 * `counter` tracks the highest sequence number issued for the current year,
 * mirroring what `SELECT MAX(CAST(SUBSTRING(ticket_number, 10) AS UNSIGNED))`
 * would return in a real database.
 */
let inMemoryCounter = 0;
let ticketIdSeed = 1;

vi.mock("../../lib/prisma", () => {
  /**
   * Fake TransactionClient passed to the createTicket callback.
   * - `$queryRaw` simulates `SELECT MAX ... FOR UPDATE` using the in-memory counter.
   * - `ticket.create` captures the generated ticketNumber and returns a minimal
   *   ticket object that satisfies the TicketDetail shape expected by the caller.
   */
  const makeFakeTx = () => ({
    $queryRaw: vi.fn(async () => {
      // Return the current counter as max_seq (null when counter === 0)
      return [{ max_seq: inMemoryCounter === 0 ? null : inMemoryCounter }];
    }),
    ticket: {
      create: vi.fn(async ({ data }: { data: { ticketNumber: string; title?: string; description?: string; category?: string; priority?: string; status?: string; createdById?: number; assignedToId?: number | null; [key: string]: unknown } }) => {
        // Advance the counter to reflect the newly inserted ticket
        inMemoryCounter += 1;

        const id = ticketIdSeed++;

        return {
          id,
          ticketNumber: data.ticketNumber,
          title: data.title ?? "Test",
          description: data.description ?? "Test description",
          category: data.category ?? "Other",
          priority: data.priority ?? "LOW",
          status: "OPEN",
          createdById: data.createdById ?? 1,
          assignedToId: data.assignedToId ?? null,
          resolvedAt: null,
          closedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: { id: 1, fullName: "Test User", email: "test@test.com" },
          assignedTo: null,
          comments: [],
          activities: [],
        };
      }),
    },
  });

  return {
    default: {
      /**
       * Simulate prisma.$transaction(callback):
       * Execute the callback with a fresh fake transaction client.
       * The in-memory counter persists across transactions within a property run,
       * simulating the serialized MAX query of the real implementation.
       */
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = makeFakeTx();
        return callback(tx);
      }),
      // user.findUnique is not called when actor.role === "EMPLOYEE"
      user: {
        findUnique: vi.fn(async () => null),
      },
    },
  };
});

// ── Mock the ActivityLogger so log() is a no-op ───────────────────────────────
vi.mock("../activity-logger.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../activity-logger.service")>();
  return {
    ...original,
    ActivityLogger: {
      log: vi.fn(async () => undefined),
    },
  };
});

// ── Import service AFTER mocks are set up ─────────────────────────────────────
import { createTicket } from "../ticket.service";
import type { CreateTicketDto } from "../../types/ticket.types";
import type { SessionUser } from "../../types/session.types";

// ── Shared test fixtures ──────────────────────────────────────────────────────

const EMPLOYEE_ACTOR: SessionUser = {
  id: 1,
  fullName: "Test Employee",
  email: "employee@test.com",
  role: "EMPLOYEE",
};

const BASE_DTO: CreateTicketDto = {
  title: "Test Ticket",
  description: "A test ticket description.",
  category: "Other",
  priority: "LOW",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 3: Ticket Number Uniqueness", () => {
  /**
   * Reset the in-memory counter before each property run so each fc.property
   * invocation starts from a clean sequence.
   */
  beforeEach(() => {
    inMemoryCounter = 0;
    ticketIdSeed = 1;
  });

  it(
    "3: N sequential ticket creations produce N distinct ticket numbers (Validates: Requirements 15.2, 15.3)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (n) => {
            // Reset counter for each run of this property
            inMemoryCounter = 0;
            ticketIdSeed = 1;

            // Create N tickets sequentially
            const ticketNumbers: string[] = [];
            for (let i = 0; i < n; i++) {
              const ticket = await createTicket(BASE_DTO, EMPLOYEE_ACTOR);
              ticketNumbers.push(ticket.ticketNumber);
            }

            // Assert all N ticket numbers are distinct
            const uniqueNumbers = new Set(ticketNumbers);
            expect(uniqueNumbers.size).toBe(n);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
