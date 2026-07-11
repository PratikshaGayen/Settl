import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export async function GET(request: NextRequest) {
  const partyId =
    request.cookies.get("settl_party_id")?.value ??
    process.env.DEMO_FREELANCER_ID;

  if (!partyId) {
    return NextResponse.json({ balanceMinor: 0, balanceDisplay: "₱0.00" });
  }

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) {
    return NextResponse.json({ balanceMinor: 0, balanceDisplay: "₱0.00" });
  }

  return NextResponse.json({
    balanceMinor: String(party.balanceMinor),
    balanceDisplay: formatMoney(party.balanceMinor, "PHP"),
  });
}
