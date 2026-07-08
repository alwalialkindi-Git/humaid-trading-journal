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
import { formatDate, formatNumber, formatSignedCurrency, pnlColor, titleCase } from "@/lib/format";

export interface AssetLabel {
  symbol: string;
  name: string;
  currency: string;
}

const TYPE_BADGE: Record<string, "success" | "warning" | "neutral" | "secondary"> = {
  buy: "success",
  sell: "warning",
  dividend: "secondary",
};

export function HistoryTable({
  transactions,
  assetLabels,
  brokers,
  initialTypeFilter,
}: {
  transactions: TransactionRow[];
  assetLabels: Record<string, AssetLabel>;
  brokers: BrokerRow[];
  initialTypeFilter?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter ?? "all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [brokerFilter, setBrokerFilter] = useState("all");
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
    toast("Transaction deleted — positions recomputed.");
    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No transactions yet"
        description="Every buy, sell, dividend, and cash movement will appear here — your complete ledger."
      />
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
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
              <SelectItem value="all">All brokers</SelectItem>
              {brokers.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No transactions match — clear filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead>Broker</TableHead>
                  <TableHead className="text-right">Realized P&L</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const label = t.asset_id ? assetLabels[t.asset_id] : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(t.trade_date)}
                        {t.trade_time && (
                          <Clock
                            className="ml-1 inline h-3 w-3 text-muted-foreground"
                            aria-label={`Executed at ${t.trade_time}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_BADGE[t.type] ?? "neutral"}>
                          {titleCase(t.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {label ? (
                          <span title={label.name}>{label.symbol}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm">
                        {t.quantity != null && t.price != null
                          ? `${formatNumber(t.quantity, 4)} @ ${formatNumber(t.price, 4)} ${t.currency}`
                          : t.amount != null
                            ? `${formatNumber(t.amount)} ${t.currency}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {t.fees > 0 ? formatNumber(t.fees) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.broker_id ? (brokerById.get(t.broker_id)?.name ?? "—") : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-sm",
                          t.realized_pnl != null ? pnlColor(t.realized_pnl) : "text-muted-foreground"
                        )}
                      >
                        {t.realized_pnl != null
                          ? formatSignedCurrency(t.realized_pnl, t.currency)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => setEditing(t)}
                          >
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
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
