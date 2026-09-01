/**
 * GET  /api/kb  — list all knowledge base articles
 * POST /api/kb  — upload a new knowledge base file (admin only)
 *
 * Supported file types: PDF, DOCX, DOC, images (JPEG/PNG/GIF/WEBP), CSV, XLSX, XLS
 * Max file size: 20 MB
 * Storage: Cloudinary (raw resource type for non-images, image for images)
 */
import { NextRequest, NextResponse } from "next/server";
import { authGuard } from "@/middleware/auth-guard";
import { requireRole } from "@/middleware/role-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";
import cloudinary from "@/lib/cloudinary";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf":                                                        "pdf",
  "application/msword":                                                     "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
  "application/vnd.ms-excel":                                               "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":      "xlsx",
  "text/csv":                                                               "csv",
  "image/jpeg":                                                             "jpg",
  "image/png":                                                              "png",
  "image/gif":                                                              "gif",
  "image/webp":                                                             "webp",
};

// ─── GET /api/kb ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    await authGuard();

    const articles = await prisma.knowledgeBase.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        title:        true,
        filename:     true,
        originalName: true,
        fileType:     true,
        url:          true,
        createdAt:    true,
        uploadedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    return NextResponse.json(articles, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── POST /api/kb ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const actor = await authGuard();
    requireRole(actor, "ADMIN");

    // Pre-flight: verify Cloudinary credentials are configured before doing
    // any expensive work — gives a clear 503 instead of a cryptic 500.
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY    ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new ApiError(
        503,
        "File storage is not configured. Please contact your system administrator."
      );
    }

    const formData = await req.formData();
    const file  = formData.get("file");
    const title = formData.get("title");

    if (!(file instanceof File)) throw new ApiError(400, "No file provided.");
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new ApiError(400, "Title is required.");
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(400, "File exceeds the 20 MB limit.");
    }

    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      throw new ApiError(
        400,
        `Unsupported file type "${file.type}". Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, JPEG, PNG, GIF, WEBP.`
      );
    }

    // Convert to base64 data URI for Cloudinary
    const buffer  = Buffer.from(await file.arrayBuffer());
    const base64  = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // Images use resource_type "image"; everything else uses "raw"
    const isImage      = file.type.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    let result: Awaited<ReturnType<typeof cloudinary.uploader.upload>>;
    try {
      result = await cloudinary.uploader.upload(dataUri, {
        folder:        "mfg-kb",
        resource_type: resourceType,
        public_id:     `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        // For raw files, use the original extension so the URL is directly downloadable
        ...(isImage ? {} : { format: ext }),
      });
    } catch (uploadErr: unknown) {
      // Cloudinary throws plain objects or Error instances — extract message safely
      const msg =
        uploadErr instanceof Error
          ? uploadErr.message
          : typeof (uploadErr as Record<string, unknown>)?.message === "string"
            ? (uploadErr as { message: string }).message
            : "File upload to cloud storage failed.";

      // Log the real error server-side for debugging
      console.error("[KB upload] Cloudinary error:", uploadErr);

      throw new ApiError(
        502,
        `Could not upload file: ${msg}. Please check cloud storage configuration or try again.`
      );
    }

    const record = await prisma.knowledgeBase.create({
      data: {
        title:        title.trim(),
        filename:     result.public_id,
        originalName: file.name,
        fileType:     file.type,
        url:          result.secure_url,
        uploadedById: actor.id,
      },
      select: {
        id:           true,
        title:        true,
        filename:     true,
        originalName: true,
        fileType:     true,
        url:          true,
        createdAt:    true,
        uploadedBy: { select: { id: true, fullName: true } },
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
