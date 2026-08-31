import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Pings the database with a lightweight SELECT 1 query and returns the
 * operational status of the server and database.
 *
 * Enforces a 5-second timeout via Promise.race so the endpoint does not hang
 * indefinitely when the database is unreachable.
 *
 * Responses:
 * - 200 { status: "ok",    database: "connected",   timestamp: <ISO-8601> }
 * - 503 { status: "error", database: "unreachable", timestamp: <ISO-8601> }
 *
 * Satisfies Requirements 12.1, 12.2, 12.3
 */
export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString();

  const TIMEOUT_MS = 5_000;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Database health check timed out")), TIMEOUT_MS)
  );

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ]);

    return NextResponse.json(
      { status: "ok", database: "connected", timestamp },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: "error", database: "unreachable", timestamp },
      { status: 503 }
    );
  }
}
