"use client";

import { useMemo, useState } from "react";
import { Briefcase, Pencil } from "lucide-react";
import type { HoldingView, TransactionRow } from "@/lib/services";
import type { TransactionType } from "@/lib/engine/positions";
import type { Provenance } from "@/lib/amanah/trust";
import { setManualPriceAction } from "@/app/(app)/portfolio/actions";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldBadge } from "@/components/ui/shield-badge";
import { Figure } from "@/components/ui/figure";
import { StatBlock } from "@/components/ui/stat-block";
import { FinTable, type FinColumn } from "@/components/ui/fin-table";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/app/empty-state";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { AllocationBar } from "@/components/portfolio/allocation-bar";
import {
  normalizeDisplayValues,
  sumByCurrency,
  type DisplayNormalized,
} from "@/lib/fin-table";
import { formatDate, isStalePrice } from "@/lib/format";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatUnitPrice,
} from "@/lib/amanah/number";

/**
 * Positions on the flagship FinTable (D2). Every financial figure renders
 * through the Figure primitive — provenance (source · as-of · actor ·
 * derivation) is one tap away on price and value (§4.11, CIO condition 3).
 * Compliance stays on the shield grammar. Mixed currencies are never summed:
 * the footer carries one Σ per currency.
 */

function priceProvenance(h: HoldingView): Provenance {
  if (h.price_is_manual) {
    return {
      state: "manual",
      source: "Manual entry",
      asOf: h.price_as_of ?? undefined,
      actor: "You",
    };
  }
  return {
    state: isStalePrice(h.price_as_of) ? "cached" : "live",
    source: h.asset.provider ? `Provider · ${h.asset.provider}` : "Provider",
    asOf: h.price_as_of ?? undefined,
  };
}

function valueProvenance(h: HoldingView): Provenance {
  return {
    state: "calculated",
    source: "Ledger engine",
    asOf: h.price_as_of ?? undefined,
    derivation: `${formatQuantity(h.quantity)} × ${
      h.effective_price != null ? formatUnitPrice(h.effective_price) : "—"
    }${h.price_is_manual ? " (manual price)" : ""}`,
  };
}

/** Stops row-level click/Enter so figure popovers don't open the drawer. */
function CellIsland({ children }: { children: React.ReactNode }) {
  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}

