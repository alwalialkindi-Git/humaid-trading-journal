"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { computePurification } from "@/lib/zakat";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Dividend } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";

const dividendSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20),
  asset_name: z.string().trim().max(120).optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  payment_date: z.string().min(1, "Payment date is required"),
  purification_percentage: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100%"),
  notes: z.string().trim().max(1000).optional(),
});

const EMPTY_FORM = {
  symbol: "",
  asset_name: "",
  amount: "",
  payment_date: "",
  purification_percentage: "0",
  notes: "",
};

export function DividendsManager({
  dividends,
  currency,
}: {
  dividends: Dividend[];
  currency: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dividend | null>(null);
  const [deleting, setDeleting] = useState<Dividend | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalReceived = dividends.reduce((s, d) => s + d.amount, 0);
  const totalPurification = dividends.reduce(
    (s, d) => s + computePurification(d.amount, d.purification_percentage),
    0
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(d: Dividend) {
    setEditing(d);
    setForm({
      symbol: d.symbol,
      asset_name: d.asset_name ?? "",
      amount: String(d.amount),
      payment_date: d.payment_date.slice(0, 10),
      purification_percentage: String(d.purification_percentage),
      notes: d.notes ?? "",
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

    const parsed = dividendSchema.safeParse({
      ...form,
      asset_name: form.asset_name || undefined,
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
      amount: d.amount,
      payment_date: d.payment_date,
      purification_percentage: d.purification_percentage,
      notes: d.notes ?? null,
    };

    const { error } = editing
      ? await supabase.from("dividends").update(payload).eq("id", editing.id)
      : await supabase.from("dividends").insert(payload);

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
      .from("dividends")
      .delete()
      .eq("id", deleting.id);
    setBusy(false);
    if (!error) {
      setDeleting(null);
      router.refresh();
    }
  }

  const err = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total dividends received"
          value={formatCurrency(totalReceived, currency)}
          sub={`${dividends.length} payments recorded`}
        />
        <StatCard
          label="Purification owed"
          value={formatCurrency(totalPurification, currency)}
          sub="Give this amount to charity — separate from zakat"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Record dividend
        </Button>
      </div>

      {dividends.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No dividends recorded"
          description="Track dividend income here — including the purification percentage from your Shariah screening."
        >
          <Button onClick={openAdd}>Record your first dividend</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Payment date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Purification %</TableHead>
                  <TableHead className="text-right">Purification due</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dividends.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <p className="font-medium">{d.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.asset_name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>{formatDate(d.payment_date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(d.amount, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {d.purification_percentage}%
                    </TableCell>
                    <TableCell className="text-right text-amber-700">
                      {formatCurrency(
                        computePurification(d.amount, d.purification_percentage),
                        currency
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(d)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(d)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.symbol} dividend` : "Record dividend"}
            </DialogTitle>
            <DialogDescription>
              The purification percentage usually comes from the company&apos;s
              Shariah screening report.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Symbol *</Label>
                <Input
                  value={form.symbol}
                  onChange={(e) => set("symbol", e.target.value)}
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
                <Label>Amount ({currency}) *</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
                {err("amount")}
              </div>
              <div className="space-y-1.5">
                <Label>Payment date *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => set("payment_date", e.target.value)}
                />
                {err("payment_date")}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Purification %</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={form.purification_percentage}
                  onChange={(e) => set("purification_percentage", e.target.value)}
                />
                {err("purification_percentage")}
                <p className="text-xs text-muted-foreground">
                  Portion of this dividend from impermissible income that
                  should be given to charity.
                </p>
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
                {editing ? "Save changes" : "Record dividend"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete dividend</DialogTitle>
            <DialogDescription>
              Remove the {deleting?.symbol} dividend from{" "}
              {formatDate(deleting?.payment_date)}? This cannot be undone.
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
