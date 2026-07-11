import { NextResponse } from "next/server";

// TEMPORARY diagnostic endpoint — remove after debugging the Vercel 500.
// Reports env-var presence (booleans only, no secret values) and the real
// error thrown when running the same Prisma query the homepage uses.
export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DATABASE_URL_host:
      process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? null,
    DIRECT_URL: !!process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    cwd: process.cwd(),
  };

  // What Prisma files actually made it into the deployed function bundle?
  const fs = await import("node:fs");
  const path = await import("node:path");
  const bundledPrismaFiles: Record<string, string[] | string> = {};
  for (const dir of [
    path.join(process.cwd(), "src/generated/prisma"),
    path.join("/var/task", "src/generated/prisma"),
  ]) {
    try {
      bundledPrismaFiles[dir] = fs.readdirSync(dir);
    } catch (e) {
      bundledPrismaFiles[dir] = `(missing: ${(e as Error).message})`;
    }
  }

  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.party.count();
    return NextResponse.json({ ok: true, env, bundledPrismaFiles, partyCount: count });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      {
        ok: false,
        env,
        bundledPrismaFiles,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack?.split("\n").slice(0, 8),
        },
      },
      { status: 200 },
    );
  }
}
