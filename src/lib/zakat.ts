import type { NisabMethod } from "./types";

/**
 * Zakat math. Standard fiqh constants:
 * - Nisab (gold): 85 grams of gold
 * - Nisab (silver): 595 grams of silver
 * - Zakat rate: 2.5% of zakatable wealth once nisab is reached and one hawl
 *   (lunar year) has passed.
 */
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;
export const ZAKAT_RATE = 0.025;

export interface ZakatInputs {
  cashAtHome: number;
  bankCash: number;
  tradingCash: number;
  compliantStockValue: number;
  doubtfulStockValue: number; // only the portion the user chooses to include
  dividendsReceived: number;
  goldValue: number;
  silverValue: number;
  businessInventory: number;
  receivables: number;
  immediateDebts: number;
  nisabMethod: NisabMethod;
  goldPricePerGram: number;
  silverPricePerGram: number;
}

export interface ZakatResult {
  zakatableAssets: number;
  nisabThreshold: number;
  isDue: boolean;
  zakatDue: number;
  breakdown: { label: string; value: number }[];
}

export function computeZakat(inputs: ZakatInputs): ZakatResult {
  const breakdown = [
    { label: "Cash at home", value: inputs.cashAtHome },
    { label: "Bank cash", value: inputs.bankCash },
    { label: "Trading account cash", value: inputs.tradingCash },
    { label: "Compliant stocks (market value)", value: inputs.compliantStockValue },
    { label: "Doubtful stocks included", value: inputs.doubtfulStockValue },
    { label: "Dividends received", value: inputs.dividendsReceived },
    { label: "Gold value", value: inputs.goldValue },
    { label: "Silver value", value: inputs.silverValue },
    { label: "Business inventory", value: inputs.businessInventory },
    { label: "Receivables expected", value: inputs.receivables },
    { label: "Immediate debts due", value: -inputs.immediateDebts },
  ];

  const zakatableAssets = Math.max(
    0,
    breakdown.reduce((s, item) => s + item.value, 0)
  );

  const nisabThreshold =
    inputs.nisabMethod === "gold"
      ? NISAB_GOLD_GRAMS * inputs.goldPricePerGram
      : NISAB_SILVER_GRAMS * inputs.silverPricePerGram;

  const isDue = nisabThreshold > 0 && zakatableAssets >= nisabThreshold;

  return {
    zakatableAssets,
    nisabThreshold,
    isDue,
    zakatDue: isDue ? zakatableAssets * ZAKAT_RATE : 0,
    breakdown,
  };
}

/**
 * Purification: for income mixed with a small impermissible portion
 * (e.g. a company's interest income), the impure share of dividends/gains
 * is given away in charity — separate from zakat.
 */
export function computePurification(
  dividendsOrGains: number,
  purificationPercentage: number
): number {
  return Math.max(0, dividendsOrGains * (purificationPercentage / 100));
}
