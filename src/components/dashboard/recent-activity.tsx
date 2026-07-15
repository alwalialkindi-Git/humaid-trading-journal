import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney, formatQuantity, formatUnitPrice } from "@/lib/amanah/number";
import type { TransactionRow } from "@/lib/services";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Figure } from "@/components/ui/figure";

/**
 * Recent activity (D4, §9.5): the latest 5 ledger rows in the D2 timeline
 * language — type glyph, entity, date, figure. Sacred payment types carry
 * the brass ◆, an act of worship inside the money list (§14).
 */

const TYPE_GLYPH: Record<string, string> = {
  buy: "B",
  sell: "S",
  dividend: "D",
  deposit: "+",
  withdrawal: "−",
  fee: "F",
  adjustment: "A",
  transfer_in: "→",
  transfer_out: "←",
  split: "÷",
};

const SACRED_TYPES = new Set(["zakat_payment", "purification_payment"]);

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function RecentActivity({
  transactions,
  symbolByAsset,
}: {
  /** Already sorted newest-first and capped at 5 by the page. */
  transactions: TransactionRow[];
  symbolByAsset: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Your latest ledger entries</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portfolio?tab=activity">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {transactions.map((t) => {
            const sacred = SACRED_TYPES.has(t.type);
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                    sacred
                      ? "bg-sacred-surface text-sacred"
                      : "bg-surface-sunken text-ink-muted"
                  )}
                >
                  {sacred ? "◆" : (TYPE_GLYPH[t.type] ?? "·")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("font-medium capitalize", sacred && "text-sacred")}>
                    {typeLabel(t.type)}
                  </span>
                  <span className="ml-2">
                    {t.asset_id ? (symbolByAsset[t.asset_id] ?? "—") : "Cash"}
                  </span>
                  <span className="ml-2 text-xs text-ink-faint">
                    {formatDate(t.trade_date)}
                  </span>
                </span>
                <span className="text-right">
                  {t.quantity != null && t.price != null ? (
                    <span className="figure-sm">
                      {formatQuantity(t.quantity)} @ {formatUnitPrice(t.price)}{" "}
                      <span className="text-[10px] text-ink-faint">{t.currency}</span>
                    </span>
                  ) : t.amount != null ? (
                    <span className="figure-sm">{formatMoney(t.amount, t.currency)}</span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                  {t.realized_pnl != null && (
                    <span className="block">
                      <Figure value={t.realized_pnl} kind="delta" size="sm" />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
