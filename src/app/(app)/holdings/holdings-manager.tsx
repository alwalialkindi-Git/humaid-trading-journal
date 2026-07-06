"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  holdingCostBasis,
  holdingMarketValue,
  holdingUnrealizedPnl,
} from "@/lib/calculations";
import {
  formatCurrency,
  formatNumber,
  formatSignedCurrency,
  pnlColor,
  titleCase,
} from "@/lib/format";
import { ASSET_TYPES, type Holding } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceBadge } from "@/components/app/compliance-badge";
import { EmptyState } from "@/components/app/empty-state";

const holdingSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20),
  asset_name: z.string().trim().max(120).optional(),
  market: z.string().trim().max(60).optional(),
  sector: z.string().trim().max(60).optional(),
  asset_type: z.enum(["stock", "etf", "crypto", "sukuk", "cash", "other"]),
  // positive (not min 0) so an empty field coerced to 0 is rejected
  quantity: z.coerce.number().positive("Quantity is required"),
  average_cost: z.coerce.number().min(0, "Average cost cannot be negative"),
  current_price: z.coerce.number().min(0, "Current price cannot be negative"),
  shariah_status: z.enum(["compliant", "doubtful", "non_compliant", "not_reviewed"]),
  notes: z.string().trim().max(1000).optional(),
});

const EMPTY_FORM = {
  symbol: "",
  asset_name: "",
  market: "",
  sector: "",
  asset_type: "stock",
  quantity: "",
  average_cost: "",
  current_price: "",
  shariah_status: "not_reviewed",
  notes: "",
};

export function HoldingsManager({
  holdings,
  currency,
}: {
  holdings: Holding[];
  currency: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [deleting, setDeleting] = useState<Holding | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(h: Holding) {
    setEditing(h);
    setForm({
      symbol: h.symbol,
      asset_name: h.asset_name ?? "",
      market: h.market ?? "",
      sector: h.sector ?? "",
      asset_type: h.asset_type,
      quantity: String(h.quantity),
      average_cost: String(h.average_cost),
      current_price: String(h.current_price),
      shariah_status: h.shariah_status,
      notes: h.notes ?? "",
    });
    setErrors({});
    setFormError(null);
    setDialogOpen(true);
  }

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const parsed = holdingSchema.safeParse({
      ...form,
      asset_name: form.asset_name || undefined,
      market: form.market || undefined,
      sector: form.sector || undefined,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFormError("Session expired. Please log in again.");
      setBusy(false);
      return;
    }

    const d = parsed.data;
    const payload = {
      user_id: user.id,
      symbol: d.symbol.toUpperCase(),
      asset_name: d.asset_name ?? null,
      market: d.market ?? null,
      sector: d.sector ?? null,
      asset_type: d.asset_type,
      quantity: d.quantity,
      average_cost: d.average_cost,
      current_price: d.current_price,
      shariah_status: d.shariah_status,
      notes: d.notes ?? null,
    };

    const { error } = editing
      ? await supabase.from("holdings").update(payload).eq("id", editing.id)
      : await supabase.from("holdings").insert(payload);

    setBusy(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("holdings")
      .delete()
      .eq("id", deleting.id);
    setBusy(false);
    if (!error) {
      setDeleting(null);
      router.refresh();
    }
  }

  const totalValue = holdings.reduce((s, h) => s + holdingMarketValue(h), 0);
  const totalCost = holdings.reduce((s, h) => s + holdingCostBasis(h), 0);

  const err = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add holding
        </Button>
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No holdings yet"
          description="Add the positions you currently own to track value, allocation, and Shariah status."
        >
          <Button onClick={openAdd}>Add your first holding</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Avg cost</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Unrealized P&L</TableHead>
                  <TableHead>Shariah</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => {
                  const pnl = holdingUnrealizedPnl(h);
                  const cost = holdingCostBasis(h);
                  return (
                    <TableRow key={h.id}>
                      <TableCell>
                        <p className="font-medium">{h.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.asset_name ?? h.sector ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {h.asset_type === "etf" ? "ETF" : titleCase(h.asset_type)}
                      </TableCell>
                      <TableCell>{formatNumber(h.quantity, 4)}</TableCell>
                      <TableCell>{formatNumber(h.average_cost, 4)}</TableCell>
                      <TableCell>{formatNumber(h.current_price, 4)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(holdingMarketValue(h), currency)}
                      </TableCell>
                      <TableCell className={`text-right ${pnlColor(pnl)}`}>
                        {formatSignedCurrency(pnl, currency)}
                        {cost > 0 && (
                          <span className="block text-xs">
                            {((pnl / cost) * 100).toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ComplianceBadge status={h.shariah_status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(h)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(h)}
                            title="Delete"
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
            <div className="mt-4 flex flex-wrap justify-end gap-6 border-t pt-4 text-sm">
              <p>
                <span className="text-muted-foreground">Cost basis: </span>
                <span className="font-medium">{formatCurrency(totalCost, currency)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Market value: </span>
                <span className="font-medium">{formatCurrency(totalValue, currency)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Unrealized: </span>
                <span className={`font-medium ${pnlColor(totalValue - totalCost)}`}>
                  {formatSignedCurrency(totalValue - totalCost, currency)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.symbol}` : "Add holding"}</DialogTitle>
            <DialogDescription>
              Prices are entered manually — update them whenever you want a
              fresh valuation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Symbol *</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) => set("symbol", e.target.value)}
                  placeholder="ADIB"
                />
                {err("symbol")}
              </div>
              <div className="space-y-1.5">
                <Label>Asset name</Label>
                <Input
                  value={form.asset_name}
                  onChange={(e) => set("asset_name", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Market</Label>
                <Input
                  value={form.market}
                  onChange={(e) => set("market", e.target.value)}
                  placeholder="ADX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Input
                  value={form.sector}
                  onChange={(e) => set("sector", e.target.value)}
                  placeholder="Islamic Financials"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Asset type</Label>
                <Select
                  value={form.asset_type}
                  onValueChange={(v) => set("asset_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "etf" ? "ETF" : titleCase(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shariah status</Label>
                <Select
                  value={form.shariah_status}
                  onValueChange={(v) => set("shariah_status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="doubtful">Doubtful</SelectItem>
                    <SelectItem value="non_compliant">Non-compliant</SelectItem>
                    <SelectItem value="not_reviewed">Not reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                />
                {err("quantity")}
              </div>
              <div className="space-y-1.5">
                <Label>Average cost *</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.average_cost}
                  onChange={(e) => set("average_cost", e.target.value)}
                />
                {err("average_cost")}
              </div>
              <div className="space-y-1.5">
                <Label>Current price *</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.current_price}
                  onChange={(e) => set("current_price", e.target.value)}
                />
                {err("current_price")}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            {formError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add holding"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete holding</DialogTitle>
            <DialogDescription>
              Remove {deleting?.symbol} from your holdings? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
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
