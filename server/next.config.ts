import type { NextConfig } from "next";

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN ?? "http://localhost:5173";

const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: ALLOWED_ORIGIN },
  { key: "Access-Control-Allow-Credentials", value: "true" },
  {
    key: "Access-Control-Allow-Methods",
    value: "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  },
  {
    key: "Access-Control-Allow-Headers",
    value: "Content-Type, Authorization",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CORS headers to all API routes
        source: "/api/:path*",
        headers: corsHeaders,
      },
      {
        // Allow the Vite dev client to load uploaded images
        source: "/uploads/:path*",
        headers: corsHeaders,
      },
    ];
  },
};

export default nextConfig;
