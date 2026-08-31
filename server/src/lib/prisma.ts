import { PrismaClient } from "@prisma/client";

// Extend the NodeJS global type to hold the cached Prisma instance.
// This prevents multiple PrismaClient instances during Next.js hot-reloads in
// development (each hot-reload would otherwise open new DB connections).
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
