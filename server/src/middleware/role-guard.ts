import type { SessionUser } from "@/types/session.types";
import type { Role } from "@/types/user.types";
import { ApiError } from "@/utils/api-error";

/**
 * Enforces role-based access control for a resolved session user.
 *
 * Throws ApiError(403, "Forbidden") if the user's role is not in the provided roles list.
 *
 * @param user   - The authenticated session user returned by `authGuard`.
 * @param roles  - One or more roles that are permitted to access the resource.
 *
 * Satisfies Requirements 13.1, 13.2, 13.3, 13.4
 */
export function requireRole(user: SessionUser, ...roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Forbidden");
  }
}
