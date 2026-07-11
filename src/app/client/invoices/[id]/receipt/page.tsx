import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { explorerTxUrl } from "@/lib/chain";
import Link from "next/link";
import { notFound } from "next/navigation";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function TxHash({ hash }: { hash: string }) {
  const url = explorerTxUrl(hash);
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-primary hover:underline"
      >
        {shortHash(hash)} ↗
      </a>
    );
  }
  return <span className="font-mono">{shortHash(hash)}</span>;
}

export default async function ClientReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { idx: "asc" } },
      fxQuote: true,
      payee: true,
      payer: true,
      transactions: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!invoice) notFound();

  const rate = invoice.fxQuote?.rate ?? 56.0;
  const fundTx = invoice.transactions.find((t) => t.type === "FUND");
  const fxSource = invoice.fxQuote?.source ?? "fallback";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center">
          <Link
            href={`/client/invoices/${invoice.id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to invoice
          </Link>
          <h1 className="ml-4 text-lg font-semibold">Receipt</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        {/* Parties */}
        <div className="rounded-xl border p-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-muted-foreground uppercase">From</p>
              <p className="mt-1 font-semibold">{invoice.clientName}</p>
              <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>
              {invoice.payer?.walletAddress && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {invoice.payer.walletAddress.slice(0, 6)}…
                  {invoice.payer.walletAddress.slice(-4)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">To</p>
              <p className="mt-1 font-semibold">{invoice.payee.displayName}</p>
              <p className="text-sm text-muted-foreground">{invoice.payee.email}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl border p-6 space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatMoney(invoice.amountMinor, "USD")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">FX rate</span>
            <span>$1 = ₱{rate.toFixed(2)}</span>
          </div>
          {invoice.escrow && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timeout rule</span>
              <span className="text-sm">
                {invoice.timeoutDays} days →{" "}
                {invoice.timeoutDefault === "AUTO_RELEASE"
                  ? "auto-release"
                  : "auto-refund"}
              </span>
            </div>
          )}
          {fundTx?.txHash && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Funding tx</span>
              <TxHash hash={fundTx.txHash} />
            </div>
          )}
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <h2 className="font-semibold">Milestones</h2>
          {invoice.milestones.map((m) => {
            const releaseTx = invoice.transactions.find(
              (t) => t.milestoneId === m.id && t.type === "RELEASE",
            );
            return (
              <div
                key={m.id}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(m.amountMinor, "USD")} →{" "}
                      {formatMoney(
                        BigInt(Math.round(Number(m.amountMinor) * rate)),
                        "PHP",
                      )}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.status === "RELEASED"
                        ? "bg-emerald-100 text-emerald-800"
                        : m.status === "AWAITING_APPROVAL"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.status.replace(/_/g, " ")}
                  </span>
                </div>
                {releaseTx?.txHash && (
                  <div className="text-xs text-muted-foreground">
                    <span>Release tx: </span>
                    <TxHash hash={releaseTx.txHash} />
                    <span className="mx-1">·</span>
                    <span>{new Date(releaseTx.createdAt).toLocaleString()}</span>
                  </div>
                )}
                {m.deliveredAt && (
                  <div className="text-xs text-muted-foreground">
                    Delivered: {new Date(m.deliveredAt).toLocaleString()}
                  </div>
                )}
                {m.releasedAt && (
                  <div className="text-xs text-muted-foreground">
                    Released: {new Date(m.releasedAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Circle products used per step */}
        <div className="rounded-xl border p-6">
          <h2 className="mb-3 font-semibold">Circle products used</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-muted-foreground">Both parties&apos; wallets</span>
              <span>Circle Wallets</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Settlement asset</span>
              <span>USDC on Arc</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Funding + release routing</span>
              <span>Circle Gateway</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">USD → PHP conversion</span>
              <span>
                StableFX{" "}
                <span className="text-xs text-muted-foreground">
                  ({fxSource === "stablefx" ? "live quote" : "rate fallback"})
                </span>
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Escrow float yield</span>
              <span>
                USYC{" "}
                <span className="text-xs text-muted-foreground">(conceptual)</span>
              </span>
            </li>
          </ul>
        </div>

        {/* Timestamps */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Created: {new Date(invoice.createdAt).toLocaleString()}</p>
          {invoice.fundedAt && (
            <p>Funded: {new Date(invoice.fundedAt).toLocaleString()}</p>
          )}
        </div>
      </main>
    </div>
  );
}
