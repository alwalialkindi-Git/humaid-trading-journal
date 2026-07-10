"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  APPROX,
  ariaMoney,
  formatDeltaMoney,
  formatMoneyParts,
  formatPercent,
  formatQuantity,
  formatUnitPrice,
} from "@/lib/amanah/number";
import { trustIndicator, type Provenance } from "@/lib/amanah/trust";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProvenanceContent, TrustIndicatorMark } from "@/components/ui/trust";

/**
 * Figure — the money-text primitive (AMANAH §4). Every financial figure on
 * NEW surfaces renders through this component:
 * - tabular numerals via the figure-* utilities
 * - currency code one step smaller and lighter than the figure
 * - deltas signed AND colored (never color-alone)
 * - `≈` marker for converted values
 * - provenance on demand (§4.11), quiet-by-default indicators (§9)
 */

type FigureKind = "money" | "delta" | "quantity" | "price" | "percent" | "percent-delta";
type FigureSize = "xl" | "lg" | "md" | "sm";

const SIZE_CLASS: Record<FigureSize, string> = {
  xl: "figure-xl",
  lg: "figure-lg",
  md: "figure-md",
  sm: "figure-sm",
};

const CODE_SIZE_CLASS: Record<FigureSize, string> = {
  xl: "text-base font-normal",
  lg: "text-sm font-normal",
  md: "text-xs font-normal",
  sm: "text-[10px] font-normal",
};

export interface FigureProps {
  value: number;
  kind?: FigureKind;
  /** ISO code; rendered for money/delta kinds */
  currency?: string;
  size?: FigureSize;
  /** FX-converted value → mandatory ≈ (§4.9) */
  approx?: boolean;
  provenance?: Provenance;
  className?: string;
}

function formatFor(kind: FigureKind, value: number): string {
  switch (kind) {
    case "money":
      return formatMoneyParts(value, "").figure;
    case "delta":
      return formatDeltaMoney(value);
    case "quantity":
      return formatQuantity(value);
    case "price":
      return formatUnitPrice(value);
    case "percent":
      return formatPercent(value);
    case "percent-delta":
      return formatPercent(value, { delta: true });
  }
}

export function Figure({
  value,
  kind = "money",
  currency,
  size = "md",
  approx = false,
  provenance,
  className,
}: FigureProps) {
  const isDelta = kind === "delta" || kind === "percent-delta";
  const showCode = Boolean(currency) && (kind === "money" || kind === "delta");
  const figureText = formatFor(kind, value);

  const body = (
    <span
      className={cn(
        SIZE_CLASS[size],
        "whitespace-nowrap",
        isDelta && (value < 0 ? "text-pnl-down" : "text-pnl-up"),
        className
      )}
      aria-label={
        showCode ? ariaMoney(value, currency!, isDelta) : undefined
      }
    >
      {approx && <span className="mr-0.5 text-ink-faint">{APPROX}</span>}
      {figureText}
      {showCode && (
        <span className={cn("ml-1 text-ink-faint", CODE_SIZE_CLASS[size])}>
          {currency!.toUpperCase()}
        </span>
      )}
    </span>
  );

  if (!provenance) return body;

  const indicator = trustIndicator(provenance);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-baseline gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Explain this figure${currency ? `: ${ariaMoney(value, currency, isDelta)}` : ""}`}
        >
          {body}
          <TrustIndicatorMark
            indicator={indicator}
            srLabel={indicator.kind === "dot" ? "value may be outdated" : undefined}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ProvenanceContent provenance={provenance} />
      </PopoverContent>
    </Popover>
  );
}
