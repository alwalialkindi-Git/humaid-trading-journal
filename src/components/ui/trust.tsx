"use client";

import { cn } from "@/lib/utils";
import {
  TRUST_LABELS,
  trustIndicator,
  type Provenance,
  type TrustIndicator,
} from "@/lib/amanah/trust";
import { formatFullTimestamp } from "@/lib/amanah/number";

/**
 * Trust-language components (AMANAH §9).
 * Quiet by default: render nothing for normal states; chips for human data;
 * an amber dot for staleness; a pulsing dot for pending.
 */

export function TrustChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium lowercase text-ink-muted",
        className
      )}
    >
      {label}
    </span>
  );
}

export function FreshnessDot({ pulse, className }: { pulse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full bg-warn",
        pulse && "animate-pulse",
        className
      )}
    />
  );
}

/** Renders the resting indicator for a provenance, per the visibility law. */
export function TrustIndicatorMark({
  indicator,
  srLabel,
}: {
  indicator: TrustIndicator;
  srLabel?: string;
}) {
  if (indicator.kind === "none") return null;
  if (indicator.kind === "chip") {
    return <TrustChip label={indicator.label} />;
  }
  return (
    <>
      <FreshnessDot pulse={indicator.pulse} />
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </>
  );
}

/** Popover body: the four questions every figure can answer (§4.11). */
export function ProvenanceContent({ provenance }: { provenance: Provenance }) {
  const rows: [string, string][] = [];
  rows.push(["State", TRUST_LABELS[provenance.state]]);
  if (provenance.source) rows.push(["Source", provenance.source]);
  if (provenance.asOf) rows.push(["As of", formatFullTimestamp(provenance.asOf)]);
  if (provenance.actor) rows.push(["Recorded by", provenance.actor]);
  if (provenance.derivation) rows.push(["Derivation", provenance.derivation]);
  if (provenance.note) rows.push(["Note", provenance.note]);

  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 text-xs">
          <dt className="shrink-0 uppercase tracking-wide text-ink-faint">{label}</dt>
          <dd className="text-right text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { trustIndicator };
export type { Provenance };
