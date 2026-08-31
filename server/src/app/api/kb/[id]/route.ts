/**
 * DELETE /api/kb/:id — remove a knowledge base article (admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await authGuard();
    requireRole(actor, "ADMIN");

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) throw new ApiError(400, "Invalid KB article ID.");

    const article = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!article) throw new ApiError(404, "KB article not found.");

    // Delete from Cloudinary
    const isImage = article.fileType.startsWith("image/");
    await cloudinary.uploader.destroy(article.filename, {
      resource_type: isImage ? "image" : "raw",
    });

    await prisma.knowledgeBase.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
