// Feature: mfg-ticket-system, Property 2: Ticket Number Format Round-Trip

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatTicketNumber, parseTicketNumber } from "../ticket-number";

/**
 * Property 2: Ticket Number Format Round-Trip
 * Validates: Requirements 15.1, 15.2, 3.2
 *
 * For any valid (year, sequence) pair, parsing the formatted ticket number
 * must return the exact same year and sequence that were used to format it.
 */
describe("ticket-number utilities", () => {
  it("Property 2: round-trip — parseTicketNumber(formatTicketNumber(year, sequence)) === { year, sequence }", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 2000, max: 2099 }),
          fc.integer({ min: 1, max: 999999 })
        ),
        ([year, sequence]) => {
          const formatted = formatTicketNumber(year, sequence);
          const parsed = parseTicketNumber(formatted);

          expect(parsed).not.toBeNull();
          expect(parsed).toEqual({ year, sequence });
        }
      ),
      { numRuns: 100 }
    );
  });
});
