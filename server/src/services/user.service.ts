/**
 * User service — CRUD operations for User management.
 *
 * Satisfies Requirements: 2.1–2.14, 14.1, 14.2, 14.3, 14.4
 */

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { ApiError } from "../utils/api-error";
import { stripPasswordHash } from "../utils/strip-password";
import type {
  SafeUser,
  CreateUserDto,
  UpdateUserDto,
  UserListQuery,
} from "../types/user.types";
import type { PaginatedResult } from "../types/pagination.types";

// ─── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["ADMIN", "EMPLOYEE"] as const;

function validateFullName(value: string): void {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 100) {
    throw new ApiError(400, "fullName must be between 1 and 100 characters.", "fullName");
  }
}

function validateEmail(value: string): void {
  if (typeof value !== "string" || !EMAIL_REGEX.test(value)) {
    throw new ApiError(400, "email must be a valid email address.", "email");
  }
  if (value.length > 191) {
    throw new ApiError(400, "email must be 191 characters or fewer.", "email");
  }
}

function validatePassword(value: string): void {
  if (typeof value !== "string" || value.length < 8) {
    throw new ApiError(400, "password must be at least 8 characters.", "password");
  }
}

function validateRole(value: unknown): void {
  if (!VALID_ROLES.includes(value as (typeof VALID_ROLES)[number])) {
    throw new ApiError(400, 'role must be "ADMIN" or "EMPLOYEE".', "role");
  }
}

function validateIsActive(value: unknown): void {
  if (typeof value !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean.", "isActive");
  }
}

// ─── Duplicate-email / employeeId error handler ───────────────────────────────

function handlePrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = (err.meta?.target as string[] | undefined) ?? [];
    if (target.includes("employee_id")) {
      throw new ApiError(409, "Employee ID already exists.", "employeeId");
    }
    throw new ApiError(409, "Email already exists.", "email");
  }
  throw err;
}

// ─── createUser ───────────────────────────────────────────────────────────────

/**
 * Create a new user with validated fields and a bcrypt-hashed password.
 * Requirements: 2.2, 2.3, 2.4, 14.1, 14.2, 14.4
 */
export async function createUser(dto: CreateUserDto): Promise<SafeUser> {
  // Validate all required fields
  validateFullName(dto.fullName);
  validateEmail(dto.email);
  validatePassword(dto.password);
  validateRole(dto.role);
  validateIsActive(dto.isActive);

  // Hash password — wrap in try/catch per Req 14.4
  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(dto.password, 10);
  } catch {
    throw new ApiError(500, "Failed to hash password.");
  }

  // Persist
  try {
    const user = await prisma.user.create({
      data: {
        employeeId: dto.employeeId?.trim() || null,
        fullName: dto.fullName.trim(),
        email: dto.email,
        passwordHash,
        role: dto.role,
        isActive: dto.isActive,
      },
    });
    return stripPasswordHash(user) as SafeUser;
  } catch (err) {
    handlePrismaError(err);
  }
}

// ─── listUsers ────────────────────────────────────────────────────────────────

/**
 * Return a paginated, optionally filtered list of users.
 * Requirements: 2.5, 2.6, 2.7, 2.8, 14.2
 */
export async function listUsers(
  query: UserListQuery
): Promise<PaginatedResult<SafeUser>> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  // Build Prisma where clause
  const where: Prisma.UserWhereInput = {};

  if (query.search) {
    const term = query.search;
    // MySQL's default collation (utf8mb4_general_ci) is case-insensitive;
    // mode: "insensitive" is a PostgreSQL-only Prisma option.
    where.OR = [
      { fullName: { contains: term } },
      { email: { contains: term } },
    ];
  }

  if (query.role !== undefined) {
    where.role = query.role;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users.map((u) => stripPasswordHash(u) as SafeUser),
    total,
    page,
    limit,
  };
}

// ─── getUserById ──────────────────────────────────────────────────────────────

/**
 * Fetch a single user by primary key.
 * Requirements: 2.9, 14.2
 */
export async function getUserById(id: number): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  return stripPasswordHash(user) as SafeUser;
}

// ─── updateUser ───────────────────────────────────────────────────────────────

/**
 * Partially update a user.
 * Requirements: 2.10, 2.11, 2.12, 2.13, 2.4, 14.1, 14.2, 14.4
 */
export async function updateUser(
  id: number,
  dto: UpdateUserDto
): Promise<SafeUser> {
  // Ensure user exists first
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, "User not found.");
  }

  // Collect only the recognised, supplied fields
  const RECOGNISED_KEYS: Array<keyof UpdateUserDto> = [
    "employeeId",
    "fullName",
    "email",
    "password",
    "role",
    "isActive",
  ];
  const suppliedKeys = RECOGNISED_KEYS.filter(
    (k) => dto[k] !== undefined
  );

  if (suppliedKeys.length === 0) {
    throw new ApiError(400, "No valid fields provided.");
  }

  // Validate only the supplied fields
  if (dto.fullName !== undefined) validateFullName(dto.fullName);
  if (dto.email !== undefined) validateEmail(dto.email);
  if (dto.password !== undefined) validatePassword(dto.password);
  if (dto.role !== undefined) validateRole(dto.role);
  if (dto.isActive !== undefined) validateIsActive(dto.isActive);

  // Build the update data object
  const data: Prisma.UserUpdateInput = {};

  if (dto.employeeId !== undefined) data.employeeId = dto.employeeId?.trim() || null;
  if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
  if (dto.email !== undefined) data.email = dto.email;
  if (dto.role !== undefined) data.role = dto.role;
  if (dto.isActive !== undefined) data.isActive = dto.isActive;

  // Re-hash password if provided — Req 2.12, 14.1, 14.4
  if (dto.password !== undefined) {
    try {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    } catch {
      throw new ApiError(500, "Failed to hash password.");
    }
  }

  // Persist
  try {
    const updated = await prisma.user.update({ where: { id }, data });
    return stripPasswordHash(updated) as SafeUser;
  } catch (err) {
    handlePrismaError(err);
  }
}
