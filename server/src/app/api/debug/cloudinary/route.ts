/**
 * GET /api/debug/cloudinary
 * Temporary diagnostic endpoint — shows which Cloudinary env vars are loaded.
 * REMOVE THIS AFTER DEBUGGING.
 */
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;

  return NextResponse.json({
    CLOUDINARY_CLOUD_NAME:  cloudName  ?? "(not set)",
    CLOUDINARY_API_KEY:     apiKey     ? `${apiKey.slice(0, 6)}…` : "(not set)",
    CLOUDINARY_API_SECRET:  apiSecret  ? `${apiSecret.slice(0, 6)}…` : "(not set)",
    // Show full first chars to confirm which key is loaded
    API_KEY_starts_with:    apiKey?.slice(0, 4)    ?? "(not set)",
    API_SECRET_starts_with: apiSecret?.slice(0, 4) ?? "(not set)",
  });
}
