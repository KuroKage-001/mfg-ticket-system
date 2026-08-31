import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import * as User_Service from "@/services/user.service";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import type { UpdateUserDto } from "@/types/user.types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/users/:id
 *
 * Returns the user with the given ID (passwordHash excluded).
 * Only accessible by authenticated ADMINs.
 *
 * Responses:
 * - 200  SafeUser
 * - 400  Non-numeric ID
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 * - 404  User not found
 *
 * Satisfies Requirements 2.1, 2.9, 2.14
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await authGuard();
    requireRole(user, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid user ID.", "id");
    }

    const result = await User_Service.getUserById(id);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/users/:id
 *
 * Partially updates the user with the given ID.
 * Only accessible by authenticated ADMINs.
 * Accepts any subset of: fullName, email, password, role, isActive.
 *
 * Responses:
 * - 200  SafeUser (updated user, passwordHash excluded)
 * - 400  Non-numeric ID, empty body, or validation failure
 * - 401  Unauthenticated
 * - 403  Not an ADMIN
 * - 404  User not found
 * - 409  Email already exists
 *
 * Satisfies Requirements 2.1, 2.10, 2.11, 2.12, 2.13, 2.14, 14.1, 14.2
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await authGuard();
    requireRole(user, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      throw new ApiError(400, "Invalid user ID.", "id");
    }

    const body = await req.json();
    const dto: UpdateUserDto = {};

    if (body.employeeId !== undefined) dto.employeeId = body.employeeId;
    if (body.fullName !== undefined) dto.fullName = body.fullName;
    if (body.email !== undefined) dto.email = body.email;
    if (body.password !== undefined) dto.password = body.password;
    if (body.role !== undefined) dto.role = body.role;
    if (body.isActive !== undefined) dto.isActive = body.isActive;

    const updated = await User_Service.updateUser(id, dto);

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
