import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fundEscrow, fundEscrowViaCircle, isEscrowConfigured } from "@/lib/escrow";
import { isCircleConfigured } from "@/lib/circle";
import { centsToUsdc } from "@/lib/money";

function simulatedTxHash(): string {
  return `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { milestones: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (invoice.status !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: "Invoice has already been funded." },
      { status: 409 },
    );
  }

  // Identify payer: prefer a signed-in CLIENT, otherwise use the first CLIENT in DB (demo).
  const sessionId = request.cookies.get("settl_party_id")?.value;
  let payerId: string | null = null;

  if (sessionId) {
    const p = await prisma.party.findUnique({ where: { id: sessionId } });
    if (p?.role === "CLIENT") payerId = p.id;
  }
  if (!payerId) {
    const fallback = await prisma.party.findFirst({ where: { role: "CLIENT" } });
    payerId = fallback?.id ?? null;
  }
  if (!payerId) {
    return NextResponse.json({ error: "No client account found." }, { status: 404 });
  }

  const payer = await prisma.party.findUnique({ where: { id: payerId } });

  // On-chain fund when the contract is deployed. If the payer is backed by a
  // Circle wallet, sign the fund from that wallet (real Circle Wallets path);
  // otherwise use the viem signer. Pre-deploy falls back to a simulated hash.
  let txHash: string;
  if (isEscrowConfigured()) {
    try {
      const amount = centsToUsdc(invoice.amountMinor);
      if (isCircleConfigured() && payer?.circleWalletId) {
        txHash = await fundEscrowViaCircle(invoiceId, amount, payer.circleWalletId);
      } else {
        txHash = await fundEscrow(invoiceId, amount);
      }
    } catch (err) {
      console.error("On-chain fund failed:", err);
      return NextResponse.json(
        { error: "On-chain funding failed. See server logs." },
        { status: 502 },
      );
    }
  } else {
    txHash = simulatedTxHash();
  }
  const fundedAt = new Date();

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        payerId,
        status: "FUNDED",
        fundedAt,
        contractInvoiceId: invoiceId,
      },
    }),
    prisma.transaction.create({
      data: {
        invoiceId,
        type: "FUND",
        txHash,
        amountMinor: invoice.amountMinor,
        currency: "USD",
      },
    }),
  ]);

  return NextResponse.json({ txHash, fundedAt });
}
