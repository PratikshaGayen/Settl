import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const partyId =
      request.cookies.get("settl_party_id")?.value ??
      process.env.DEMO_FREELANCER_ID;

    if (!partyId) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const party = await prisma.party.findUnique({ where: { id: partyId } });
    if (!party || party.role !== "FREELANCER") {
      return NextResponse.json(
        { error: "Only freelancers can cash out." },
        { status: 403 },
      );
    }

    if (party.balanceMinor <= 0n) {
      return NextResponse.json(
        { error: "No balance to cash out." },
        { status: 400 },
      );
    }

    const refChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const ref =
      "CPH-" +
      Array.from(
        { length: 8 },
        () => refChars[Math.floor(Math.random() * refChars.length)],
      ).join("");

    const balanceToCashOut = party.balanceMinor;

    // Zero out the balance. No transaction row needed — the ref is the receipt.
    await prisma.party.update({
      where: { id: partyId },
      data: { balanceMinor: 0n },
    });

    return NextResponse.json({ ref, amountMinor: String(balanceToCashOut) });
  } catch (error) {
    console.error("Cash-out failed:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
