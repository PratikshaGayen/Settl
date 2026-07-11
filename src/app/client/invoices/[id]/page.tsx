import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import SubmitButton from "@/components/SubmitButton";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "LOCKED"
      ? "bg-gray-100 text-gray-700"
      : status === "AWAITING_APPROVAL"
        ? "bg-amber-100 text-amber-800"
        : status === "RELEASED"
          ? "bg-emerald-100 text-emerald-800"
          : status === "AWAITING_PAYMENT"
            ? "bg-amber-100 text-amber-800"
            : status === "FUNDED"
              ? "bg-blue-100 text-blue-800"
              : status === "PARTIALLY_RELEASED"
                ? "bg-indigo-100 text-indigo-800"
                : status === "COMPLETED"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const clientId = await getSession();
  if (!clientId) redirect("/");

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { idx: "asc" } },
      fxQuote: true,
      payee: true,
      payer: true,
    },
  });

  if (!invoice) notFound();

  const receiveRate = invoice.fxQuote?.rate ?? 56.0;

  const awaitingMilestones = invoice.milestones.filter(
    (m) => m.status === "AWAITING_APPROVAL",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center">
          <Link
            href="/client"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
          <h1 className="ml-4 text-lg font-semibold">Invoice</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        {/* Awaiting approval banner */}
        {awaitingMilestones.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="font-medium text-amber-800">
              {awaitingMilestones.map((m) => m.label).join(", ")} ready for your review.
            </p>
          </div>
        )}

        {/* Invoice header */}
        <div className="rounded-xl border p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {invoice.clientName} → {invoice.payee.displayName}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatMoney(invoice.amountMinor, "USD")}
              </p>
              <p className="text-sm text-muted-foreground">
                Pays {formatMoney(
                  BigInt(Math.round(Number(invoice.amountMinor) * receiveRate)),
                  "PHP",
                )}{" "}
                in {invoice.receiveCurrency}
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Escrow: </span>
              {invoice.escrow ? "Yes" : "No"}
            </div>
            {invoice.escrow && (
              <div>
                <span className="text-muted-foreground">Timeout: </span>
                {invoice.timeoutDays} days →{" "}
                {invoice.timeoutDefault === "AUTO_RELEASE"
                  ? "auto-release"
                  : "auto-refund"}
              </div>
            )}
            {invoice.fxQuote && (
              <div>
                <span className="text-muted-foreground">Rate: </span>$1 = ₱
                {invoice.fxQuote.rate.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Milestones */}
        {invoice.milestones.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Milestones</h2>
            {invoice.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{m.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(m.amountMinor, "USD")}
                    {m.status === "RELEASED"
                      ? ` → ${formatMoney(
                          BigInt(
                            Math.round(Number(m.amountMinor) * receiveRate),
                          ),
                          "PHP",
                        )}`
                      : ` → ${formatMoney(
                          BigInt(
                            Math.round(Number(m.amountMinor) * receiveRate),
                          ),
                          "PHP",
                        )} on release`}
                  </p>
                  {m.releaseTxHash && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Converted on-chain · rate $1 = ₱{receiveRate.toFixed(2)} · tx{" "}
                      <span className="font-mono">
                        {m.releaseTxHash.slice(0, 6)}…{m.releaseTxHash.slice(-4)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={m.status} />
                  {m.status === "AWAITING_APPROVAL" && clientId === invoice.payerId && (
                    <form>
                      <SubmitButton
                        pendingLabel="Releasing…"
                        formAction={async () => {
                          "use server";
                          const { prisma: p } = await import("@/lib/db");
                          const {
                            approveMilestone,
                            approveMilestoneViaCircle,
                            isEscrowConfigured,
                          } = await import("@/lib/escrow");
                          const { isCircleConfigured } = await import(
                            "@/lib/circle"
                          );
                          const { convertUSDCtoPHP } = await import(
                            "@/lib/convert"
                          );
                          const ms = await p.milestone.findUnique({
                            where: { id: m.id },
                            include: {
                              invoice: {
                                include: { fxQuote: true, payer: true },
                              },
                            },
                          });
                          if (!ms || ms.status !== "AWAITING_APPROVAL") return;

                          // On-chain release. If the payer has a Circle wallet,
                          // sign the release from it (real Circle Wallets path);
                          // else viem signer; else simulated hash pre-deploy.
                          let releaseTxHash: string;
                          const payerCircleWalletId =
                            ms.invoice.payer?.circleWalletId;
                          if (isEscrowConfigured() && isCircleConfigured() && payerCircleWalletId) {
                            releaseTxHash = await approveMilestoneViaCircle(
                              ms.invoiceId,
                              ms.idx,
                              payerCircleWalletId,
                            );
                          } else if (isEscrowConfigured()) {
                            releaseTxHash = await approveMilestone(
                              ms.invoiceId,
                              ms.idx,
                            );
                          } else {
                            releaseTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
                          }

                          // Convert released USDC → PHP at the locked StableFX
                          // rate, referencing the FXQuote id (audit trail).
                          const rate = ms.invoice.fxQuote?.rate ?? 56.0;
                          const { phpMinor } = await convertUSDCtoPHP(
                            ms.amountMinor,
                            String(rate),
                            ms.invoice.fxQuoteId ?? undefined,
                          );

                          await p.$transaction([
                            // Release milestone
                            p.milestone.update({
                              where: { id: m.id },
                              data: {
                                status: "RELEASED",
                                releaseTxHash,
                                releasedAt: new Date(),
                              },
                            }),
                            // Record release transaction (USD side)
                            p.transaction.create({
                              data: {
                                invoiceId: m.invoiceId,
                                milestoneId: m.id,
                                type: "RELEASE",
                                txHash: releaseTxHash,
                                amountMinor: ms.amountMinor,
                                currency: "USD",
                              },
                            }),
                            // Record conversion transaction (PHP side)
                            p.transaction.create({
                              data: {
                                invoiceId: m.invoiceId,
                                milestoneId: m.id,
                                type: "CONVERT",
                                amountMinor: phpMinor,
                                currency: "PHP",
                                fxRate: rate,
                              },
                            }),
                            // Credit freelancer's balance
                            p.party.update({
                              where: { id: ms.invoice.payeeId },
                              data: {
                                balanceMinor: { increment: phpMinor },
                              },
                            }),
                          ]);

                          // Update invoice status
                          const allMs = await p.milestone.findMany({
                            where: { invoiceId: m.invoiceId },
                          });
                          const allReleased = allMs.every(
                            (ml) => ml.status === "RELEASED",
                          );
                          const anyReleased = allMs.some(
                            (ml) => ml.status === "RELEASED",
                          );

                          await p.invoice.update({
                            where: { id: m.invoiceId },
                            data: {
                              status: allReleased
                                ? "COMPLETED"
                                : anyReleased
                                  ? "PARTIALLY_RELEASED"
                                  : undefined,
                            },
                          });
                        }}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Approve {m.label.split(" ")[0]}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Receipt link */}
        {(invoice.status === "COMPLETED" ||
          invoice.status === "PARTIALLY_RELEASED") && (
          <div className="text-center">
            <Link
              href={`/client/invoices/${invoice.id}/receipt`}
              className="text-sm text-primary hover:underline"
            >
              View receipt →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
