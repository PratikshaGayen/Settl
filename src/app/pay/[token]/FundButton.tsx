"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "idle" | "connecting" | "approving" | "funding" | "done" | "error";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function FundButton({
  invoiceId,
  totalDisplay,
  explorerBaseUrl,
}: {
  invoiceId: string;
  totalDisplay: string;
  explorerBaseUrl?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleFund() {
    setStep("connecting");
    await sleep(900);

    setStep("approving");
    await sleep(800);

    setStep("funding");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/fund`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg((body as { error?: string }).error ?? "Funding failed.");
        setStep("error");
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { txHash?: string };
      setTxHash(body.txHash ?? null);
      setStep("done");
      // Give the user a moment to see the success state, then refresh.
      await sleep(2500);
      router.refresh();
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStep("error");
    }
  }

  const explorerUrl =
    txHash && explorerBaseUrl
      ? `${explorerBaseUrl.replace(/\/$/, "")}/tx/${txHash}`
      : null;

  if (step === "idle") {
    return (
      <button
        onClick={handleFund}
        className="inline-flex items-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        Connect wallet to fund
      </button>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-destructive">{errorMsg}</p>
        <button
          onClick={() => setStep("idle")}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
        <p className="font-medium text-emerald-800">Funded</p>
        {txHash &&
          (explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-emerald-700 underline hover:text-emerald-900"
            >
              tx {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
            </a>
          ) : (
            <p className="font-mono text-xs text-emerald-700">
              tx {txHash.slice(0, 10)}…{txHash.slice(-8)}
            </p>
          ))}
      </div>
    );
  }

  const stepLabel =
    step === "connecting"
      ? "Connecting wallet…"
      : step === "approving"
        ? `Approving ${totalDisplay} USDC…`
        : "Funding escrow…";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{stepLabel}</p>
    </div>
  );
}
