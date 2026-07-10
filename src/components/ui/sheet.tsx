"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet — side panel (desktop) / bottom panel (mobile), built on the Radix
 * Dialog primitive already in the project. Used by the position drawer.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          // Mobile: bottom sheet. Desktop (sm+): right side panel.
          "fixed z-50 flex flex-col bg-card shadow-xl outline-none",
          "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-l sm:border-t-0",
          // AMANAH motion verb: slide (240ms)
          "animate-slide-up sm:animate-slide-in-end",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <DialogPrimitive.Title className="text-base font-semibold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            className="rounded-md p-1.5 opacity-70 hover:bg-muted hover:opacity-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetContent };
