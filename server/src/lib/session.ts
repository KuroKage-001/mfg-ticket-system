import { SessionOptions } from "iron-session";
import type { SessionData } from "@/types/session.types";

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "mfg_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Must be "none" in production so the cookie is sent cross-origin
    // (Vercel frontend → Railway backend). Requires secure: true.
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 60 * 60 * 24, // 24 hours (86400 seconds)
  },
};

// Re-export SessionData so consumers can import it from a single lib location
export type { SessionData };
