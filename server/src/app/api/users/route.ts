import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import * as User_Service from "@/services/user.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import type { UserListQuery } from "@/types/user.types";
import type { CreateUserDto } from "@/types/user.types";

/**
 * GET /api/users
 *
 * Returns a paginated, optionally filtered list of users.
 * Only accessible by authenticated ADMINs.
 *
 * Query parameters:
 * - page      (number, default 1)
 * - limit     (number, default 20, max 100)
 * - search    (string, optional)
 * - role      ("ADMIN" | "EMPLOYEE", optional)
 * - isActive  (boolean as "true"/"false", optional)
 *
 * Responses:
 * - 200  PaginatedResult<SafeUser>
 * - 400  Invalid query parameter value
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 *
 * Satisfies Requirements 2.1, 2.5, 2.6, 2.7, 2.8, 2.14
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await authGuard();
    requireRole(user, "ADMIN");

    const { searchParams } = req.nextUrl;

    // Parse page
    const pageRaw = searchParams.get("page");
    const page = pageRaw !== null ? parseInt(pageRaw, 10) : 1;

    // Parse limit
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw !== null ? Math.min(parseInt(limitRaw, 10), 100) : 20;

    // Parse search
    const search = searchParams.get("search") ?? undefined;

    // Parse role — must be ADMIN or EMPLOYEE if provided
    const roleRaw = searchParams.get("role");
    let role: "ADMIN" | "EMPLOYEE" | undefined;
    if (roleRaw !== null) {
      if (roleRaw !== "ADMIN" && roleRaw !== "EMPLOYEE") {
        throw new ApiError(400, 'role must be "ADMIN" or "EMPLOYEE".', "role");
      }
      role = roleRaw;
    }

    // Parse isActive — must be "true" or "false" if provided
    const isActiveRaw = searchParams.get("isActive");
    let isActive: boolean | undefined;
    if (isActiveRaw !== null) {
      if (isActiveRaw !== "true" && isActiveRaw !== "false") {
        throw new ApiError(400, 'isActive must be "true" or "false".', "isActive");
      }
      isActive = isActiveRaw === "true";
    }

    const query: UserListQuery = { page, limit, search, role, isActive };
    const result = await User_Service.listUsers(query);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/users
 *
 * Creates a new user account.
 * Only accessible by authenticated ADMINs.
 *
 * Request body: CreateUserDto
 *   { fullName, email, password, role, isActive }
 *
 * Responses:
 * - 201  SafeUser (created user, passwordHash excluded)
 * - 400  Validation failure
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 * - 409  Email already exists
 *
 * Satisfies Requirements 2.1, 2.2, 2.3, 2.4, 2.14, 14.1, 14.2
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await authGuard();
    requireRole(user, "ADMIN");

    const body = await req.json();
    const dto: CreateUserDto = {
      employeeId: typeof body.employeeId === 'string' ? body.employeeId : undefined,
      fullName: body.fullName,
      email: body.email,
      password: body.password,
      role: body.role,
      isActive: body.isActive,
    };

    const created = await User_Service.createUser(dto);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
