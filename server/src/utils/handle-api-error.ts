import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError } from "./api-error";

/**
 * Maps thrown errors to typed JSON responses for Next.js App Router handlers.
 *
 * Mapping rules:
 * - `ApiError`                              → response with the error's statusCode
 * - `PrismaClientKnownRequestError` P2002   → HTTP 409 (unique constraint / duplicate field)
 * - Everything else                         → HTTP 500
 *
 * Satisfies Requirements 1.6, 14.2, 2.3.
 */
export function handleApiError(err: unknown): NextResponse {
  // Known application error with explicit status code
  if (err instanceof ApiError) {
    const body: { message: string; field?: string } = {
      message: err.message,
    };
    if (err.field !== undefined) {
      body.field = err.field;
    }
    return NextResponse.json(body, { status: err.statusCode });
  }

  // Prisma unique-constraint violation → 409 Conflict
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    // `meta.target` is string[] of field names that caused the conflict
    const fields = (err.meta?.target as string[] | undefined) ?? [];
    const field = fields.length > 0 ? fields[0] : undefined;
    const body: { message: string; field?: string } = {
      message: "A record with that value already exists.",
    };
    if (field !== undefined) {
      body.field = field;
    }
    return NextResponse.json(body, { status: 409 });
  }

  // Unexpected error → 500
  console.error("[handleApiError] Unhandled error:", err);
  return NextResponse.json(
    { message: "Internal server error." },
    { status: 500 }
  );
}
