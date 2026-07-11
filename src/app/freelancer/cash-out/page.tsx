"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function CashOutPage() {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "done">("confirm");
  const [submitting, setSubmitting] = useState(false);
  const [ref, setRef] = useState("");
  const [balanceDisplay, setBalanceDisplay] = useState("…");

  useEffect(() => {
    fetch("/api/balance")
      .then((r) => r.json())
      .then((d: { balanceDisplay?: string }) => {
        if (d.balanceDisplay) setBalanceDisplay(d.balanceDisplay);
      })
      .catch(() => {});
  }, []);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/cashout", { method: "POST" });
      if (!res.ok) {
        toast.error("Something went wrong.");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { ref: string };
      setRef(data.ref);
      setStep("done");
    } catch {
      toast.error("Something went wrong.");
    }
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center">
          <a
            href="/freelancer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </a>
          <h1 className="ml-4 text-lg font-semibold">Cash out</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        {step === "confirm" ? (
          <div className="space-y-6 text-center">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <p className="text-sm text-muted-foreground">Your balance</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {balanceDisplay}
              </p>
            </div>

            <div className="rounded-xl border p-6 text-left space-y-3">
              <p className="font-medium">Send to GCash •••42 via Coins.ph</p>
              <p className="text-sm text-muted-foreground">
                Your PHP balance will be sent to your linked GCash account
                through Coins.ph, a licensed Philippine money service.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/freelancer")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? "Processing…" : "Confirm"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8">
              <p className="text-lg font-medium text-emerald-800">On its way</p>
              <p className="mt-2 text-sm text-emerald-700">
                Reference{" "}
                <span className="font-mono font-medium">{ref}</span>
              </p>
              <p className="mt-1 text-sm text-emerald-700">est. arrival 3 min</p>
            </div>

            <Button className="w-full" onClick={() => router.push("/freelancer")}>
              Back to dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
