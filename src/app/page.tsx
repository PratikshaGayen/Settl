import { prisma } from "@/lib/db";
import { setSession, getSession } from "@/lib/session";
import { redirect } from "next/navigation";

async function signIn(formData: FormData) {
  "use server";
  const role = formData.get("role") as string;
  if (role === "FREELANCER") {
    const party = await prisma.party.findFirst({
      where: { role: "FREELANCER" },
    });
    if (party) {
      await setSession(party.id);
      redirect("/freelancer");
    }
  } else if (role === "CLIENT") {
    const party = await prisma.party.findFirst({
      where: { role: "CLIENT" },
    });
    if (party) {
      await setSession(party.id);
      redirect("/client");
    }
  }
}

export default async function Home() {
  const sessionId = await getSession();
  if (sessionId) {
    const party = await prisma.party.findUnique({ where: { id: sessionId } });
    if (party) {
      if (party.role === "FREELANCER") redirect("/freelancer");
      if (party.role === "CLIENT") redirect("/client");
    }
  }

  const [freelancer, client] = await Promise.all([
    prisma.party.findFirst({ where: { role: "FREELANCER" } }),
    prisma.party.findFirst({ where: { role: "CLIENT" } }),
  ]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settl</h1>
          <p className="mt-2 text-muted-foreground">
            Cross-border payments, settled on-chain.
          </p>
        </div>

        <div className="space-y-4">
          <form action={signIn}>
            <input type="hidden" name="role" value="FREELANCER" />
            <button
              type="submit"
              className="w-full rounded-xl border bg-card p-6 text-left shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <p className="font-semibold text-lg">I&apos;m a freelancer</p>
              <p className="mt-1 text-sm text-muted-foreground">
                I send invoices and receive payments.
              </p>
              {freelancer && (
                <p className="mt-2 text-xs font-medium text-primary">
                  Continue as {freelancer.displayName}
                </p>
              )}
            </button>
          </form>

          <form action={signIn}>
            <input type="hidden" name="role" value="CLIENT" />
            <button
              type="submit"
              className="w-full rounded-xl border bg-card p-6 text-left shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <p className="font-semibold text-lg">I&apos;m a client</p>
              <p className="mt-1 text-sm text-muted-foreground">
                I pay invoices and approve milestones.
              </p>
              {client && (
                <p className="mt-2 text-xs font-medium text-primary">
                  Continue as {client.displayName}
                </p>
              )}
            </button>
          </form>
        </div>

        {(!freelancer || !client) && (
          <p className="text-sm text-muted-foreground">
            No demo accounts found. Run{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              npx tsx prisma/seed.ts
            </code>{" "}
            first.
          </p>
        )}
      </div>
    </div>
  );
}
