import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Figure, type FigureProps } from "@/components/ui/figure";

/**
 * StatBlock — labeled metric (sprint §25): uppercase caption + Figure +
 * optional secondary line. Figures left-align as a block (§4.2). Provenance
 * flows through the Figure primitive when supplied.
 */
export function StatBlock({
  label,
  figure,
  secondary,
  className,
}: {
  label: string;
  figure: FigureProps;
  /** e.g. a signed % or an ≈ equivalent — smaller and muted, never equal in authority. */
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <div className="mt-0.5">
        <Figure size="lg" {...figure} />
      </div>
      {secondary != null && (
        <div className="mt-0.5 text-xs text-ink-faint">{secondary}</div>
      )}
    </div>
  );
}
