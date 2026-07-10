"use client";

import * as React from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Field — the single form-row wrapper (AMANAH foundation). Standardizes
 * label / control / help / error markup and aria wiring so forms stop
 * drifting. The child control receives id + aria-describedby + aria-invalid.
 */
export function Field({
  label,
  help,
  error,
  required,
  className,
  children,
}: {
  label: string;
  help?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  const control = React.cloneElement(
    children as React.ReactElement<Record<string, unknown>>,
    {
      id,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : undefined,
    }
  );

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span aria-hidden> *</span>}
      </Label>
      {control}
      {help && !error && (
        <p id={helpId} className="text-xs text-ink-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
