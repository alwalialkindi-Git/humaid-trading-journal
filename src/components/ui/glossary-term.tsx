"use client";

import { cn } from "@/lib/utils";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * GlossaryTerm — the single way definitions reach the UI (D1b).
 * Renders a quiet dotted-underline trigger; tap/click opens the definition.
 * Children override the visible text (defaults to the registry term).
 */
export function GlossaryTerm({
  k,
  children,
  className,
}: {
  k: GlossaryKey;
  children?: React.ReactNode;
  className?: string;
}) {
  const entry = GLOSSARY[k];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline cursor-help underline decoration-dotted decoration-1 underline-offset-2",
            "text-inherit hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm",
            className
          )}
          aria-label={`Definition: ${entry.term}`}
        >
          {children ?? entry.term.toLowerCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="text-sm font-semibold">{entry.term}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{entry.definition}</p>
      </PopoverContent>
    </Popover>
  );
}
