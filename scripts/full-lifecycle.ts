import "dotenv/config";
import { prisma } from "../src/lib/db";
import { approveMilestone, approveMilestoneViaCircle, isEscrowConfigured } from "../src/lib/escrow";
import { isCircleConfigured } from "../src/lib/circle";
import { convertUSDCtoPHP } from "../src/lib/convert";

const BASE = "http://localhost:3000";
const MAYA = "settl_party_id=maya-demo-id";
const NORTHWIND = "settl_party_id=northwind-demo-id";

async function api(path: string, cookie: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Mirrors the freelancer "Mark delivered" server action.
async function deliver(milestoneId: string) {
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: "AWAITING_APPROVAL", deliveredAt: new Date() },
  });
}

// Mirrors the client "Approve" server action (on-chain release + FX convert).
async function approve(milestoneId: string) {
  const ms = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { invoice: { include: { fxQuote: true, payer: true } } },
  });
  if (!ms || ms.status !== "AWAITING_APPROVAL") throw new Error("not awaiting approval");

  const payerCircleWalletId = ms.invoice.payer?.circleWalletId;
  const releaseTxHash =
    isCircleConfigured() && payerCircleWalletId
      ? await approveMilestoneViaCircle(ms.invoiceId, ms.idx, payerCircleWalletId)
      : await approveMilestone(ms.invoiceId, ms.idx);
  const rate = ms.invoice.fxQuote?.rate ?? 56.0;
  const { phpMinor } = await convertUSDCtoPHP(
    ms.amountMinor,
    String(rate),
    ms.invoice.fxQuoteId ?? undefined,
  );

  await prisma.$transaction([
    prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: "RELEASED", releaseTxHash, releasedAt: new Date() },
    }),
    prisma.transaction.create({
      data: { invoiceId: ms.invoiceId, milestoneId, type: "RELEASE", txHash: releaseTxHash, amountMinor: ms.amountMinor, currency: "USD" },
    }),
    prisma.transaction.create({
      data: { invoiceId: ms.invoiceId, milestoneId, type: "CONVERT", amountMinor: phpMinor, currency: "PHP", fxRate: rate },
    }),
    prisma.party.update({
      where: { id: ms.invoice.payeeId },
      data: { balanceMinor: { increment: phpMinor } },
    }),
  ]);

  const all = await prisma.milestone.findMany({ where: { invoiceId: ms.invoiceId } });
  const allReleased = all.every((m) => m.status === "RELEASED");
  const anyReleased = all.some((m) => m.status === "RELEASED");
  await prisma.invoice.update({
    where: { id: ms.invoiceId },
    data: { status: allReleased ? "COMPLETED" : anyReleased ? "PARTIALLY_RELEASED" : undefined },
  });
  return { releaseTxHash, phpMinor };
}

async function main() {
  if (!isEscrowConfigured()) throw new Error("escrow not configured");

  console.log("1. Create invoice ($2, two $1 milestones) as Maya...");
  const { id, payLink } = await api("/api/invoices", MAYA, {
    clientName: "Northwind Labs",
    clientEmail: "finance@northwind.xyz",
    amountMinor: 200,
    receiveCurrency: "PHP",
    escrow: true,
    timeoutDays: 7,
    timeoutDefault: "AUTO_RELEASE",
    milestones: [
      { label: "Design", amountMinor: 100 },
      { label: "Build", amountMinor: 100 },
    ],
  });
  console.log("   invoice:", id, "| payLink:", payLink);

  console.log("2. Fund escrow as Northwind...");
  const fund = await api(`/api/invoices/${id}/fund`, NORTHWIND);
  console.log("   fund tx:", fund.txHash);

  const milestones = await prisma.milestone.findMany({ where: { invoiceId: id }, orderBy: { idx: "asc" } });

  console.log("3. Maya delivers M0, Northwind approves M0...");
  await deliver(milestones[0].id);
  const r0 = await approve(milestones[0].id);
  console.log("   release tx:", r0.releaseTxHash, "| credited PHP minor:", r0.phpMinor.toString());

  console.log("4. Maya delivers M1, Northwind approves M1...");
  await deliver(milestones[1].id);
  const r1 = await approve(milestones[1].id);
  console.log("   release tx:", r1.releaseTxHash, "| credited PHP minor:", r1.phpMinor.toString());

  const inv = await prisma.invoice.findUnique({ where: { id } });
  const maya = await prisma.party.findUnique({ where: { id: "maya-demo-id" } });
  console.log("\nFinal invoice status:", inv?.status);
  console.log("Maya PHP balance (minor):", maya?.balanceMinor.toString());
  console.log("Client receipt:", `${BASE}/client/invoices/${id}/receipt`);
  console.log("Freelancer receipt:", `${BASE}/freelancer/invoices/${id}/receipt`);
  console.log("INVOICE_ID=" + id);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
