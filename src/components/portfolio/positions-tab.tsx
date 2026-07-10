"use client";

import { useMemo, useState } from "react";
import { Briefcase, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HoldingView, TransactionRow } from "@/lib/services";
import type { TransactionType } from "@/lib/engine/positions";
import { setManualPriceAction } from "@/app/(app)/portfolio/actions";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldBadge } from "@/components/ui/shield-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/app/empty-state";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import {
  formatDate,
  formatNumber,
  formatSignedCurrency,
  isStalePrice,
  pnlColor,
} from "@/lib/format";

// Compliance renders via the shield grammar (D1b): shape + label, never
// color alone. ShieldBadge owns the closed state set.

export function PositionsTab({
  holdings,
  transactions,
  hasAnyTransactions,
}: {
  holdings: HoldingView[];
  transactions: TransactionRow[];
  hasAnyTransactions: boolean;
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

  return (
    <>
      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Unrealized</TableHead>
                <TableHead className="text-right">Realized</TableHead>
                <TableHead className="text-right">Alloc</TableHead>
                <TableHead>Shariah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((h) => (
                <TableRow
                  key={h.asset.id}
                  className="cursor-pointer"
                  onClick={() => setDrawerAssetId(h.asset.id)}
                >
                  <TableCell>
                    <button
                      className="text-left"
                      aria-label={`View ${h.asset.symbol} position details`}
                    >
                      <p className="font-medium">
                        {h.asset.symbol}
                        {h.price_is_manual && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            manual
                          </span>
                        )}
                      </p>
                      <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {h.asset.name} · {h.asset.exchange || "private"}
                      </p>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(h.quantity, 4)}</TableCell>
                  <TableCell className="text-right">{formatNumber(h.average_cost, 4)}</TableCell>
                  <TableCell className="text-right">
                    {h.effective_price != null ? (
                      <PriceCell holding={h} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {h.market_value != null
                      ? `${formatNumber(h.market_value)} ${h.asset.currency}`
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      h.unrealized_pnl != null ? pnlColor(h.unrealized_pnl) : "text-muted-foreground"
                    )}
                  >
                    {h.unrealized_pnl != null ? (
                      <>
                        {formatSignedCurrency(h.unrealized_pnl, h.asset.currency)}
                        <span className="block text-xs">
                          {h.unrealized_pnl_percent != null
                            ? `${h.unrealized_pnl_percent >= 0 ? "+" : ""}${h.unrealized_pnl_percent}%`
                            : ""}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right", pnlColor(h.realized_pnl))}>
                    {formatSignedCurrency(h.realized_pnl, h.asset.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {h.allocation_percent != null ? `${h.allocation_percent}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <ShieldBadge
                      state={h.shariah_status}
                      overridden={h.shariah_is_override}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {closed.length > 0 && (
            <button
              onClick={() => setShowClosed((v) => !v)}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground"
            >
              {showClosed ? "Hide" : "Show"} closed positions ({closed.length})
            </button>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {visible.map((h) => (
          <button
            key={h.asset.id}
            onClick={() => setDrawerAssetId(h.asset.id)}
            className="w-full rounded-xl border bg-card p-4 text-left"
            aria-label={`View ${h.asset.symbol} position details`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {h.asset.symbol}
                {h.price_is_manual && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    manual
                  </span>
                )}
              </p>
              <ShieldBadge
                state={h.shariah_status}
                overridden={h.shariah_is_override}
              />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-xs text-muted-foreground">
                {formatNumber(h.quantity, 4)} @ {formatNumber(h.average_cost, 4)} avg
              </p>
              <div className="text-right">
                <p className="font-semibold">
                  {h.market_value != null
                    ? `${formatNumber(h.market_value)} ${h.asset.currency}`
                    : "unpriced"}
                </p>
                {h.unrealized_pnl != null && (
                  <p className={cn("text-xs", pnlColor(h.unrealized_pnl))}>
                    {formatSignedCurrency(h.unrealized_pnl, h.asset.currency)}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
        {closed.length > 0 && (
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="text-sm text-muted-foreground"
          >
            {showClosed ? "Hide" : "Show"} closed positions ({closed.length})
          </button>
        )}
      </div>

      {/* Position detail drawer */}
      <Sheet open={drawerHolding !== null} onOpenChange={(o) => !o && setDrawerAssetId(null)}>
        {drawerHolding && (
          <SheetContent title={`${drawerHolding.asset.symbol} — ${drawerHolding.asset.name}`}>
            <PositionDetail
              holding={drawerHolding}
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

function PriceCell({ holding: h }: { holding: HoldingView }) {
  const stale = isStalePrice(h.price_as_of);
  return (
    <span className={cn(stale && "text-amber-700")} title={h.price_as_of ?? undefined}>
      {formatNumber(h.effective_price!, 4)}
      {stale && <span className="block text-[10px]">stale</span>}
    </span>
  );
}

function PositionDetail({
  holding: h,
  transactions,
  onAct,
}: {
  holding: HoldingView;
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

  const stats: [string, string][] = [
    ["Quantity", formatNumber(h.quantity, 4)],
    ["Average cost", formatNumber(h.average_cost, 4)],
    ["Cost basis", `${formatNumber(h.cost_basis)} ${h.asset.currency}`],
    [
      "Price",
      h.effective_price != null
        ? `${formatNumber(h.effective_price, 4)}${h.price_is_manual ? " (manual)" : ""}`
        : "unpriced",
    ],
    ["Market value", h.market_value != null ? formatNumber(h.market_value) : "—"],
    [
      "Unrealized P&L",
      h.unrealized_pnl != null
        ? formatSignedCurrency(h.unrealized_pnl, h.asset.currency)
        : "—",
    ],
    ["Realized P&L", formatSignedCurrency(h.realized_pnl, h.asset.currency)],
    ["Dividends", `${formatNumber(h.dividends_received)} ${h.asset.currency}`],
  ];

  async function savePrice() {
    setBusy(true);
    const res = await setManualPriceAction(h.asset.id, Number(priceValue));
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(`${h.asset.symbol} price updated.`);
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>

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

      <div>
        <p className="mb-2 text-sm font-semibold">Transaction history (replay order)</p>
        <ul className="space-y-1.5">
          {replay.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>
                <Badge variant={t.type === "buy" ? "success" : t.type === "sell" ? "warning" : "neutral"}>
                  {t.type}
                </Badge>
                <span className="ml-2 text-muted-foreground">{formatDate(t.trade_date)}</span>
              </span>
              <span className="text-right">
                {t.type === "dividend"
                  ? `+${formatNumber(t.amount ?? 0)} ${t.currency}`
                  : `${formatNumber(t.quantity ?? 0, 4)} @ ${formatNumber(t.price ?? 0, 4)}`}
                {t.type === "sell" && t.realized_pnl != null && (
                  <span className={cn("block text-xs", pnlColor(t.realized_pnl))}>
                    {formatSignedCurrency(t.realized_pnl, t.currency)}
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
