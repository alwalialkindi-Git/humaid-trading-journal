/**
 * TicketLine (D3 — sprint §11/§25): the live transaction summary. The user
 * confirms a sentence, not a form — "Buy 1,000 EMAAR @ 12.10 — 12,120.00 AED
 * incl. 20.00 AED fees · Personal / IBKR · 8 Jul". Pure module: the SAME
 * builder feeds the dialog's summary line and the success toast, so the two
 * can never disagree. All figures format through the AMANAH number system
 * (§4); sells carry the engine P&L preview.
 */

import {
  formatDeltaMoney,
  formatMoney,
  formatQuantity,
  formatUnitPrice,
} from "@/lib/amanah/number";

export interface TicketFacts {
  type: string;
  assetSymbol: string | null;
  /** Parsed numeric fields — null while the input is blank/invalid. */
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  currency: string;
  /** Calendar date "yyyy-mm-dd" (trade_date). */
  tradeDate: string;
  portfolioName: string | null;
  brokerName: string | null;
  /** Engine sell preview (previewSellRealizedPnl) — only carried for sells. */
  realizedPnl: number | null;
}

export interface Ticket {
  /** The sentence without the P&L part (the P&L renders as a signed Figure). */
  body: string;
  /** Realized P&L preview for sells; null otherwise. */
  pnl: number | null;
  currency: string;
  /** Full plain-text sentence — becomes the toast content on save (§11). */
  toast: string;
}

const VERB: Record<string, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
  deposit: "Deposit",
  withdrawal: "Withdraw",
  fee: "Fee",
  zakat_payment: "Zakat payment",
  purification_payment: "Purification",
};

/** "" / non-numeric → null; the ticket only speaks about entered figures. */
export function parseFigure(input: string): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ticket date: "8 Jul" (year appended only when it differs from the current
 * year). trade_date is a CALENDAR date — formatted in UTC like the Activity
 * month labels, never machine-local (§4.8 hydration rule).
 */
export function formatTicketDate(isoDate: string, now: number = Date.now()): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const sameYear = d.getUTCFullYear() === new Date(now).getUTCFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Build the ticket, or null while the draft is not yet a complete sentence.
 * Totals: buy = qty×price + fees ("incl. … fees"); sell = qty×price − fees
 * ("after … fees") — matching what the engine will record.
 */
export function buildTicketLine(
  f: TicketFacts,
  now: number = Date.now()
): Ticket | null {
  const verb = VERB[f.type];
  if (!verb || !f.currency || !f.tradeDate) return null;

  let body: string;
  if (f.type === "buy" || f.type === "sell") {
    if (
      !f.assetSymbol ||
      f.quantity == null ||
      !(f.quantity > 0) ||
      f.price == null ||
      f.price < 0
    ) {
      return null;
    }
    const gross = f.quantity * f.price;
    const total = f.type === "buy" ? gross + f.fees : gross - f.fees;
    body = `${verb} ${formatQuantity(f.quantity)} ${f.assetSymbol} @ ${formatUnitPrice(
      f.price
    )} — ${formatMoney(total, f.currency)}`;
    if (f.fees > 0) {
      body += ` ${f.type === "buy" ? "incl." : "after"} ${formatMoney(
        f.fees,
        f.currency
      )} fees`;
    }
  } else if (f.type === "dividend") {
    if (!f.assetSymbol || f.amount == null || !(f.amount > 0)) return null;
    body = `${verb} ${f.assetSymbol} — ${formatMoney(f.amount, f.currency)}`;
  } else {
    if (f.amount == null || !(f.amount > 0)) return null;
    body = `${verb} — ${formatMoney(f.amount, f.currency)}`;
  }

  if (f.portfolioName) {
    body += ` · ${f.portfolioName}${f.brokerName ? ` / ${f.brokerName}` : ""}`;
  }
  body += ` · ${formatTicketDate(f.tradeDate, now)}`;

  const pnl = f.type === "sell" ? f.realizedPnl : null;
  const toast =
    pnl != null
      ? `${body} · P&L ${formatDeltaMoney(pnl)} ${f.currency.toUpperCase()}`
      : body;
  return { body, pnl, currency: f.currency, toast };
}
