"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./transaction-dialog";

/** Inline "Add transaction" button (used on the Portfolio header). */
export function AddTransactionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add transaction
      </Button>
      <TransactionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// The FAB was retired in D1b: desktop uses the ⌘K palette + explicit buttons,
// mobile uses the bottom tab bar's center action (AMANAH §12.9 — replaced
// patterns are removed, not accumulated).
