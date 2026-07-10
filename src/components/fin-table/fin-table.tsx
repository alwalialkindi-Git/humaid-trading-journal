"use client";

import * as React from "react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Figure } from "@/components/ui/figure";
import { FreshnessDot } from "@/components/ui/trust";
import { isStale } from "@/lib/amanah/trust";
import {
  formatFigureTimestamp,
} from "@/lib/amanah/number";
import type { Provenance } from "@/lib/amanah/trust";

/**
 * FinTable primitives (D1a) — the presentational base of the flagship
 * financial table (AMANAH §5). D2 composes these into the full component
 * (toolbar, sorting, aggregates, mobile card transform). No existing table
 * migrates in D1a.
 *
 * Laws encoded here: numeric cells right-aligned and never wrapping; sticky
 * header; density is a table-level mode (comfortable 44px / compact 32px,
 * compact drops to figure-sm); footer aggregates always labeled.
 */

type Density = "comfortable" | "compact";

const DensityContext = createContext<Density>("comfortable");

export function FinTable({
  density = "comfortable",
  stickyHeader = true,
  className,
  children,
  ...props
}: React.ComponentProps<"table"> & {
  density?: Density;
  stickyHeader?: boolean;
}) {
  return (
    <DensityContext.Provider value={density}>
      <div className="relative w-full overflow-x-auto scrollbar-thin">
        <table
          data-density={density}
          data-sticky={stickyHeader || undefined}
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </DensityContext.Provider>
  );
}

export function FinTableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "[&_tr]:border-b",
        "[table[data-sticky]_&]:sticky [table[data-sticky]_&]:top-0 [table[data-sticky]_&]:z-10 [table[data-sticky]_&]:bg-surface-raised",
        className
      )}
      {...props}
    />
  );
}

export function FinTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function FinTableRow({
  className,
  highlight,
  ...props
}: React.ComponentProps<"tr"> & {
  /** 2s settle highlight for a row the user just created (AMANAH §3 settle). */
  highlight?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-surface-sunken/60",
        highlight && "animate-settle",
        className
      )}
      {...props}
    />
  );
}

export function FinTableHead({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  const density = useContext(DensityContext);
  return (
    <th
      scope="col"
      className={cn(
        "px-3 align-middle text-[11px] font-semibold uppercase tracking-wide text-ink-muted",
        density === "compact" ? "h-8" : "h-10",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className
      )}
      {...props}
    />
  );
}

export function FinTableCell({
  className,
  align = "left",
  numeric = false,
  ...props
}: React.ComponentProps<"td"> & {
  align?: "left" | "right" | "center";
  /** numeric cells never wrap (AMANAH §5) */
  numeric?: boolean;
}) {
  const density = useContext(DensityContext);
  return (
    <td
      className={cn(
        "px-3 align-middle",
        density === "compact" ? "py-1.5" : "py-2.5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

/** Footer aggregate row — always labeled (Σ Total / Avg), never bare numbers. */
export function FinTableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t bg-surface-sunken/50 font-medium", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Cell renderers — the closed column-type set (AMANAH §5), built on Figure.
// ---------------------------------------------------------------------------

function useCellSize(): "md" | "sm" {
  return useContext(DensityContext) === "compact" ? "sm" : "md";
}

export function TextCell({
  primary,
  secondary,
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <FinTableCell className={className}>
      <p className="font-medium">{primary}</p>
      {secondary != null && (
        <p className="max-w-[240px] truncate text-xs text-ink-muted">{secondary}</p>
      )}
    </FinTableCell>
  );
}

export function MoneyCell({
  value,
  currency,
  provenance,
  approx,
}: {
  value: number;
  currency: string;
  provenance?: Provenance;
  approx?: boolean;
}) {
  const size = useCellSize();
  return (
    <FinTableCell align="right" numeric>
      <Figure value={value} kind="money" currency={currency} size={size} provenance={provenance} approx={approx} />
    </FinTableCell>
  );
}

export function DeltaCell({
  value,
  currency,
  percent,
}: {
  value: number;
  currency?: string;
  percent?: number | null;
}) {
  const size = useCellSize();
  return (
    <FinTableCell align="right" numeric>
      <Figure value={value} kind="delta" currency={currency} size={size} />
      {percent != null && (
        <span className="block">
          <Figure value={percent} kind="percent-delta" size="sm" />
        </span>
      )}
    </FinTableCell>
  );
}

export function QtyCell({ value }: { value: number }) {
  const size = useCellSize();
  return (
    <FinTableCell align="right" numeric>
      <Figure value={value} kind="quantity" size={size} />
    </FinTableCell>
  );
}

export function UnitPriceCell({
  value,
  asOf,
  manual,
}: {
  value: number | null;
  /** freshness dot appears past 24h (AMANAH §9) */
  asOf?: string | null;
  manual?: boolean;
}) {
  const size = useCellSize();
  if (value == null) {
    return (
      <FinTableCell align="right" numeric>
        <span className="text-ink-faint">—</span>
      </FinTableCell>
    );
  }
  return (
    <FinTableCell align="right" numeric>
      <span className="inline-flex items-baseline gap-1.5">
        <Figure value={value} kind="price" size={size} />
        {manual && (
          <span className="rounded-sm bg-surface-sunken px-1 py-0.5 text-[10px] lowercase text-ink-muted">
            manual
          </span>
        )}
        {!manual && asOf && isStale(asOf) && <FreshnessDot />}
      </span>
    </FinTableCell>
  );
}

export function PercentCell({ value }: { value: number | null }) {
  const size = useCellSize();
  return (
    <FinTableCell align="right" numeric>
      {value == null ? (
        <span className="text-ink-faint">—</span>
      ) : (
        <Figure value={value} kind="percent" size={size} />
      )}
    </FinTableCell>
  );
}

export function DateCell({ iso, time }: { iso: string; time?: string | null }) {
  return (
    <FinTableCell numeric className="text-ink-muted">
      <span className="figure-sm" title={time ? `Executed at ${time}` : undefined}>
        {formatFigureTimestamp(`${iso}T00:00:00`)}
        {time && <span className="ml-1 text-ink-faint">·</span>}
      </span>
    </FinTableCell>
  );
}
