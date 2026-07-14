import { Landmark } from "lucide-react";
import Link from "next/link";
import type { BrokerRow, TransactionRow } from "@/lib/services";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

/**
 * Accounts tab (D2, sprint §10/§13) — one card per broker account. Figures
 * shown are LEDGER FACTS derivable today: recorded activity per account.
 * Per-account holdings/cash require broker-attributed reconciliation (M4) —
 * stated honestly rather than approximated (D-009).
 */

interface AccountFacts {
  transactions: number;
  lastActivity: string | null;
  currencies: string[];
}

function factsByBroker(transactions: TransactionRow[]): Map<string, AccountFacts> {
  const map = new Map<string, AccountFacts>();
  for (const t of transactions) {
    if (!t.broker_id) continue;
    const f = map.get(t.broker_id) ?? {
      transactions: 0,
      lastActivity: null,
      currencies: [],
    };
    f.transactions += 1;
    if (!f.lastActivity || t.trade_date > f.lastActivity) f.lastActivity = t.trade_date;
    const c = t.currency.toUpperCase();
    if (!f.currencies.includes(c)) f.currencies.push(c);
    map.set(t.broker_id, f);
  }
  return map;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function maskedAccount(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  const tail = accountNumber.replace(/\s/g, "").slice(-4);
  return `··${tail}`;
}

export function AccountsTab({
  brokers,
  transactions,
}: {
  brokers: BrokerRow[];
  transactions: TransactionRow[];
}) {
  if (brokers.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="Your accounts"
        description="Add the account you actually trade through — transactions carry its name, and statements will group by it."
      >
        <Link
          href="/settings"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Add account
        </Link>
      </EmptyState>
    );
  }

  const facts = factsByBroker(transactions);
  const unattributed = transactions.filter((t) => !t.broker_id).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {brokers.map((b) => {
          const f = facts.get(b.id);
          const masked = maskedAccount(b.account_number);
          return (
            <Card key={b.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-surface text-sm font-semibold text-brand"
                  >
                    {initials(b.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-ink-faint">
                      {[masked, b.account_currency, b.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-6">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      Recorded
                    </p>
                    <p className="figure-md">{f?.transactions ?? 0} transactions</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                      Last activity
                    </p>
                    <p className="figure-md">
                      {f?.lastActivity ? formatDate(f.lastActivity) : "—"}
                    </p>
                  </div>
                  {f && f.currencies.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                        Currencies
                      </p>
                      <p className="figure-md">{f.currencies.join(" · ")}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <Link
                    href={`/portfolio?tab=activity&broker=${b.id}`}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    View activity
                  </Link>
                  <Link
                    href="/settings"
                    className="text-xs text-ink-faint hover:text-foreground"
                  >
                    Edit
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-ink-muted">
        Per-account holdings and cash arrive with broker import &amp; reconciliation (M4)
        — until then, accounts show recorded ledger facts only.
        {unattributed > 0 &&
          ` ${unattributed} transaction${unattributed > 1 ? "s" : ""} carry no account.`}
      </p>
    </div>
  );
}
