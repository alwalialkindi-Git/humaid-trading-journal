/**
 * Domain types mirroring the Supabase schema (supabase/schema.sql).
 */

export type AssetType = "stock" | "etf" | "crypto" | "sukuk" | "cash" | "other";
export type TradeSide = "buy" | "sell";
export type TradeStatus = "open" | "closed";
export type Emotion =
  | "confident"
  | "fearful"
  | "greedy"
  | "patient"
  | "rushed"
  | "neutral";
export type ComplianceStatus =
  | "compliant"
  | "doubtful"
  | "non_compliant"
  | "not_reviewed";
export type RiskLevel = "low" | "medium" | "high";
export type NisabMethod = "gold" | "silver";

export const MISTAKES = [
  "fomo",
  "revenge_trade",
  "over_position",
  "no_plan",
  "ignored_stop_loss",
  "exited_too_early",
  "held_loser_too_long",
] as const;
export type Mistake = (typeof MISTAKES)[number];

export const MISTAKE_LABELS: Record<Mistake, string> = {
  fomo: "FOMO",
  revenge_trade: "Revenge trade",
  over_position: "Over-position",
  no_plan: "No plan",
  ignored_stop_loss: "Ignored stop loss",
  exited_too_early: "Exited too early",
  held_loser_too_long: "Held loser too long",
};

export const EMOTIONS: Emotion[] = [
  "confident",
  "fearful",
  "greedy",
  "patient",
  "rushed",
  "neutral",
];

export const ASSET_TYPES: AssetType[] = [
  "stock",
  "etf",
  "crypto",
  "sukuk",
  "cash",
  "other",
];

export const WARNING_CATEGORIES = [
  "conventional_banking",
  "alcohol",
  "gambling",
  "pork",
  "adult_entertainment",
  "tobacco",
  "weapons",
  "interest_based_income",
  "excessive_debt",
  "leverage_heavy_business",
  "uncertain_business_model",
] as const;
export type WarningCategory = (typeof WARNING_CATEGORIES)[number];

export const WARNING_LABELS: Record<WarningCategory, string> = {
  conventional_banking: "Conventional banking",
  alcohol: "Alcohol",
  gambling: "Gambling",
  pork: "Pork",
  adult_entertainment: "Adult entertainment",
  tobacco: "Tobacco",
  weapons: "Weapons",
  interest_based_income: "Interest-based income",
  excessive_debt: "Excessive debt",
  leverage_heavy_business: "Leverage-heavy business",
  uncertain_business_model: "Uncertain business model",
};

export interface Profile {
  id: string;
  full_name: string | null;
  currency: string;
  cash_balance: number;
  nisab_method: NisabMethod;
  risk_preference: RiskLevel;
  screening_preference: string;
  hawl_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: string | null;
  asset_type: AssetType;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  current_price: number | null;
  fees: number;
  entry_date: string;
  exit_date: string | null;
  strategy: string | null;
  setup_quality: number | null;
  trade_status: TradeStatus;
  notes: string | null;
  tags: string[];
  emotion: Emotion | null;
  mistakes: string[];
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: string | null;
  sector: string | null;
  asset_type: AssetType;
  quantity: number;
  average_cost: number;
  current_price: number;
  shariah_status: ComplianceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dividend {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  amount: number;
  payment_date: string;
  purification_percentage: number;
  notes: string | null;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: string | null;
  target_price: number | null;
  current_price: number | null;
  shariah_status: ComplianceStatus;
  risk_level: RiskLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShariahScreening {
  id: string;
  user_id: string;
  symbol: string;
  asset_name: string | null;
  market: string | null;
  business_activity: string | null;
  compliance_status: ComplianceStatus;
  debt_ratio: number | null;
  interest_income_ratio: number | null;
  cash_and_receivables_ratio: number | null;
  purification_percentage: number | null;
  screening_source: string | null;
  last_reviewed_date: string | null;
  warning_categories: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZakatRecord {
  id: string;
  user_id: string;
  hawl_date: string;
  nisab_method: NisabMethod;
  gold_price_per_gram: number;
  silver_price_per_gram: number;
  cash_at_home: number;
  bank_cash: number;
  trading_cash: number;
  compliant_stock_value: number;
  doubtful_stock_value: number;
  dividends_received: number;
  gold_value: number;
  silver_value: number;
  business_inventory: number;
  receivables: number;
  immediate_debts: number;
  zakatable_total: number;
  nisab_threshold: number;
  zakat_due: number;
  purification_amount: number;
  notes: string | null;
  created_at: string;
}

export interface JournalNote {
  id: string;
  user_id: string;
  note_date: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}
