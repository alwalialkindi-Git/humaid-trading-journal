import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  Coins,
  Eye,
  LayoutDashboard,
  PieChart,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation — single source of truth for the sidebar, the command palette,
 * and the mobile bottom tabs (AMANAH §12: one of each; no drift).
 *
 * Groups per the Council's final IA (§5). Notes:
 * - THINKING currently houses Journal + Calendar; the Research area (Inbox ·
 *   Theses · Journal) absorbs them at M5.5 — the group exists now so the
 *   mental model lands before the pages do.
 * - PURITY is the visually distinct Islamic spine; Watchlist merges into
 *   Screener at D5 (until then it lives in the group).
 * - Labels follow the constitution (Wealth, Screener, Insights); routes are
 *   unchanged — renames are label-level only.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** extra terms the command palette matches on */
  keywords?: string[];
}

export interface NavGroup {
  label: string | null;
  /** the Islamic spine gets its distinct treatment */
  purity?: boolean;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard, keywords: ["dashboard", "overview"] },
    ],
  },
  {
    label: "Wealth",
    items: [
      { href: "/portfolio", label: "Wealth", icon: PieChart, keywords: ["portfolio", "positions", "cash", "holdings", "history"] },
    ],
  },
  {
    label: "Thinking",
    items: [
      { href: "/trades", label: "Journal", icon: BookOpenText, keywords: ["trades", "research", "notes"] },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, keywords: ["days", "heatmap"] },
    ],
  },
  {
    label: "Purity",
    purity: true,
    items: [
      { href: "/zakat", label: "Zakat & Purify", icon: Coins, keywords: ["zakat", "purification", "nisab", "hawl"] },
      { href: "/shariah", label: "Screener", icon: ShieldCheck, keywords: ["shariah", "screening", "compliance", "halal"] },
      { href: "/watchlist", label: "Watchlist", icon: Eye, keywords: ["watch", "targets"] },
    ],
  },
  {
    label: "Understand",
    items: [
      { href: "/analytics", label: "Insights", icon: BarChart3, keywords: ["analytics", "performance", "charts"] },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", icon: Settings, keywords: ["profile", "brokers", "preferences"] }],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
