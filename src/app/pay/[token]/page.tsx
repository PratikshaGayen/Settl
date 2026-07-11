import { PrismaClient } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { notFound } from "next/navigation";
import FundButton from "./FundButton";

const prisma = new PrismaClient();

export default async function PayLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { payToken: token },
    include: {
      payee: true,
      milestones: { orderBy: { idx: "asc" } },
      fxQuote: true,
      transactions: { where: { type: "FUND" }, take: 1 },
    },
  });

  if (!invoice) notFound();

  const rate = invoice.fxQuote?.rate ?? 56.0;
  const receiveTotalMinor = BigInt(Math.round(Number(invoice.amountMinor) * rate));
  const receiveDisplay = formatMoney(receiveTotalMinor, "PHP");
  const totalDisplay = formatMoney(invoice.amountMinor, "USD");
  const isAlreadyFunded =
    invoice.status === "FUNDED" ||
    invoice.status === "PARTIALLY_RELEASED" ||
    invoice.status === "COMPLETED";

  const fundTx = invoice.transactions[0];
  const explorerBase = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Settl</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {invoice.clientName} → {invoice.payee.displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {totalDisplay}
            {invoice.escrow && invoice.milestones.length > 0
              ? ` · ${invoice.milestones.length} milestones`
              : ""}
            {invoice.escrow ? " · funds held until you approve each one" : ""}
          </p>
        </div>

        {/* Milestone list */}
        {invoice.milestones.length > 0 && (
          <div className="space-y-2">
            {invoice.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div>
                  <p className="font-medium">{m.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(m.amountMinor, "USD")}
                  </p>
                </div>
                {isAlreadyFunded && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    Locked
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Receive box */}
        <div className="rounded-xl border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {invoice.payee.displayName} receives
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{receiveDisplay}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            rate locked 60s · $1 = ₱{rate.toFixed(2)}
          </p>
        </div>

        {/* Network fee */}
        <div className="rounded-lg border bg-card px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            Network fee: ~$0.04, paid in USDC
          </p>
        </div>

        {/* Action area */}
        <div className="text-center">
          {isAlreadyFunded ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="font-medium text-emerald-800">Funded — in escrow</p>
                <p className="mt-1 text-sm text-emerald-700">
                  {invoice.milestones.length > 0
                    ? `Both milestones locked. ${invoice.payee.displayName} can start work.`
                    : `${invoice.payee.displayName} can start work.`}
                </p>
              </div>
              {fundTx?.txHash && (
                <p className="text-xs text-muted-foreground">
                  Fund tx:{" "}
                  {explorerBase ? (
                    <a
                      href={`${explorerBase}${fundTx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono hover:underline"
                    >
                      {fundTx.txHash.slice(0, 10)}…{fundTx.txHash.slice(-8)}
                    </a>
                  ) : (
                    <span className="font-mono">
                      {fundTx.txHash.slice(0, 10)}…{fundTx.txHash.slice(-8)}
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <FundButton
              invoiceId={invoice.id}
              totalDisplay={totalDisplay}
              explorerBaseUrl={process.env.ARC_EXPLORER_URL ?? ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}
