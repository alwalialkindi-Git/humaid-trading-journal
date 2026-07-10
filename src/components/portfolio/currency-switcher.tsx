"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setDisplayCurrencyAction } from "@/app/(app)/portfolio/actions";
import { useToast } from "@/components/ui/toaster";

/** Display-currency preference (Bug 4): USD ↔ AED, persisted on the profile.
 * Presentation-only — native transaction values are never touched. */
export function CurrencySwitcher({ value }: { value: "USD" | "AED" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function select(next: "USD" | "AED") {
    if (next === value || busy) return;
    setBusy(true);
    const res = await setDisplayCurrencyAction(next);
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    router.refresh();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Display currency"
      className="inline-flex rounded-md border p-0.5"
    >
      {(["AED", "USD"] as const).map((ccy) => (
        <button
          key={ccy}
          role="radio"
          aria-checked={value === ccy}
          disabled={busy}
          onClick={() => select(ccy)}
          className={cn(
            "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
            value === ccy
              ? "bg-primary text-primary-foreground"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {ccy}
        </button>
      ))}
    </div>
  );
}
