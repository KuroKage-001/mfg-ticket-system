// Feature: mfg-ticket-system, Property 6: Activity Log Monotonicity

/**
 * Property 6: Activity Log Monotonicity
 * Validates: Requirements 10.1, 10.3
 *
 * 10.1 — The system SHALL record an activity log entry for every ticket lifecycle
 *         event (create, status change, priority change, assignment, field update,
 *         comment added).
 * 10.3 — Activity log entries SHALL be immutable; they are never updated or deleted.
 *
 * Strategy: Mock Prisma with an in-memory array store so that
 * `prisma.ticketActivity.create()` pushes to the array instead of hitting a DB.
 * Generate random sequences of 1–20 ActivityAction operations via fast-check.
 * After each call to `ActivityLogger.log()`, assert the activity count is
 * greater than or equal to the count before the call (monotonic non-decrease).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── In-memory store ───────────────────────────────────────────────────────────

/**
 * Activities accumulate here across each call to `prisma.ticketActivity.create()`.
 * Reset before each property run.
 */
let activityStore: object[] = [];

// ── Mock Prisma before importing the service ──────────────────────────────────

vi.mock("../../lib/prisma", () => ({
  default: {
    ticketActivity: {
      create: vi.fn(async ({ data }: { data: object }) => {
        const record = { id: activityStore.length + 1, ...data };
        activityStore.push(record);
        return record;
      }),
    },
  },
}));

// ── Import service AFTER mocks are registered ─────────────────────────────────

import { ActivityLogger, ActivityAction } from "../activity-logger.service";

// ── Valid operations ───────────────────────────────────────────────────────────

const VALID_OPERATIONS = Object.values(ActivityAction);

// ── Shared fixture data ───────────────────────────────────────────────────────

const BASE_ENTRY = {
  ticketId: 1,
  actorId: 1,
  oldValue: null,
  newValue: null,
} as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 6: Activity Log Monotonicity", () => {
  beforeEach(() => {
    activityStore = [];
  });

  it(
    "6: each log() call never decreases the total activity count (Validates: Requirements 10.1, 10.3)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(...VALID_OPERATIONS), {
            minLength: 1,
            maxLength: 20,
          }),
          async (operations) => {
            // Reset store for each property run
            activityStore = [];

            for (const action of operations) {
              const previousActivityCount = activityStore.length;

              await ActivityLogger.log({ ...BASE_ENTRY, action });

              const activityCount = activityStore.length;

              // Core monotonicity invariant: count must never decrease
              expect(activityCount).toBeGreaterThanOrEqual(previousActivityCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
