"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

interface MilestoneRow {
  label: string;
  amountMinor: number;
  amountDisplay: string;
}

export default function NewInvoicePage() {
  const router = useRouter();

  const [clientName, setClientName] = useState("Northwind Labs");
  const [clientEmail, setClientEmail] = useState("finance@northwind.xyz");
  const [amountDisplay, setAmountDisplay] = useState("1200");
  const [escrow, setEscrow] = useState(true);
  const [timeoutDays, setTimeoutDays] = useState("7");
  const [timeoutDefault, setTimeoutDefault] = useState<"AUTO_RELEASE" | "AUTO_REFUND">("AUTO_RELEASE");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { label: "First designs", amountMinor: 60000, amountDisplay: "600" },
    { label: "Final handoff", amountMinor: 60000, amountDisplay: "600" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const totalMinor = Math.round(parseFloat(amountDisplay || "0") * 100);

  function addMilestone() {
    setMilestones([...milestones, { label: "", amountMinor: 0, amountDisplay: "" }]);
  }

  function removeMilestone(idx: number) {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== idx));
  }

  function updateMilestone(idx: number, field: "label" | "amountDisplay", value: string) {
    setMilestones((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        if (field === "label") return { ...m, label: value };
        const minor = Math.round(parseFloat(value || "0") * 100);
        return { ...m, amountDisplay: value, amountMinor: minor };
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!clientName || !clientEmail || !amountDisplay) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (escrow) {
      const sum = milestones.reduce((s, m) => s + m.amountMinor, 0);
      if (sum !== totalMinor) {
        toast.error(
          `Milestone total ($${(sum / 100).toFixed(2)}) must equal invoice amount ($${(totalMinor / 100).toFixed(2)}).`,
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail,
          amountMinor: totalMinor,
          receiveCurrency: "PHP",
          escrow,
          timeoutDays: parseInt(timeoutDays, 10),
          timeoutDefault,
          milestones: escrow
            ? milestones.map((m) => ({
                label: m.label,
                amountMinor: m.amountMinor,
              }))
            : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to create invoice.");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      await navigator.clipboard.writeText(data.payLink);
      toast.success("Link copied");
      router.push("/freelancer");
    } catch {
      toast.error("Something went wrong.");
      setSubmitting(false);
    }
  }

  const milestoneSum = milestones.reduce((s, m) => s + m.amountMinor, 0);
  const milestoneSumValid =
    !escrow || (milestones.length > 0 && milestoneSum === totalMinor);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center">
          <a href="/freelancer" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </a>
          <h1 className="ml-4 text-lg font-semibold">New Invoice</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Client info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Northwind Labs"
                required
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Client email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="e.g. finance@northwind.xyz"
                required
              />
            </div>
          </div>

          {/* Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(e.target.value)}
                  placeholder="1200"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Receive in</Label>
              <Select defaultValue="PHP" disabled>
                <SelectTrigger>
                  <SelectValue placeholder="PHP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHP">PHP</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">PHP only for now</p>
            </div>
          </div>

          {/* Escrow toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="escrow" className="text-base">
                Hold in escrow, release per milestone
              </Label>
              <p className="text-sm text-muted-foreground">
                Funds are locked until you deliver and the client approves each milestone.
              </p>
            </div>
            <Switch
              id="escrow"
              checked={escrow}
              onCheckedChange={setEscrow}
            />
          </div>

          {/* Milestone editor */}
          {escrow && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Milestones</Label>
                <span
                  className={`text-sm ${milestoneSumValid ? "text-muted-foreground" : "font-medium text-destructive"}`}
                >
                  Sum: ${(milestoneSum / 100).toFixed(2)} of ${(totalMinor / 100).toFixed(2)}
                </span>
              </div>

              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="mt-2 text-sm text-muted-foreground">M{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={m.label}
                      onChange={(e) => updateMilestone(i, "label", e.target.value)}
                      placeholder="e.g. First designs"
                      required
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.amountDisplay}
                        onChange={(e) =>
                          updateMilestone(i, "amountDisplay", e.target.value)
                        }
                        placeholder="600"
                        className="w-32"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMilestone(i)}
                    disabled={milestones.length <= 1}
                    className="mt-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMilestone}
                className="w-full"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add milestone
              </Button>
            </div>
          )}

          {/* Timeout */}
          <div>
            <Label>If no response within</Label>
            <Select
              value={timeoutDays}
              onValueChange={(value) => {
                if (value) {
                  setTimeoutDays(value);
                }
              }}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days → auto-release to freelancer</SelectItem>
                <SelectItem value="14">14 days → auto-release to freelancer</SelectItem>
                <SelectItem value="30">30 days → auto-release to freelancer</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              If the client never responds, after this window the funds release to you automatically.
            </p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting || !milestoneSumValid}
          >
            {submitting ? "Creating…" : "Create & copy link"}
          </Button>
        </form>
      </main>
    </div>
  );
}
