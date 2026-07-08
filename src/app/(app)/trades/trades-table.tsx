"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Pencil, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  tradePnl,
  tradePnlPercent,
  holdingPeriodDays,
} from "@/lib/calculations";
import {
  formatDate,
  formatNumber,
  formatSignedCurrency,
  pnlColor,
  titleCase,
} from "@/lib/format";
import type { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/app/empty-state";

export function TradesTable({
  trades,
  currency,
}: {
  trades: Trade[];
  currency: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [strategy, setStrategy] = useState("all");
  const [emotion, setEmotion] = useState("all");
  const [deleting, setDeleting] = useState<Trade | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strategies = useMemo(
    () => [...new Set(trades.map((t) => t.strategy).filter(Boolean))] as string[],
    [trades]
  );
  const emotions = useMemo(
    () => [...new Set(trades.map((t) => t.emotion).filter(Boolean))] as string[],
    [trades]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trades.filter((t) => {
      if (status !== "all" && t.trade_status !== status) return false;
      if (strategy !== "all" && t.strategy !== strategy) return false;
      if (emotion !== "all" && t.emotion !== emotion) return false;
      if (
        q &&
        !t.symbol.toLowerCase().includes(q) &&
        !(t.asset_name ?? "").toLowerCase().includes(q) &&
        !t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [trades, search, status, strategy, emotion]);

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from("trades").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  if (trades.length === 0) {
    return (
      <EmptyState
        icon={BookOpenText}
        title="Your journal is empty"
        description="Log your first trade to start building an honest picture of your trading."
      >
        <Button asChild>
          <Link href="/portfolio">Add a transaction</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol, name, or tag…"
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All strategies</SelectItem>
                {strategies.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={emotion} onValueChange={setEmotion}>
              <SelectTrigger className="sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All emotions</SelectItem>
                {emotions.map((e) => (
                  <SelectItem key={e} value={e}>
                    {titleCase(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No trades match your filters.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>Held</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const pnl = tradePnl(t);
                const pnlPct = tradePnlPercent(t);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.strategy ?? titleCase(t.asset_type)}
                        {t.mistakes.length > 0 && (
                          <span className="ml-1 text-amber-600">
                            · {t.mistakes.length} mistake{t.mistakes.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.side === "buy" ? "success" : "warning"}>
                        {t.side}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNumber(t.quantity, 4)}</TableCell>
                    <TableCell>
                      <p>{formatNumber(t.entry_price, 4)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.entry_date)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {t.exit_price != null ? (
                        <>
                          <p>{formatNumber(t.exit_price, 4)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(t.exit_date)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {holdingPeriodDays(t)}d
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.trade_status === "open" ? "secondary" : "neutral"}>
                        {t.trade_status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${pnl != null ? pnlColor(pnl) : "text-muted-foreground"}`}
                    >
                      {pnl != null ? formatSignedCurrency(pnl, currency) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${pnlPct != null ? pnlColor(pnlPct) : "text-muted-foreground"}`}
                    >
                      {pnlPct != null ? `${pnlPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/trades/${t.id}/edit`} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => setDeleting(t)}
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
        )}
      </CardContent>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete trade</DialogTitle>
            <DialogDescription>
              Delete the {deleting?.symbol} trade from{" "}
              {formatDate(deleting?.entry_date)}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </p>
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
    </Card>
  );
}
