/**
 * GET  /api/tickets/:id/attachments  — list attachments for a ticket
 * POST /api/tickets/:id/attachments  — upload new image attachments
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { authGuard } from "@/middleware/auth-guard";
import { handleApiError } from "@/utils/handle-api-error";
import { ApiError } from "@/utils/api-error";
import prisma from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Handle CORS preflight — browsers send OPTIONS before GET/POST */
export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const MAX_FILES      = 5;
const MAX_BYTES      = 5 * 1024 * 1024; // 5 MB
const UPLOAD_BASE    = path.join(process.cwd(), "public", "uploads", "tickets");
const PUBLIC_BASE    = "/uploads/tickets";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    await authGuard();
    const { id: idParam } = await params;
    const ticketId = parseInt(idParam, 10);
    if (isNaN(ticketId)) throw new ApiError(400, "Invalid ticket ID.");

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        url: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return NextResponse.json(attachments, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const actor = await authGuard();

    const { id: idParam } = await params;
    const ticketId = parseInt(idParam, 10);
    if (isNaN(ticketId)) throw new ApiError(400, "Invalid ticket ID.");

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new ApiError(404, "Ticket not found.");

    const formData = await req.formData();
    const rawFiles = formData.getAll("files");

    // Filter to actual File objects
    const files = rawFiles.filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new ApiError(400, "No files provided.");
    if (files.length > MAX_FILES) {
      throw new ApiError(400, `Maximum ${MAX_FILES} files per upload.`);
    }

    // Validate each file
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new ApiError(400, `File "${file.name}" is not an image.`);
      }
      if (file.size > MAX_BYTES) {
        throw new ApiError(400, `File "${file.name}" exceeds 5 MB.`);
      }
    }

    // Ensure upload directory exists
    const ticketDir = path.join(UPLOAD_BASE, String(ticketId));
    await mkdir(ticketDir, { recursive: true });

    // Save files and build DB records
    const saved: Array<{
      id: number;
      ticketId: number;
      filename: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
      uploadedById: number;
      createdAt: Date;
    }> = [];

    for (const file of files) {
      const ext       = path.extname(file.name) || ".bin";
      const filename  = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const filePath  = path.join(ticketDir, filename);
      const buffer    = Buffer.from(await file.arrayBuffer());

      await writeFile(filePath, buffer);

      const url = `${PUBLIC_BASE}/${ticketId}/${filename}`;

      const record = await prisma.ticketAttachment.create({
        data: {
          ticketId,
          filename,
          originalName: file.name,
          mimeType:     file.type,
          sizeBytes:    file.size,
          url,
          uploadedById: actor.id,
        },
      });

      saved.push(record);
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
