"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/lib/engine/positions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Segmented transaction-type row (D3 — sprint §11): one compact line,
 * Buy · Sell · Div · Cash ▾ · Obligation ▾ — replacing the four grouped chip
 * rows. Grouped types live behind menu segments; an active menu segment shows
 * the chosen subtype. Radiogroup keyboard pattern: ←/→/Home/End move the
 * selection (a menu segment selects its remembered/default subtype);
 * Enter/Space on a menu segment opens its list.
 */

interface TypeOption {
  value: TransactionType;
  label: string;
}

interface Segment {
  id: string;
  label: string;
  options: TypeOption[];
}

const SEGMENTS: Segment[] = [
  { id: "buy", label: "Buy", options: [{ value: "buy", label: "Buy" }] },
  { id: "sell", label: "Sell", options: [{ value: "sell", label: "Sell" }] },
  { id: "dividend", label: "Div", options: [{ value: "dividend", label: "Dividend" }] },
  {
    id: "cash",
    label: "Cash",
    options: [
      { value: "deposit", label: "Deposit" },
      { value: "withdrawal", label: "Withdraw" },
      { value: "fee", label: "Fee" },
    ],
  },
  {
    id: "obligation",
    label: "Obligation",
    options: [
      { value: "zakat_payment", label: "Zakat payment" },
      { value: "purification_payment", label: "Purification" },
    ],
  },
];

export function TypeSegmentRow({
  value,
  onChange,
  sellDisabled,
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
  sellDisabled: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeSegment =
    SEGMENTS.find((s) => s.options.some((o) => o.value === value)) ?? SEGMENTS[0];

  function moveTo(segment: Segment) {
    const keep = segment.options.find((o) => o.value === value) ?? segment.options[0];
    onChange(keep.value);
    refs.current[segment.id]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const enabled = SEGMENTS.filter((s) => !(s.id === "sell" && sellDisabled));
    const idx = enabled.findIndex((s) => s.id === activeSegment.id);
    let next: number;
    if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    else return;
    e.preventDefault();
    moveTo(enabled[next]);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Transaction type"
      onKeyDown={onKeyDown}
      className="flex w-full gap-0.5 rounded-md border bg-surface-sunken p-0.5"
    >
      {SEGMENTS.map((seg) => {
        const isActive = seg.id === activeSegment.id;
        const disabled = seg.id === "sell" && sellDisabled;
        const hasMenu = seg.options.length > 1;
        const label =
          isActive && hasMenu
            ? (seg.options.find((o) => o.value === value)?.label ?? seg.label)
            : seg.label;
        const buttonClass = cn(
          "flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-[5px] px-2 text-sm transition-colors",
          isActive
            ? "bg-primary font-medium text-primary-foreground"
            : "text-ink-muted hover:bg-muted hover:text-foreground",
          disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
        );

        if (!hasMenu) {
          return (
            <button
              key={seg.id}
              ref={(el) => {
                refs.current[seg.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              title={disabled ? "No open positions to sell" : undefined}
              onClick={() => onChange(seg.options[0].value)}
              className={buttonClass}
            >
              <span className="truncate">{label}</span>
            </button>
          );
        }

        return (
          <Popover
            key={seg.id}
            open={openMenu === seg.id}
            onOpenChange={(o) => setOpenMenu(o ? seg.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                ref={(el) => {
                  refs.current[seg.id] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                className={buttonClass}
              >
                <span className="truncate">{label}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-44 p-1"
              role="menu"
              aria-label={`${seg.label} types`}
            >
              {seg.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-sm",
                    value === o.value
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {o.label}
                  {value === o.value && <Check aria-hidden className="h-3.5 w-3.5" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
