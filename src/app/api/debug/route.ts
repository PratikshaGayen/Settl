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
  };

  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.party.count();
    return NextResponse.json({ ok: true, env, partyCount: count });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      {
        ok: false,
        env,
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
