import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrokerRow, CashStatementView } from "@/lib/services";
import type { TransactionType } from "@/lib/engine/positions";
import type { AssetLabel } from "@/components/portfolio/history-table";
import { formatDate, titleCase } from "@/lib/format";
import { formatDeltaMoney, formatMoney } from "@/lib/amanah/number";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

/**
 * Cash statement (D2, sprint §10/§14): per-currency sections — opening →
 * signed events with RUNNING BALANCE → closing. Monthly group headers.
 * Zakat/purification payments render with the sacred accent — visible acts
 * of worship inside the money statement (§14). Negative balances are shown
 * in the pnl-down tone; the page-level notice carries the standing actions.
 */

const SACRED_TYPES: ReadonlySet<TransactionType> = new Set([
  "zakat_payment",
  "purification_payment",
]);

function monthLabel(tradeDate: string): string {
  const d = new Date(tradeDate);
  if (Number.isNaN(d.getTime())) return tradeDate;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function eventLabel(
  type: TransactionType,
  assetId: string | null,
  assetLabels: Record<string, AssetLabel>
): string {
  const sym = assetId ? assetLabels[assetId]?.symbol : null;
  const base = titleCase(type);
  return sym ? `${base} — ${sym}` : base;
}

export function CashStatement({
  statements,
  assetLabels,
  brokers,
}: {
  statements: CashStatementView[];
  assetLabels: Record<string, AssetLabel>;
  brokers: BrokerRow[];
}) {
  if (statements.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Your cash statement"
        description="Record a deposit to open the statement — every buy, sell, dividend, and payment will carry a running balance."
      />
    );
  }

  const brokerName = new Map(brokers.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-5">
      {statements.map((s) => (
        <Card key={s.currency}>
          <CardContent className="p-0">
            {/* Section header */}
            <div className="flex items-baseline justify-between border-b bg-surface-sunken px-4 py-2.5">
              <p className="text-sm font-semibold">{s.currency}</p>
              <p className="figure-sm text-ink-muted">
                Closing{" "}
                <span className={cn("figure-md", s.closing < 0 && "text-pnl-down")}>
                  {formatMoney(s.closing, s.currency)}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2 text-xs text-ink-muted" colSpan={3}>
                      Opening balance
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="figure-md">{formatMoney(s.opening, s.currency)}</span>
                    </td>
                  </tr>
                  {s.events.map((e, i) => {
                    const label = monthLabel(e.trade_date);
                    const prev = i > 0 ? monthLabel(s.events[i - 1].trade_date) : null;
                    const sacred = SACRED_TYPES.has(e.type);
                    return (
                      <FragmentRow key={e.transaction_id} showGroup={label !== prev} label={label}>
                        <td className="w-24 whitespace-nowrap px-4 py-2 text-xs text-ink-muted">
                          {formatDate(e.trade_date)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn("text-sm", sacred && "font-medium text-sacred")}>
                            {sacred && (
                              <span aria-hidden className="mr-1.5">
                                ◆
                              </span>
                            )}
                            {eventLabel(e.type, e.asset_id, assetLabels)}
                          </span>
                          {e.notes && (
                            <span className="ml-2 text-xs text-ink-faint">· {e.notes}</span>
                          )}
                        </td>
                        <td className="w-32 px-4 py-2 text-xs text-ink-faint">
                          {e.broker_id ? brokerName.get(e.broker_id) ?? "" : ""}
                        </td>
                        <td className="w-56 whitespace-nowrap px-4 py-2 text-right">
                          <span
                            className={cn(
                              "figure-md",
                              e.amount_signed > 0
                                ? "text-pnl-up"
                                : e.amount_signed < 0
                                  ? "text-pnl-down"
                                  : "text-ink-muted"
                            )}
                          >
                            {formatDeltaMoney(e.amount_signed)}
                          </span>
                          <span
                            className={cn(
                              "figure-sm ml-4 inline-block w-24 text-ink-muted",
                              e.balance_after < 0 && "text-pnl-down"
                            )}
                          >
                            {formatDeltaMoney(e.balance_after).replace(/^\+/, "")}
                          </span>
                        </td>
                      </FragmentRow>
                    );
                  })}
                  <tr className="bg-surface-sunken">
                    <td className="px-4 py-2.5 text-xs font-medium text-ink-muted" colSpan={3}>
                      Closing balance
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={cn(
                          "figure-md font-semibold",
                          s.closing < 0 && "text-pnl-down"
                        )}
                      >
                        {formatMoney(s.closing, s.currency)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-ink-muted">
        Signed amounts follow the ledger: buys capitalize fees (D-013); sells are net of
        fees; the running balance is the engine&apos;s arithmetic, event by event.
      </p>
    </div>
  );
}

/** Table row with an optional month group header before it. */
function FragmentRow({
  showGroup,
  label,
  children,
}: {
  showGroup: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {showGroup && (
        <tr className="border-b bg-surface-sunken/60">
          <td
            colSpan={4}
            className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
          >
            {label}
          </td>
        </tr>
      )}
      <tr className="border-b last:border-0">{children}</tr>
    </>
  );
}
