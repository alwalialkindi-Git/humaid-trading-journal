import { cn } from "@/lib/utils";

/** Eight-pointed star mark — the app's logo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-7 w-7", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="#047857" />
      <path
        d="M16 5 L18.8 13.2 L27 16 L18.8 18.8 L16 27 L13.2 18.8 L5 16 L13.2 13.2 Z"
        fill="#ecfdf5"
      />
      <circle cx="16" cy="16" r="2.4" fill="#047857" />
    </svg>
  );
}

export function Logo({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-semibold tracking-tight", textClassName)}>
        Humaid<span className="text-emerald-600"> Trading Journal</span>
      </span>
    </span>
  );
}
