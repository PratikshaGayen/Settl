import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { redirect } from "next/navigation";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "AWAITING_PAYMENT"
      ? "bg-amber-100 text-amber-800"
      : status === "FUNDED"
        ? "bg-blue-100 text-blue-800"
        : status === "PARTIALLY_RELEASED"
          ? "bg-indigo-100 text-indigo-800"
          : status === "COMPLETED"
            ? "bg-emerald-100 text-emerald-800"
            : status === "EXPIRED" || status === "CANCELLED" || status === "REFUNDED"
              ? "bg-gray-100 text-gray-600"
              : "bg-red-100 text-red-800";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function ClientDashboard() {
  const clientId = await getSession();

  if (!clientId) {
    redirect("/");
  }

  const party = await prisma.party.findUnique({ where: { id: clientId } });

  if (!party || party.role !== "CLIENT") {
    redirect("/");
  }

  const invoices = await prisma.invoice.findMany({
    where: { payerId: clientId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-xl font-semibold">Settl</h1>
          <span className="text-sm text-muted-foreground">
            {party.displayName}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Connected wallet</p>
          <p className="mt-1 font-mono text-sm">
            {party.walletAddress?.slice(0, 6)}…{party.walletAddress?.slice(-4)}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Invoices</h2>

          {invoices.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed p-12 text-center">
              <p className="text-muted-foreground">No invoices yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoices you&apos;ve funded will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y rounded-lg border">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/client/invoices/${inv.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">{inv.clientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(inv.amountMinor, "USD")}
                    </p>
                  </div>
                  <StatusBadge status={inv.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
