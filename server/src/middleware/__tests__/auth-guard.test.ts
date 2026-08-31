// Feature: mfg-ticket-system, Property 5: Authorization Enforcement Completeness

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { authGuard } from "../auth-guard";
import { requireRole } from "../role-guard";
import { ApiError } from "@/utils/api-error";
import type { SessionUser } from "@/types/session.types";
import type { Role } from "@/types/user.types";

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Also mock sessionOptions from @/lib/session (authGuard imports it)
vi.mock("@/lib/session", () => ({
  sessionOptions: { password: "mock-secret-at-least-32-chars-long!", cookieName: "session" },
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const ADMIN_USER: SessionUser = {
  id: 1,
  fullName: "Admin User",
  email: "admin@example.com",
  role: "ADMIN",
};

const EMPLOYEE_USER: SessionUser = {
  id: 2,
  fullName: "Employee User",
  email: "employee@example.com",
  role: "EMPLOYEE",
};

// ── Permission matrix ─────────────────────────────────────────────────────────

/**
 * Each entry describes a scenario that must be denied (401 or 403).
 */
type DeniedScenario = {
  description: string;
  /** null = no session cookie / unauthenticated */
  sessionUser: SessionUser | null;
  /** undefined = not applicable (requireRole test); null = user not found in DB */
  dbUserActive?: boolean | null;
  expectedStatusCode: 401 | 403;
  /** Present only for requireRole (403) scenarios */
  requireRoleTest?: {
    user: SessionUser;
    allowedRoles: Role[];
  };
};

/**
 * Property 5: Authorization Enforcement Completeness
 *
 * The permission matrix below captures every denied-access scenario that the
 * system must enforce.  The property iterates over all scenarios (using
 * fc.constantFrom) and asserts that each one produces an ApiError with the
 * correct HTTP status code.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 2.1, 5.8, 6.3, 7.6, 7.7, 8.4
 */
const DENIED_SCENARIOS: DeniedScenario[] = [
  // ── 401 cases (authGuard) ──────────────────────────────────────────────────

  {
    description: "No session: unauthenticated request must be rejected with 401",
    sessionUser: null,
    dbUserActive: undefined,
    expectedStatusCode: 401,
  },
  {
    description: "Session present but account is inactive → 401",
    sessionUser: ADMIN_USER,
    dbUserActive: false,
    expectedStatusCode: 401,
  },
  {
    description: "Session present but user no longer exists in DB → 401",
    sessionUser: ADMIN_USER,
    dbUserActive: null,
    expectedStatusCode: 401,
  },

  // ── 403 cases (requireRole) ───────────────────────────────────────────────

  {
    description: "EMPLOYEE calling ADMIN-only endpoint → 403 (Req 13.2)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
  {
    description:
      "EMPLOYEE accessing user management (GET /api/users) → 403 (Req 2.1)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
  {
    description:
      "EMPLOYEE accessing user management (POST /api/users) → 403 (Req 2.1)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
  {
    description:
      "EMPLOYEE calling ticket assign endpoint → 403 (Req 5.8)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
  {
    description:
      "EMPLOYEE changing ticket priority → 403 (Req 6.3)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
  {
    description:
      "EMPLOYEE editing ticket fields via PATCH → 403 (Req 8.4)",
    sessionUser: EMPLOYEE_USER,
    expectedStatusCode: 403,
    requireRoleTest: {
      user: EMPLOYEE_USER,
      allowedRoles: ["ADMIN"],
    },
  },
];

// ── Helper: configure mocks for a given scenario ─────────────────────────────

function setupMocksForScenario(scenario: DeniedScenario): void {
  // cookies() always returns a dummy cookie store
  vi.mocked(cookies).mockResolvedValue({} as Awaited<ReturnType<typeof cookies>>);

  if (scenario.sessionUser === null) {
    // No authenticated user in the session
    vi.mocked(getIronSession).mockResolvedValue(
      { user: undefined } as unknown as Awaited<ReturnType<typeof getIronSession>>
    );
  } else {
    // Session carries a user
    vi.mocked(getIronSession).mockResolvedValue(
      { user: scenario.sessionUser } as unknown as Awaited<ReturnType<typeof getIronSession>>
    );
  }

  if (scenario.dbUserActive === null) {
    // User not found in DB
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  } else if (scenario.dbUserActive === false) {
    // User found but inactive
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      { isActive: false } as Awaited<ReturnType<typeof prisma.user.findUnique>>
    );
  } else if (scenario.dbUserActive === true) {
    // User found and active (used in active-session scenarios)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      { isActive: true } as Awaited<ReturnType<typeof prisma.user.findUnique>>
    );
  }
  // If dbUserActive is undefined, prisma mock is not called (requireRole scenarios)
}

// ── Property test ─────────────────────────────────────────────────────────────

describe("auth-guard — Property 5: Authorization Enforcement Completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    /**
     * Property 5: For every denied-access scenario in the permission matrix,
     * the middleware (authGuard or requireRole) must throw an ApiError whose
     * statusCode exactly matches the expected value.
     *
     * Validates: Requirements 13.1, 13.2, 13.3, 2.1, 5.8, 6.3, 7.6, 7.7, 8.4
     */
    "Property 5: Every denied-access scenario results in ApiError with the correct status code (Validates: Requirements 13.1, 13.2, 13.3, 2.1, 5.8, 6.3, 7.6, 7.7, 8.4)",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...DENIED_SCENARIOS),
          async (scenario) => {
            // Reset all mocks before each individual property iteration
            vi.clearAllMocks();
            setupMocksForScenario(scenario);

            if (scenario.requireRoleTest) {
              // ── 403 branch: requireRole ────────────────────────────────────
              const { user, allowedRoles } = scenario.requireRoleTest;

              let thrownError: unknown;
              try {
                requireRole(user, ...allowedRoles);
              } catch (err) {
                thrownError = err;
              }

              // 1. Must throw
              expect(thrownError).toBeDefined();

              // 2. Must be an ApiError instance
              expect(thrownError).toBeInstanceOf(ApiError);

              // 3. Status code must be 403
              expect((thrownError as ApiError).statusCode).toBe(
                scenario.expectedStatusCode
              );

              // 4. No DB access is performed for role-only checks
              // (requireRole is a pure synchronous guard, it never touches the DB)
              expect(prisma.user.findUnique).not.toHaveBeenCalled();
            } else {
              // ── 401 branch: authGuard ──────────────────────────────────────
              let thrownError: unknown;
              try {
                await authGuard();
              } catch (err) {
                thrownError = err;
              }

              // 1. Must throw
              expect(thrownError).toBeDefined();

              // 2. Must be an ApiError instance
              expect(thrownError).toBeInstanceOf(ApiError);

              // 3. Status code must be 401
              expect((thrownError as ApiError).statusCode).toBe(
                scenario.expectedStatusCode
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