export function PositionsTab({
  holdings,
  transactions,
  hasAnyTransactions,
  displayCurrency,
}: {
  holdings: HoldingView[];
  transactions: TransactionRow[];
  hasAnyTransactions: boolean;
  displayCurrency: string;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const [drawerAssetId, setDrawerAssetId] = useState<string | null>(null);
  const [dialogPreset, setDialogPreset] = useState<{
    type: TransactionType;
    asset: { id: string; symbol: string; name: string; currency: string };
  } | null>(null);

  const open = holdings.filter((h) => h.quantity > 0);
  const closed = holdings.filter((h) => h.quantity === 0);
  const visible = showClosed ? [...open, ...closed] : open;
  const drawerHolding = holdings.find((h) => h.asset.id === drawerAssetId) ?? null;

  const valueTotals = useMemo(
    () =>
      sumByCurrency(
        open,
        (h) => h.market_value,
        (h) => h.asset.currency
      ),
    [open]
  );

  // ONE normalized base (display currency, §4.9) feeds the Weight column,
  // the drawer's Weight stat, cross-currency Value sorting, AND the
  // AllocationBar — identical percentages by construction.
  const normalized = useMemo(
    () =>
      normalizeDisplayValues(
        open,
        (h) => h.asset.id,
        (h) => h.market_value,
        (h) => h.asset.currency,
        displayCurrency
      ),
    [open, displayCurrency]
  );

  if (holdings.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title={hasAnyTransactions ? "Cash is in" : "Your ledger is empty"}
        description={
          hasAnyTransactions
            ? "When you buy, positions appear here — computed from your transactions."
            : "Record your first buy, or start with a cash deposit. Have history at a broker? You can backdate transactions today; imports arrive later."
        }
      />
    );
  }

  const figSize = (density: "comfortable" | "compact") =>
    density === "compact" ? ("sm" as const) : ("md" as const);

  const columns: FinColumn<HoldingView>[] = [
    {
      key: "asset",
      header: "Asset",
      type: "entity",
      sortValue: (h) => h.asset.symbol,
      footer: <span className="text-xs text-ink-muted">Σ Value (per currency)</span>,
      cell: (h) => (
        <span className="block">
          <span className="flex items-center gap-1.5 font-medium">
            {h.asset.symbol}
            {h.quantity === 0 && (
              <Badge variant="neutral" className="text-[10px]">
                closed
              </Badge>
            )}
          </span>
          <span className="block max-w-[220px] truncate text-xs text-ink-faint">
            {h.asset.name} · {h.asset.exchange || "private"}
          </span>
        </span>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      type: "quantity",
      sortValue: (h) => h.quantity,
      cell: (h, ctx) => <Figure value={h.quantity} kind="quantity" size={figSize(ctx.density)} />,
    },
    {
      key: "avg",
      header: "Avg cost",
      type: "unit-price",
      hideCompact: true,
      sortValue: (h) => h.average_cost,
      cell: (h, ctx) => (
        <Figure value={h.average_cost} kind="price" size={figSize(ctx.density)} />
      ),
    },
    {
      key: "price",
      header: "Price",
      type: "unit-price",
      sortValue: (h) => h.effective_price,
      cell: (h, ctx) =>
        h.effective_price != null ? (
          <CellIsland>
            <Figure
              value={h.effective_price}
              kind="price"
              size={figSize(ctx.density)}
              provenance={priceProvenance(h)}
            />
          </CellIsland>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "value",
      header: "Value",
      type: "money",
      // Sort on the FX-normalized display value — never on raw native
      // figures across currencies. Unpriced/no-rate stay null → last.
      sortValue: (h) => normalized.get(h.asset.id)?.displayValue ?? null,
      footer: (
        <span className="space-x-3">
          {valueTotals.map((t) => (
            <Figure key={t.currency} value={t.total} currency={t.currency} size="sm" />
          ))}
        </span>
      ),
      cell: (h, ctx) =>
        h.market_value != null ? (
          <CellIsland>
            <Figure
              value={h.market_value}
              currency={h.asset.currency}
              size={figSize(ctx.density)}
              provenance={valueProvenance(h)}
            />
          </CellIsland>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "unrealized",
      header: "Unrealized",
      type: "delta",
      sortValue: (h) => h.unrealized_pnl,
      cell: (h, ctx) =>
        h.unrealized_pnl != null ? (
          <span className="block">
            <Figure value={h.unrealized_pnl} kind="delta" size={figSize(ctx.density)} />
            {h.unrealized_pnl_percent != null && ctx.density === "comfortable" && (
              <span className="block text-xs text-ink-faint">
                {formatPercent(h.unrealized_pnl_percent, { delta: true })}
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "realized",
      header: "Realized",
      type: "delta",
      hideCompact: true,
      sortValue: (h) => h.realized_pnl,
      cell: (h, ctx) => (
        <Figure value={h.realized_pnl} kind="delta" size={figSize(ctx.density)} />
      ),
    },
    {
      key: "alloc",
      header: "Weight",
      type: "percent",
      hideCompact: true,
      sortValue: (h) => normalized.get(h.asset.id)?.weightPercent ?? null,
      cell: (h) => {
        const weight = normalized.get(h.asset.id)?.weightPercent;
        return weight != null ? (
          <span className="figure-sm">{formatPercent(weight)}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        );
      },
    },
    {
      key: "shield",
      header: "Screening",
      type: "badge",
      cell: (h) => (
        <ShieldBadge state={h.shariah_status} overridden={h.shariah_is_override} />
      ),
    },
  ];

  return (
    <>
      <AllocationBar
        holdings={open}
        normalized={normalized}
        displayCurrency={displayCurrency}
        className="mb-5"
      />

      <FinTable
        tableId="positions"
        columns={columns}
        rows={visible}
        rowKey={(h) => h.asset.id}
        defaultSort={{ key: "value", dir: "desc" }}
        onRowClick={(h) => setDrawerAssetId(h.asset.id)}
        rowAriaLabel={(h) => `View ${h.asset.symbol} position details`}
        toolbar={
          closed.length > 0 ? (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="text-sm text-ink-muted hover:text-foreground"
            >
              {showClosed ? "Hide" : "Show"} closed positions ({closed.length})
            </button>
          ) : undefined
        }
        mobileCard={(h) => (
          <button
            onClick={() => setDrawerAssetId(h.asset.id)}
            className="w-full rounded-lg border bg-card p-4 text-left"
            aria-label={`View ${h.asset.symbol} position details`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{h.asset.symbol}</p>
              <ShieldBadge state={h.shariah_status} overridden={h.shariah_is_override} />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-xs text-ink-muted">
                {formatQuantity(h.quantity)} @{" "}
                {h.effective_price != null ? formatUnitPrice(h.effective_price) : "—"}
                {h.price_is_manual && " · manual"}
              </p>
              <div className="text-right">
                {/* Primary figure of the card transform: market value (§5) */}
                {h.market_value != null ? (
                  <Figure value={h.market_value} currency={h.asset.currency} size="md" />
                ) : (
                  <p className="text-sm text-ink-faint">unpriced</p>
                )}
                {h.unrealized_pnl != null && (
                  <Figure value={h.unrealized_pnl} kind="delta" size="sm" />
                )}
              </div>
            </div>
          </button>
        )}
      />

      {/* Position detail drawer — three zones (sprint §12) */}
      <Sheet open={drawerHolding !== null} onOpenChange={(o) => !o && setDrawerAssetId(null)}>
        {drawerHolding && (
          <SheetContent title={`${drawerHolding.asset.symbol} — ${drawerHolding.asset.name}`}>
            <PositionDetail
              holding={drawerHolding}
              normalized={normalized.get(drawerHolding.asset.id) ?? null}
              transactions={transactions.filter((t) => t.asset_id === drawerHolding.asset.id)}
              onAct={(type) => {
                setDialogPreset({
                  type,
                  asset: {
                    id: drawerHolding.asset.id,
                    symbol: drawerHolding.asset.symbol,
                    name: drawerHolding.asset.name,
                    currency: drawerHolding.asset.currency,
                  },
                });
                setDrawerAssetId(null);
              }}
            />
          </SheetContent>
        )}
      </Sheet>

      {dialogPreset && (
        <TransactionDialog
          open={dialogPreset !== null}
          onOpenChange={(o) => !o && setDialogPreset(null)}
          preset={dialogPreset}
        />
      )}
    </>
  );
}

const TYPE_GLYPH: Record<string, string> = {
  buy: "B",
  sell: "S",
  dividend: "D",
  deposit: "+",
  withdrawal: "−",
  adjustment: "A",
  transfer_in: "→",
  transfer_out: "←",
};

function PositionDetail({
  holding: h,
  normalized,
  transactions,
  onAct,
}: {
  holding: HoldingView;
  normalized: DisplayNormalized | null;
  transactions: TransactionRow[];
  onAct: (type: TransactionType) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState(
    h.effective_price != null ? String(h.effective_price) : ""
  );
  const [busy, setBusy] = useState(false);

  async function savePrice() {
    setBusy(true);
    const res = await setManualPriceAction(h.asset.id, Number(priceValue));
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(`Updated — ${h.asset.symbol} price recorded.`);
    setEditingPrice(false);
    router.refresh();
  }

  const replay = useMemo(
    () =>
      [...transactions].sort((a, b) =>
        a.trade_date === b.trade_date
          ? a.created_at.localeCompare(b.created_at)
          : a.trade_date.localeCompare(b.trade_date)
      ),
    [transactions]
  );

  return (
    <div className="space-y-5 p-5">
      {/* Zone 1 — identity */}
      <div className="space-y-1.5 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-semibold">{h.asset.symbol}</p>
          <Badge variant="neutral" className="text-[10px]">
            {h.asset.data_tier.replace("_", " ")}
          </Badge>
          <ShieldBadge state={h.shariah_status} overridden={h.shariah_is_override} />
        </div>
        <p className="text-xs text-ink-muted">
          {h.asset.name} · {h.asset.exchange || "private"} · {h.asset.currency}
        </p>
        {h.effective_price != null ? (
          <Figure
            value={h.effective_price}
            kind="price"
            size="lg"
            provenance={priceProvenance(h)}
          />
        ) : (
          <p className="text-sm text-ink-faint">Unpriced — set a manual price below.</p>
        )}
      </div>

      {/* Zone 2 — position figures */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <StatBlock
          label="Value"
          figure={
            h.market_value != null
              ? {
                  value: h.market_value,
                  currency: h.asset.currency,
                  provenance: valueProvenance(h),
                }
              : { value: 0, kind: "quantity" }
          }
          secondary={h.market_value == null ? "unpriced — excluded from totals" : undefined}
        />
        <StatBlock
          label="Unrealized P&L"
          figure={
            h.unrealized_pnl != null
              ? { value: h.unrealized_pnl, kind: "delta" }
              : { value: 0, kind: "quantity" }
          }
          secondary={
            h.unrealized_pnl_percent != null
              ? formatPercent(h.unrealized_pnl_percent, { delta: true })
              : h.unrealized_pnl == null
                ? "unpriced"
                : undefined
          }
        />
        <StatBlock label="Realized P&L" figure={{ value: h.realized_pnl, kind: "delta" }} />
        <StatBlock
          label="Income"
          figure={{ value: h.dividends_received, currency: h.asset.currency }}
        />
        <StatBlock label="Quantity" figure={{ value: h.quantity, kind: "quantity" }} />
        <StatBlock label="Avg cost" figure={{ value: h.average_cost, kind: "price" }} />
        <StatBlock
          label="Cost basis"
          figure={{ value: h.cost_basis, currency: h.asset.currency }}
        />
        <StatBlock
          label="Weight"
          figure={{ value: normalized?.weightPercent ?? 0, kind: "percent" }}
          secondary={
            normalized?.weightPercent == null
              ? normalized?.noRate
                ? "no FX rate"
                : "unpriced"
              : undefined
          }
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button size="sm" onClick={() => onAct("buy")}>
          Buy more
        </Button>
        {h.quantity > 0 && (
          <Button size="sm" variant="outline" onClick={() => onAct("sell")}>
            Sell
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onAct("dividend")}>
          Dividend
        </Button>
        {h.asset.data_tier === "manual_custom" && !editingPrice && (
          <Button size="sm" variant="ghost" onClick={() => setEditingPrice(true)}>
            <Pencil className="h-3.5 w-3.5" /> Set price
          </Button>
        )}
      </div>

      {editingPrice && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            className="max-w-[140px]"
            aria-label="Manual price"
          />
          <Button size="sm" onClick={savePrice} disabled={busy}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingPrice(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Zone 3 — ledger timeline (replay order) */}
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Ledger — replay order
        </p>
        <ul className="space-y-1.5">
          {replay.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-xs font-semibold text-ink-muted"
              >
                {TYPE_GLYPH[t.type] ?? "·"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium capitalize">{t.type.replace("_", " ")}</span>
                <span className="ml-2 text-xs text-ink-faint">{formatDate(t.trade_date)}</span>
                {t.fees > 0 && (
                  <span className="ml-2 text-xs text-ink-faint">
                    · fees {formatMoney(t.fees, t.currency)}
                  </span>
                )}
              </span>
              <span className="text-right">
                {t.type === "dividend" ? (
                  <Figure value={t.amount ?? 0} kind="delta" size="sm" />
                ) : (
                  <span className="figure-sm">
                    {formatQuantity(t.quantity ?? 0)} @ {formatUnitPrice(t.price ?? 0)}
                  </span>
                )}
                {t.type === "sell" && t.realized_pnl != null && (
                  <span className="block">
                    <Figure value={t.realized_pnl} kind="delta" size="sm" />
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
