import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma/client";
import { getUsdToPhpQuote, invalidateQuoteCache } from "@/lib/fx";
import { createInvoiceOnChain, isEscrowConfigured } from "@/lib/escrow";
import { centsToUsdc } from "@/lib/money";
import type { Hex } from "viem";

const prisma = new PrismaClient();

interface MilestoneInput {
  label: string;
  amountMinor: number; // in USD cents
}

interface CreateInvoiceBody {
  clientName: string;
  clientEmail: string;
  amountMinor: number; // total in USD cents
  receiveCurrency: "PHP";
  escrow: boolean;
  timeoutDays: number;
  timeoutDefault: "AUTO_RELEASE" | "AUTO_REFUND";
  milestones: MilestoneInput[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateInvoiceBody;

    // ── Validation ──────────────────────────────────────
    if (!body.clientName || !body.clientEmail) {
      return NextResponse.json(
        { error: "Client name and email are required." },
        { status: 400 },
      );
    }

    if (!body.amountMinor || body.amountMinor <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (body.escrow) {
      if (!body.milestones || body.milestones.length === 0) {
        return NextResponse.json(
          { error: "At least one milestone is required when escrow is enabled." },
          { status: 400 },
        );
      }

      const milestoneSum = body.milestones.reduce(
        (sum, m) => sum + m.amountMinor,
        0,
      );
      if (milestoneSum !== body.amountMinor) {
        return NextResponse.json(
          {
            error: `Milestone total ($${(milestoneSum / 100).toFixed(2)}) must equal invoice amount ($${(body.amountMinor / 100).toFixed(2)}).`,
          },
          { status: 400 },
        );
      }
    }

    // ── FX Quote ─────────────────────────────────────────
    const quote = await getUsdToPhpQuote();
    const payToken = crypto.randomUUID();

    // ── Persist ──────────────────────────────────────────
    // Read freelancer ID from session cookie; fall back to env var for backwards compat
    const freelancerId =
      request.cookies.get("settl_party_id")?.value ??
      process.env.DEMO_FREELANCER_ID;
    if (!freelancerId) {
      return NextResponse.json(
        { error: "Not signed in and DEMO_FREELANCER_ID is not configured." },
        { status: 500 },
      );
    }

    // Create FXQuote first, then reference it in the invoice
    const fxQuote = await prisma.fXQuote.create({
      data: {
        fromCurrency: "USD",
        toCurrency: "PHP",
        rate: parseFloat(quote.rate),
        source: quote.source,
        validUntil: quote.validUntil,
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        payeeId: freelancerId,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        amountMinor: BigInt(body.amountMinor),
        billingCurrency: "USD",
        receiveCurrency: body.receiveCurrency ?? "PHP",
        escrow: body.escrow,
        timeoutDays: body.timeoutDays ?? 7,
        timeoutDefault: body.timeoutDefault ?? "AUTO_RELEASE",
        status: "AWAITING_PAYMENT",
        payToken,
        fxQuoteId: fxQuote.id,
        milestones: body.escrow
          ? {
              create: body.milestones.map((m, idx) => ({
                idx,
                label: m.label,
                amountMinor: BigInt(m.amountMinor),
                status: "LOCKED",
              })),
            }
          : undefined,
      },
    });

    // Register the invoice on-chain (createInvoice) so the contract knows the
    // payee + milestone amounts before funding. Only for escrowed invoices once
    // the contract is deployed; pre-deploy this is skipped and the simulated
    // path handles fund/release.
    if (body.escrow && isEscrowConfigured()) {
      const payee = await prisma.party.findUnique({
        where: { id: freelancerId },
      });
      if (payee?.walletAddress) {
        const milestoneAmounts = body.milestones.map((m) =>
          centsToUsdc(BigInt(m.amountMinor)),
        );
        const timeoutSeconds = BigInt((body.timeoutDays ?? 7) * 86_400);
        const timeoutDefault =
          (body.timeoutDefault ?? "AUTO_RELEASE") === "AUTO_REFUND" ? 1 : 0;
        try {
          const contractInvoiceTx = await createInvoiceOnChain(
            invoice.id,
            payee.walletAddress as Hex,
            milestoneAmounts,
            timeoutSeconds,
            timeoutDefault as 0 | 1,
          );
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { contractInvoiceId: invoice.id },
          });
          console.log("Invoice registered on-chain:", contractInvoiceTx);
        } catch (err) {
          // Non-fatal: the invoice exists in the DB; registration can be retried.
          console.error("On-chain createInvoice failed:", err);
        }
      }
    }

    // Invalidate the quote cache so the next invoice gets a fresh quote
    invalidateQuoteCache();

    const origin = request.headers.get("origin") ?? "http://localhost:3000";
    const payLink = `${origin}/pay/${payToken}`;

    return NextResponse.json({ id: invoice.id, payLink }, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
