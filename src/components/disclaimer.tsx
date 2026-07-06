import { cn } from "@/lib/utils";

export const SHARIAH_DISCLAIMER =
  "This tool is for personal tracking and educational purposes only. It does not provide a fatwa. Please consult a qualified Shariah advisor for final rulings.";

export function ShariahDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900",
        className
      )}
    >
      {SHARIAH_DISCLAIMER}
    </p>
  );
}
