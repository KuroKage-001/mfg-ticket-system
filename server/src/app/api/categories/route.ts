/**
 * GET  /api/categories  — list all active categories (any authenticated user)
 * POST /api/categories  — create a new category (admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";

// ─── GET /api/categories ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    await authGuard();

    const categories = await prisma.ticketCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id:        true,
        name:      true,
        isActive:  true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── POST /api/categories ────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const actor = await authGuard();
    requireRole(actor, "ADMIN");

    const body = await req.json() as { name?: unknown; sortOrder?: unknown };

    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new ApiError(400, "name is required.", "name");
    }
    if (body.name.trim().length > 300) {
      throw new ApiError(400, "name must be 300 characters or fewer.", "name");
    }

    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? body.sortOrder
        : 0;

    // Check uniqueness manually so we can return a clean 409
    const existing = await prisma.ticketCategory.findUnique({
      where: { name: body.name.trim() },
    });
    if (existing) {
      throw new ApiError(409, "A category with this name already exists.", "name");
    }

    const category = await prisma.ticketCategory.create({
      data: {
        name:      body.name.trim(),
        sortOrder,
        isActive:  true,
      },
      select: {
        id:        true,
        name:      true,
        isActive:  true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
