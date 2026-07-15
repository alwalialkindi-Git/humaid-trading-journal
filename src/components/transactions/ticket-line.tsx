"use client";

import { Figure } from "@/components/ui/figure";
import type { Ticket } from "@/lib/transactions/ticket";

/**
 * The ticket line (D3 — sprint §11): live summary above the dialog footer.
 * The user confirms a sentence, not a form; sells carry the engine P&L
 * preview as a signed Figure. The aria-live region exists even while empty
 * so the sentence is announced as it completes (§27, polite).
 */
export function TicketLine({ ticket }: { ticket: Ticket | null }) {
  return (
    <div aria-live="polite">
      {ticket && (
        <p className="figure-sm rounded-md border bg-surface-sunken px-3 py-2 text-sm">
          {ticket.body}
          {ticket.pnl != null && (
            <span className="whitespace-nowrap">
              {" · P&L "}
              <Figure value={ticket.pnl} kind="delta" currency={ticket.currency} size="sm" />
            </span>
          )}
        </p>
      )}
    </div>
  );
}
