import { cn } from "@/lib/utils";

/**
 * Compliance shield grammar (AMANAH §10, Council D-007): the product's only
 * custom icon set. Four states distinguishable by SHAPE — filled / half /
 * slashed / outline — so compliance never relies on color alone; the label
 * is always rendered. Color is secondary reinforcement via compliance tokens.
 */

export type ComplianceState =
  | "compliant"
  | "doubtful"
  | "non_compliant"
  | "not_reviewed";

const SHIELD_META: Record<
  ComplianceState,
  { label: string; colorClass: string }
> = {
  compliant: { label: "Compliant", colorClass: "text-compliance-ok" },
  doubtful: { label: "Doubtful", colorClass: "text-compliance-doubtful" },
  non_compliant: { label: "Non-compliant", colorClass: "text-compliance-blocked" },
  not_reviewed: { label: "Not screened", colorClass: "text-compliance-unknown" },
};

const SHIELD_OUTLINE = "M8 1.5 L13.5 3.5 V8 C13.5 11.2 11.2 13.6 8 14.5 C4.8 13.6 2.5 11.2 2.5 8 V3.5 Z";

function ShieldIcon({ state, className }: { state: ComplianceState; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    >
      {state === "compliant" && (
        // filled shield + check (knocked out)
        <>
          <path d={SHIELD_OUTLINE} fill="currentColor" stroke="currentColor" />
          <path
            d="M5.4 8 L7.2 9.8 L10.6 6.2"
            stroke="var(--surface-raised)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {state === "doubtful" && (
        // half-filled shield (left half solid)
        <>
          <path d={SHIELD_OUTLINE} />
          <path
            d="M8 1.5 L2.5 3.5 V8 C2.5 11.2 4.8 13.6 8 14.5 Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      )}
      {state === "non_compliant" && (
        // outline shield + slash
        <>
          <path d={SHIELD_OUTLINE} />
          <path d="M3.5 12.5 L12.5 3.5" strokeLinecap="round" />
        </>
      )}
      {state === "not_reviewed" && (
        // outline only, dashed — nothing is claimed
        <path d={SHIELD_OUTLINE} strokeDasharray="2.2 1.6" />
      )}
    </svg>
  );
}

export function ShieldBadge({
  state,
  overridden = false,
  className,
}: {
  state: ComplianceState;
  /** user override — announced with a dot + accessible text, never silently */
  overridden?: boolean;
  className?: string;
}) {
  const meta = SHIELD_META[state] ?? SHIELD_META.not_reviewed;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        meta.colorClass,
        className
      )}
    >
      <ShieldIcon state={state} />
      {meta.label}
      {overridden && (
        <>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          <span className="sr-only">(your override)</span>
        </>
      )}
    </span>
  );
}
