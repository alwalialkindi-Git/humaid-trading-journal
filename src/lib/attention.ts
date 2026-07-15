import { formatMoney } from "@/lib/amanah/number";

/**
 * Attention queue logic — pure module (D4, sprint §9.2 ◇A5).
 * The product's pulse: one component replaces banner stacks. Severity tiers
 * are strict — obligation > integrity > data-freshness > housekeeping —
 * max 5 rows visible with "view all", and items are snoozable EXCEPT
 * obligations, which can only be honestly rescheduled at their source
 * (hawl date in Settings; purification by recording the payment).
 *
 * Deferred item sources (honest omissions, not placeholders): reconciliation
 * due (M4 import), unannotated trades (journal rebuild, Phase 7), research
 * follow-ups (M5.5 Research Desk).
 */

export type AttentionTier =
  | "obligation"
  | "integrity"
  | "freshness"
  | "housekeeping";

export const TIER_RANK: Record<AttentionTier, number> = {
  obligation: 0,
  integrity: 1,
  freshness: 2,
  housekeeping: 3,
};

export interface AttentionItem {
  id: string;
  tier: AttentionTier;
  title: string;
  detail?: string;
  href: string;
  hrefLabel: string;
  /** Obligations are never snoozable — encoded here, enforced by the queue. */
  snoozable: boolean;
  /** Acts of worship carry the brass accent (◆), never alarm styling. */
  sacred?: boolean;
}

/** Hawl enters the queue inside this window (matches the old banner rule). */
export const HAWL_ATTENTION_WINDOW_DAYS = 30;

export interface AttentionInput {
  /** Days until the hawl anniversary; null when no hawl date is set. */
  hawlDaysRemaining: number | null;
  /** Positive owed amounts per currency (accrued − paid, from incomeSummary). */
  purificationOwed: { currency: string; amount: number }[];
  /** Symbols of OPEN positions marked non-compliant. */
  nonCompliant: string[];
  /** Count of open positions not screened yet (not_reviewed or doubtful). */
  unscreened: number;
  negativeCashCurrencies: string[];
  /** Symbols whose price is older than the staleness threshold. */
  stalePrices: string[];
  /** Symbols with no price at all — excluded from every total. */
  unpriced: string[];
}

export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (
    input.hawlDaysRemaining != null &&
    input.hawlDaysRemaining <= HAWL_ATTENTION_WINDOW_DAYS
  ) {
    const d = input.hawlDaysRemaining;
    items.push({
      id: "zakat-hawl",
      tier: "obligation",
      title:
        d <= 0
          ? "Your hawl is complete — zakat is due"
          : `Zakat: your hawl completes in ${d} day${d === 1 ? "" : "s"}`,
      href: "/zakat",
      hrefLabel: "Open Zakat & Purify",
      snoozable: false,
      sacred: true,
    });
  }

  const owed = input.purificationOwed.filter((p) => p.amount > 0);
  if (owed.length > 0) {
    items.push({
      id: "purification-owed",
      tier: "obligation",
      title: `Purification owed: ${owed
        .map((p) => formatMoney(p.amount, p.currency))
        .join(" · ")}`,
      detail: "Accrued on dividends — record the payment to settle it.",
      href: "/zakat",
      hrefLabel: "Purify",
      snoozable: false,
      sacred: true,
    });
  }

  if (input.nonCompliant.length > 0) {
    items.push({
      id: "non-compliant",
      tier: "integrity",
      title: `${input.nonCompliant.length} non-compliant holding${
        input.nonCompliant.length === 1 ? "" : "s"
      }: ${input.nonCompliant.join(", ")}`,
      detail: "Review the position — exit or document your reasoning.",
      href: "/portfolio",
      hrefLabel: "Review",
      snoozable: true,
    });
  }

  if (input.unscreened > 0) {
    items.push({
      id: "unscreened",
      tier: "integrity",
      title: `${input.unscreened} holding${
        input.unscreened === 1 ? "" : "s"
      } not screened yet`,
      detail: "Set a compliance status so the shields can speak honestly.",
      href: "/portfolio",
      hrefLabel: "Screen",
      snoozable: true,
    });
  }

  if (input.negativeCashCurrencies.length > 0) {
    items.push({
      id: "negative-cash",
      tier: "integrity",
      title: `Cash is negative in ${input.negativeCashCurrencies.join(", ")}`,
      detail:
        "The ledger is likely missing a deposit or an opening balance — record it.",
      href: "/portfolio?tab=cash",
      hrefLabel: "Open statement",
      snoozable: true,
    });
  }

  if (input.stalePrices.length > 0) {
    items.push({
      id: "stale-prices",
      tier: "freshness",
      title: `Prices are stale for ${input.stalePrices.join(", ")}`,
      detail: "Older than 24 hours — refresh or set a manual price.",
      href: "/portfolio",
      hrefLabel: "Refresh",
      snoozable: true,
    });
  }

  if (input.unpriced.length > 0) {
    items.push({
      id: "unpriced",
      tier: "freshness",
      title: `${input.unpriced.join(", ")} ${
        input.unpriced.length === 1 ? "is" : "are"
      } unpriced`,
      detail: "Excluded from every total until a price exists — set one.",
      href: "/portfolio",
      hrefLabel: "Set price",
      snoozable: true,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Visibility: tier sort, snoozes, max 5 + view all
// ---------------------------------------------------------------------------

export const ATTENTION_MAX_VISIBLE = 5;
export const SNOOZE_DAYS = 7;
/** localStorage key; values are `{ [itemId]: ISO-until }`. */
export const SNOOZE_STORAGE_KEY = "amanah:attention-snoozes";

export interface AttentionVisibility {
  /** Tier-ordered, at most `max` rows. */
  visible: AttentionItem[];
  /** Tier-ordered remainder behind "view all". */
  overflow: AttentionItem[];
  /** Count currently hidden by an active snooze. */
  snoozed: number;
  /** Active (unsnoozed) item count — the queue's aria-live figure. */
  total: number;
}

export function visibleAttention(
  items: readonly AttentionItem[],
  snoozes: Record<string, string>,
  now: number = Date.now(),
  max: number = ATTENTION_MAX_VISIBLE
): AttentionVisibility {
  const active = items.filter((item) => {
    if (!item.snoozable) return true; // obligations ignore snoozes, always
    const until = snoozes[item.id];
    return !until || !(Date.parse(until) > now);
  });
  const sorted = [...active].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  return {
    visible: sorted.slice(0, max),
    overflow: sorted.slice(max),
    snoozed: items.length - active.length,
    total: active.length,
  };
}

export function snoozeUntilIso(
  now: number = Date.now(),
  days: number = SNOOZE_DAYS
): string {
  return new Date(now + days * 86_400_000).toISOString();
}
