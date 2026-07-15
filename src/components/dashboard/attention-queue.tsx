"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, ListChecks, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  snoozeUntilIso,
  visibleAttention,
  SNOOZE_STORAGE_KEY,
  type AttentionItem,
  type AttentionTier,
} from "@/lib/attention";
import { Button } from "@/components/ui/button";

/**
 * AttentionQueue — the product's pulse (D4, sprint §9.2 ◇A5). ONE component
 * replacing banner stacks: severity-tiered rows (obligation > integrity >
 * data-freshness > housekeeping), each row = icon + one line + one action.
 * Max 5 visible with "view all". Items snooze for 7 days — except
 * obligations, which can only be honestly resolved at their source.
 * Empty state: the only place the product speaks like that.
 */

const TIER_ICON: Record<AttentionTier, typeof ShieldAlert> = {
  obligation: ShieldAlert, // unused: obligations render the brass ◆ instead
  integrity: ShieldAlert,
  freshness: Clock3,
  housekeeping: ListChecks,
};

/**
 * Snooze store — localStorage-backed external store (the FinTable density
 * pattern): the raw string flows through useSyncExternalStore (stable
 * snapshot, no setState-in-effect; SSR snapshot is "no snoozes", corrected
 * after hydration) and is parsed memoized.
 */
const snoozeListeners = new Set<() => void>();
function subscribeSnoozes(cb: () => void): () => void {
  snoozeListeners.add(cb);
  return () => snoozeListeners.delete(cb);
}
function readSnoozesRaw(): string {
  return window.localStorage.getItem(SNOOZE_STORAGE_KEY) ?? "";
}
function writeSnoozes(next: Record<string, string>): void {
  window.localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(next));
  for (const cb of snoozeListeners) cb();
}
function parseSnoozes(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  const snoozesRaw = useSyncExternalStore(subscribeSnoozes, readSnoozesRaw, () => "");
  const snoozes = useMemo(() => parseSnoozes(snoozesRaw), [snoozesRaw]);
  const [showAll, setShowAll] = useState(false);

  function snooze(id: string) {
    writeSnoozes({ ...snoozes, [id]: snoozeUntilIso() });
  }

  const { visible, overflow, snoozed, total } = visibleAttention(items, snoozes);
  const shown = showAll ? [...visible, ...overflow] : visible;

  return (
    <section aria-label="Attention" className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Attention</h2>
          <span
            aria-live="polite"
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              total > 0
                ? "bg-surface-sunken text-ink-muted"
                : "text-ink-faint"
            )}
          >
            {total} item{total === 1 ? "" : "s"}
          </span>
        </div>
        {snoozed > 0 && (
          <span className="text-[11px] text-ink-faint">{snoozed} snoozed</span>
        )}
      </div>

      {total === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">
          All quiet, alhamdulillah.
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((item) => {
            const Icon = TIER_ICON[item.tier];
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3",
                  item.sacred && "border-l-2 border-l-sacred bg-sacred-surface/40"
                )}
              >
                {item.sacred ? (
                  <span aria-hidden className="w-4 shrink-0 text-center text-sacred">
                    ◆
                  </span>
                ) : (
                  <Icon
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0",
                      item.tier === "integrity" ? "text-warn" : "text-ink-muted"
                    )}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={item.title}>
                    {item.title}
                  </p>
                  {item.detail && (
                    <p className="truncate text-xs text-ink-muted" title={item.detail}>
                      {item.detail}
                    </p>
                  )}
                </div>
                {item.snoozable && (
                  <button
                    type="button"
                    onClick={() => snooze(item.id)}
                    className="shrink-0 text-xs text-ink-faint hover:text-foreground"
                    aria-label={`Snooze “${item.title}” for 7 days`}
                  >
                    Snooze 7d
                  </button>
                )}
                <Button size="sm" variant="outline" asChild className="shrink-0">
                  <Link href={item.href}>
                    {item.hrefLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {overflow.length > 0 && (
        <div className="border-t px-5 py-2.5">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-ink-muted hover:text-foreground"
          >
            {showAll ? "Show fewer" : `View all (${overflow.length} more)`}
          </button>
        </div>
      )}
    </section>
  );
}
