import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// ─── PATCH /api/categories/:id ───────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await authGuard();
    requireRole(actor, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid category ID.");

    const existing = await prisma.ticketCategory.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Category not found.");

    const body = await req.json() as {
      name?: unknown;
      sortOrder?: unknown;
      isActive?: unknown;
    };

    const data: {
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw new ApiError(400, "name must be a non-empty string.", "name");
      }
      if (body.name.trim().length > 300) {
        throw new ApiError(400, "name must be 300 characters or fewer.", "name");
      }
      const conflict = await prisma.ticketCategory.findFirst({
        where: { name: body.name.trim(), NOT: { id } },
      });
      if (conflict) {
        throw new ApiError(409, "A category with this name already exists.", "name");
      }
      data.name = body.name.trim();
    }

    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== "number" || !Number.isFinite(body.sortOrder)) {
        throw new ApiError(400, "sortOrder must be a number.", "sortOrder");
      }
      data.sortOrder = body.sortOrder;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        throw new ApiError(400, "isActive must be a boolean.", "isActive");
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "No updatable fields provided (name, sortOrder, isActive).");
    }

    const updated = await prisma.ticketCategory.update({
      where: { id },
      data,
      select: {
        id:        true,
        name:      true,
        isActive:  true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── DELETE /api/categories/:id ──────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await authGuard();
    requireRole(actor, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid category ID.");

    const existing = await prisma.ticketCategory.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Category not found.");

    await prisma.ticketCategory.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
