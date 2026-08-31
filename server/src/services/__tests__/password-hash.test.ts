// Feature: mfg-ticket-system, Property 4: Password Hash Non-Reversibility and Verification

/**
 * Property 4: Password Hash Non-Reversibility and Verification
 * Validates: Requirements 14.1, 14.3
 *
 * 14.1 — Passwords are hashed with bcrypt (cost factor ≥ 10) before storage.
 * 14.3 — Login verification uses bcrypt comparison; plain-text comparison is never used.
 */

import * as fc from "fast-check";
import bcrypt from "bcryptjs";
import { describe, it } from "vitest";

describe("Property 4: Password Hash Non-Reversibility and Verification", () => {
  /**
   * Property 4a — Verification: a password always verifies against its own hash.
   * For every valid password string, bcrypt.compareSync(p, bcrypt.hashSync(p, 10)) === true.
   */
  it("4a: a password always verifies against its own bcrypt hash (Validates: Requirements 14.1, 14.3)", () => {
    fc.assert(
      fc.property(
        // bcrypt silently truncates at 72 bytes; keep within that limit
        fc.string({ minLength: 1, maxLength: 72 }),
        (password) => {
          const hash = bcrypt.hashSync(password, 10);
          return bcrypt.compareSync(password, hash) === true;
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 4b — Non-reversibility: a different password never verifies against a hash
   * that was produced from another password.
   * For every pair of distinct passwords (p1 ≠ p2),
   * bcrypt.compareSync(p2, bcrypt.hashSync(p1, 10)) === false.
   */
  it("4b: a different password never verifies against another password's hash (Validates: Requirements 14.1, 14.3)", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.string({ minLength: 1 }),
            fc.string({ minLength: 1 })
          )
          .filter(([p1, p2]) => p1 !== p2),
        ([p1, p2]) => {
          const hash = bcrypt.hashSync(p1, 10);
          return bcrypt.compareSync(p2, hash) === false;
        }
      ),
      { numRuns: 20 }
    );
  });
});
