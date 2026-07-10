/**
 * Glossary registry (D1b) — the single home for financial and fiqh term
 * definitions (Council §1.3: one registry, not scattered helper text).
 * The beginner layer AND the future translation surface: definitions live
 * here only; components render them via <GlossaryTerm>.
 *
 * Register: plain, precise, respectful (AMANAH §2). No exclamation marks.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY = {
  average_cost: {
    term: "Average cost",
    definition:
      "Total amount paid for the units you still hold (including buy fees), divided by the quantity held. Selling does not change it; buying at a different price does.",
  },
  cost_basis: {
    term: "Cost basis",
    definition:
      "What your current holding actually cost you: quantity held × average cost. Unrealized profit or loss is measured against this.",
  },
  realized_pnl: {
    term: "Realized P&L",
    definition:
      "Profit or loss locked in by selling: sale proceeds minus fees minus the average cost of the units sold.",
  },
  unrealized_pnl: {
    term: "Unrealized P&L",
    definition:
      "The difference between a holding's market value and its cost basis. It changes with the price and becomes realized only when you sell.",
  },
  hawl: {
    term: "Hawl",
    definition:
      "One full lunar year of continuous ownership above the nisab threshold — the condition for zakat becoming due on wealth.",
  },
  nisab: {
    term: "Nisab",
    definition:
      "The minimum wealth at which zakat applies, defined by the value of 85g of gold or 595g of silver. Below it, no zakat is due.",
  },
  zakat: {
    term: "Zakat",
    definition:
      "The obligatory annual payment of 2.5% on qualifying wealth held above nisab for a hawl — a pillar of Islam, owed to defined recipients.",
  },
  purification: {
    term: "Purification",
    definition:
      "Giving away the portion of income that came from impermissible sources (such as a company's interest income). Separate from zakat, and not deductible from it.",
  },
  screening: {
    term: "Shariah screening",
    definition:
      "Assessing whether an investment meets Islamic criteria: what the business does, and financial ratios such as debt and interest income against scholarly thresholds.",
  },
  compliance_override: {
    term: "Override",
    definition:
      "Your own ruling recorded over the platform's data, with your reason — for example, following your scholar's position. Overrides are always visibly marked.",
  },
  provenance: {
    term: "Provenance",
    definition:
      "Where a number came from: its source, its timestamp, who recorded it, and how it was computed. Every figure here can answer those questions.",
  },
  drawdown: {
    term: "Drawdown",
    definition:
      "The largest peak-to-trough fall in value over a period — a measure of the worst decline you would have sat through.",
  },
  profit_factor: {
    term: "Profit factor",
    definition:
      "Gross profits divided by gross losses across closed trades. Above 1 means winners outweigh losers in money terms.",
  },
  sukuk: {
    term: "Sukuk",
    definition:
      "Shariah-structured certificates representing ownership in assets or ventures — income comes from the underlying assets, not interest on debt.",
  },
  allocation: {
    term: "Allocation",
    definition:
      "How your wealth is divided — across assets, classes, accounts, or currencies — expressed as each part's share of the priced total.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
