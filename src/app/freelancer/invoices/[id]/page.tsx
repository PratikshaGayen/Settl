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

export default async function FreelancerInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const freelancerId = await getSession();
  if (!freelancerId) redirect("/");

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      milestones: { orderBy: { idx: "asc" } },
      fxQuote: true,
      payee: true,
    },
  });

  if (!invoice) notFound();
  if (invoice.payeeId !== freelancerId) redirect("/freelancer");

  const receiveRate = invoice.fxQuote?.rate ?? 56.0;
  const receiveTotal = formatMoney(
    BigInt(Math.round(Number(invoice.amountMinor) * receiveRate)),
    "PHP",
  );

  const isFunded =
    invoice.status === "FUNDED" ||
    invoice.status === "PARTIALLY_RELEASED" ||
    invoice.status === "COMPLETED";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center">
          <Link
            href="/freelancer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
          <h1 className="ml-4 text-lg font-semibold">Invoice</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
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
                Receives {receiveTotal} in {invoice.receiveCurrency}
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
                <span className="text-muted-foreground"> · {invoice.fxQuote.source}</span>
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
                            Math.round(
                              Number(m.amountMinor) * receiveRate,
                            ),
                          ),
                          "PHP",
                        )}`
                      : ` → ${formatMoney(
                          BigInt(
                            Math.round(
                              Number(m.amountMinor) * receiveRate,
                            ),
                          ),
                          "PHP",
                        )} on release`}
                  </p>
                  {m.releaseTxHash && (
                    <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                      tx: {m.releaseTxHash.slice(0, 6)}…{m.releaseTxHash.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={m.status} />
                  {isFunded && m.status === "LOCKED" && (
                    <form>
                      <SubmitButton
                        pendingLabel="Marking…"
                        formAction={async () => {
                          "use server";
                          const { prisma: p } = await import("@/lib/db");
                          await p.milestone.update({
                            where: { id: m.id },
                            data: {
                              status: "AWAITING_APPROVAL",
                              deliveredAt: new Date(),
                            },
                          });
                        }}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Mark delivered
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Timeout rule */}
        {invoice.escrow && (
          <p className="text-xs text-muted-foreground text-center">
            {invoice.timeoutDefault === "AUTO_RELEASE"
              ? `If not approved within ${invoice.timeoutDays} days, releases to you.`
              : `If not approved within ${invoice.timeoutDays} days, refunds to client.`}
          </p>
        )}

        {/* Receipt link */}
        {(invoice.status === "COMPLETED" ||
          invoice.status === "PARTIALLY_RELEASED") && (
          <div className="text-center">
            <Link
              href={`/freelancer/invoices/${invoice.id}/receipt`}
              className="text-sm text-primary hover:underline"
            >
              View receipt →
            </Link>
          </div>
        )}

        {/* Pay link */}
        {invoice.payToken && (
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Pay link:{" "}
              <code className="rounded bg-muted-foreground/10 px-1 font-mono text-xs">
                /pay/{invoice.payToken}
              </code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
