import { readdirSync } from "node:fs";
import { PrismaClient } from "@/generated/prisma/client";

// On Vercel the Prisma query engine binary IS bundled at
// /var/task/src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node,
// but Next.js's bundler relocates the generated client so Prisma resolves the
// engine directory one level too high (/var/task/src/generated) and fails with
// "could not locate the Query Engine". Point it straight at the binary.
// Guarded to Vercel so local dev keeps using its native engine unchanged.
if (process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engineDir = "/var/task/src/generated/prisma";
  try {
    const engine = readdirSync(engineDir).find(
      (f) => f.startsWith("libquery_engine") && f.endsWith(".so.node"),
    );
    if (engine) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = `${engineDir}/${engine}`;
    }
  } catch {
    // Fall back to Prisma's default engine resolution.
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
