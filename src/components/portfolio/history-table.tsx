"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrokerRow, TransactionRow } from "@/lib/services";
import { deleteTransactionAction } from "@/app/(app)/portfolio/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Figure } from "@/components/ui/figure";
import { FinTable, type FinColumn } from "@/components/ui/fin-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/app/empty-state";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { formatDate, titleCase } from "@/lib/format";
import { formatMoney, formatQuantity, formatUnitPrice } from "@/lib/amanah/number";
import { sumByCurrency } from "@/lib/fin-table";

export interface AssetLabel {
  symbol: string;
  name: string;
  currency: string;
}

/**
 * Activity (D2 — the renamed History) on the flagship FinTable: month group
 * headers, a per-currency fees-total footer, and the same edit/delete flows.
 * Rows stay in ledger-reverse order (newest first); grouping replaces sorting.
 */

const TYPE_BADGE: Record<string, "success" | "warning" | "neutral" | "secondary"> = {
  buy: "success",
  sell: "warning",
  dividend: "secondary",
};

function monthLabel(tradeDate: string): string {
  const d = new Date(tradeDate);
  if (Number.isNaN(d.getTime())) return tradeDate;
  // UTC: trade_date is a calendar date — group labels must match between
  // server render and client hydration regardless of machine timezone.
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function HistoryTable({
  transactions,
  assetLabels,
  brokers,
  initialTypeFilter,
  initialBrokerFilter,
}: {
  transactions: TransactionRow[];
  assetLabels: Record<string, AssetLabel>;
  brokers: BrokerRow[];
  initialTypeFilter?: string;
  initialBrokerFilter?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter ?? "all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [brokerFilter, setBrokerFilter] = useState(initialBrokerFilter ?? "all");
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleting, setDeleting] = useState<TransactionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const brokerById = useMemo(() => new Map(brokers.map((b) => [b.id, b])), [brokers]);
  const assetIds = useMemo(
    () => [...new Set(transactions.map((t) => t.asset_id).filter(Boolean))] as string[],
    [transactions]
  );

  const filtered = useMemo(
    () =>
      [...transactions]
        .sort((a, b) =>
          a.trade_date === b.trade_date
            ? b.created_at.localeCompare(a.created_at)
            : b.trade_date.localeCompare(a.trade_date)
        )
        .filter(
          (t) =>
            (typeFilter === "all" || t.type === typeFilter) &&
            (assetFilter === "all" || t.asset_id === assetFilter) &&
            (brokerFilter === "all" || t.broker_id === brokerFilter)
        ),
    [transactions, typeFilter, assetFilter, brokerFilter]
  );

  const feesTotals = useMemo(
    () =>
      sumByCurrency(
        filtered.filter((t) => t.fees > 0),
        (t) => t.fees,
        (t) => t.currency
      ),
    [filtered]
  );

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    const res = await deleteTransactionAction(deleting.id);
    setBusy(false);
    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }
    setDeleting(null);
    toast("Deleted — positions recomputed.");
    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Your activity"
        description="Every buy, sell, dividend, and cash movement will appear here — your complete ledger."
      />
    );
  }

  const filters = (
    <>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {["buy", "sell", "dividend", "deposit", "withdrawal", "fee", "zakat_payment", "purification_payment"].map(
            (t) => (
              <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>
            )
          )}
        </SelectContent>
      </Select>
      <Select value={assetFilter} onValueChange={setAssetFilter}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assets</SelectItem>
          {assetIds.map((id) => (
            <SelectItem key={id} value={id}>
              {assetLabels[id]?.symbol ?? "?"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {brokers.length > 0 && (
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {brokers.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  const columns: FinColumn<TransactionRow>[] = [
    {
      key: "date",
      header: "Date",
      type: "date",
      footer: <span className="text-xs text-ink-muted">Σ Fees (per currency)</span>,
      cell: (t) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(t.trade_date)}
          {t.trade_time && (
            <Clock
              className="ml-1 inline h-3 w-3 text-ink-faint"
              aria-label={`Executed at ${t.trade_time}`}
            />
          )}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      type: "badge",
      cell: (t) => (
        <Badge variant={TYPE_BADGE[t.type] ?? "neutral"}>{titleCase(t.type)}</Badge>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      type: "text",
      cell: (t) => {
        const label = t.asset_id ? assetLabels[t.asset_id] : null;
        return label ? (
          <span className="text-sm" title={label.name}>
            {label.symbol}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        );
      },
    },
    {
      key: "details",
      header: "Details",
      type: "money",
      cell: (t) => (
        <span className="figure-sm whitespace-nowrap">
          {t.quantity != null && t.price != null
            ? `${formatQuantity(t.quantity)} @ ${formatUnitPrice(t.price)} ${t.currency}`
            : t.amount != null
              ? formatMoney(t.amount, t.currency)
              : "—"}
        </span>
      ),
    },
    {
      key: "fees",
      header: "Fees",
      type: "money",
      hideCompact: true,
      footer: (
        <span className="space-x-3">
          {feesTotals.map((f) => (
            <Figure key={f.currency} value={f.total} currency={f.currency} size="sm" />
          ))}
        </span>
      ),
      cell: (t) =>
        t.fees > 0 ? (
          <Figure value={t.fees} size="sm" />
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "broker",
      header: "Account",
      type: "text",
      hideCompact: true,
      cell: (t) => (
        <span className="text-sm text-ink-muted">
          {t.broker_id ? brokerById.get(t.broker_id)?.name ?? "—" : "—"}
        </span>
      ),
    },
    {
      key: "realized",
      header: "Realized P&L",
      type: "delta",
      cell: (t) =>
        t.realized_pnl != null ? (
          <Figure value={t.realized_pnl} kind="delta" size="sm" />
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      type: "actions",
      cell: (t) => (
        <span
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(t)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={() => {
              setDeleteError(null);
              setDeleting(t);
            }}
          >
            <Trash2 className="h-4 w-4 text-ink-faint" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      {filtered.length === 0 ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">{filters}</div>
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              No transactions match — clear filters.
            </CardContent>
          </Card>
        </>
      ) : (
        <FinTable
          tableId="activity"
          columns={columns}
          rows={filtered}
          rowKey={(t) => t.id}
          groupBy={(t) => monthLabel(t.trade_date)}
          toolbar={filters}
          mobileCard={(t) => {
            const label = t.asset_id ? assetLabels[t.asset_id] : null;
            return (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span>
                    <Badge variant={TYPE_BADGE[t.type] ?? "neutral"}>{titleCase(t.type)}</Badge>
                    {label && <span className="ml-2 text-sm font-medium">{label.symbol}</span>}
                  </span>
                  {/* Primary figure: the transaction's money effect (§5) */}
                  <span className="figure-md">
                    {t.quantity != null && t.price != null
                      ? `${formatQuantity(t.quantity)} @ ${formatUnitPrice(t.price)}`
                      : t.amount != null
                        ? formatMoney(t.amount, t.currency)
                        : "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {formatDate(t.trade_date)}
                    {t.broker_id && ` · ${brokerById.get(t.broker_id)?.name ?? ""}`}
                  </span>
                  <span className="flex gap-2">
                    <button className="text-brand" onClick={() => setEditing(t)}>
                      Edit
                    </button>
                    <button
                      className="text-ink-faint"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(t);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </div>
            );
          }}
        />
      )}

      {/* Edit dialog */}
      {editing && (
        <TransactionDialog
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          edit={{
            transaction: editing,
            assetLabel: editing.asset_id ? (assetLabels[editing.asset_id] ?? null) : null,
          }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete transaction</DialogTitle>
            <DialogDescription>
              Delete this {deleting ? titleCase(deleting.type) : ""} from{" "}
              {formatDate(deleting?.trade_date)}? Positions recompute immediately.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className={cn("rounded-md bg-danger-surface px-3 py-2 text-sm text-danger")}>
              <p>{deleteError}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
