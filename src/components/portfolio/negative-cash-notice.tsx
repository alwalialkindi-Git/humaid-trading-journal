"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";

/**
 * Negative-cash notice (UI requirement): states WHAT HAPPENED, offers the
 * three honest resolutions. Warns, never blocks (D-014).
 */
export function NegativeCashNotice({ currencies }: { currencies: string[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  if (currencies.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
      <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        You recorded purchases exceeding the available{" "}
        {currencies.join(" and ")} cash balance.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 pl-6">
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          Add deposit
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          Record opening balance
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/portfolio?tab=history">Review transactions</Link>
        </Button>
      </div>
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preset={{ type: "deposit" }}
      />
    </div>
  );
}
