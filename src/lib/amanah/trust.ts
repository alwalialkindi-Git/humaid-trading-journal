/**
 * AMANAH trust language — the closed 10-state provenance vocabulary
 * (AMANAH_DESIGN_SYSTEM.md §9). Adding a state requires DSA sign-off.
 *
 * Visibility law: "trust whispers, exceptions speak" —
 * Live/Calculated/Imported/Reconciled are silent (popover-only);
 * Manual/Override/Estimated always announce themselves;
 * Cached announces itself only past the staleness boundary; Pending pulses.
 */

export const TRUST_STATES = [
  "live",
  "cached",
  "manual",
  "override",
  "calculated",
  "estimated",
  "imported",
  "pending",
  "reconciled",
  "updated",
] as const;

export type TrustState = (typeof TRUST_STATES)[number];

export const STALE_AFTER_HOURS = 24;

export const TRUST_LABELS: Record<TrustState, string> = {
  live: "Live",
  cached: "Cached",
  manual: "Manual",
  override: "Override",
  calculated: "Calculated",
  estimated: "Estimated",
  imported: "Imported",
  pending: "Pending",
  reconciled: "Reconciled",
  updated: "Updated",
};

export type TrustIndicator =
  | { kind: "none" }
  | { kind: "dot"; tone: "warn"; pulse: boolean }
  | { kind: "chip"; label: string };

/** Everything the provenance popover can show for a figure (§4.11). */
export interface Provenance {
  state: TrustState;
  /** e.g. "Yahoo", "Manual entry", "Average-cost engine", "IBKR import" */
  source?: string;
  /** ISO timestamp the value is true as-of */
  asOf?: string;
  /** who recorded/overrode it (CIO condition 3) */
  actor?: string;
  /** e.g. "qty × price − fees", "computed from 4 transactions" */
  derivation?: string;
  /** override reason / estimate method / reconciliation statement date */
  note?: string;
}

export function isStale(asOf: string | undefined, now: number = Date.now()): boolean {
  if (!asOf) return false;
  const t = new Date(asOf).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > STALE_AFTER_HOURS * 3_600_000;
}

/**
 * The visibility decision for a figure's inline indicator (§9).
 * The popover is always available; this governs only what is VISIBLE at rest.
 */
export function trustIndicator(
  provenance: Pick<Provenance, "state" | "asOf">,
  now: number = Date.now()
): TrustIndicator {
  switch (provenance.state) {
    case "manual":
      return { kind: "chip", label: TRUST_LABELS.manual };
    case "override":
      return { kind: "chip", label: TRUST_LABELS.override };
    case "estimated":
      return { kind: "chip", label: TRUST_LABELS.estimated };
    case "pending":
      return { kind: "dot", tone: "warn", pulse: true };
    case "cached":
    case "live":
      return isStale(provenance.asOf, now)
        ? { kind: "dot", tone: "warn", pulse: false }
        : { kind: "none" };
    case "calculated":
    case "imported":
    case "reconciled":
    case "updated":
      return { kind: "none" };
  }
}
