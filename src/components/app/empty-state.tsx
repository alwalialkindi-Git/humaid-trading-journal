import type { LucideIcon } from "lucide-react";

/**
 * Empty state (AMANAH §7): the product teaching what a place is for.
 * Art direction (Council A8): a single large, partially-cropped 8-point star
 * line-mark — one of the geometry's three permitted sites. One primary action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-card/60 px-6 py-16 text-center">
      {/* single cropped star mark — decorative only */}
      <svg
        viewBox="0 0 72 72"
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 text-brand opacity-[0.05]"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <path d="M36 2 L45 27 L70 36 L45 45 L36 70 L27 45 L2 36 L27 27 Z" />
        <path d="M36 14 L41.5 30.5 L58 36 L41.5 41.5 L36 58 L30.5 41.5 L14 36 L30.5 30.5 Z" />
      </svg>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface text-brand">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
