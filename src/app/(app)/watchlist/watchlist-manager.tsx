"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import type { WatchlistItem } from "@/lib/types";
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
import { ComplianceBadge, RiskBadge } from "@/components/app/compliance-badge";
import { EmptyState } from "@/components/app/empty-state";

const watchlistSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20),
  asset_name: z.string().trim().max(120).optional(),
  market: z.string().trim().max(60).optional(),
  target_price: z.coerce.number().min(0).optional(),
  current_price: z.coerce.number().min(0).optional(),
  shariah_status: z.enum(["compliant", "doubtful", "non_compliant", "not_reviewed"]),
  risk_level: z.enum(["low", "medium", "high"]),
  notes: z.string().trim().max(1000).optional(),
});

const EMPTY_FORM = {
  symbol: "",
  asset_name: "",
  market: "",
  target_price: "",
  current_price: "",
  shariah_status: "not_reviewed",
  risk_level: "medium",
  notes: "",
};

export function WatchlistManager({
  items,
  currency,
}: {
  items: WatchlistItem[];
  currency: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WatchlistItem | null>(null);
  const [deleting, setDeleting] = useState<WatchlistItem | null>(null);
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

  function openEdit(w: WatchlistItem) {
    setEditing(w);
    setForm({
      symbol: w.symbol,
      asset_name: w.asset_name ?? "",
      market: w.market ?? "",
      target_price: w.target_price != null ? String(w.target_price) : "",
      current_price: w.current_price != null ? String(w.current_price) : "",
      shariah_status: w.shariah_status,
      risk_level: w.risk_level,
      notes: w.notes ?? "",
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

    const parsed = watchlistSchema.safeParse({
      ...form,
      asset_name: form.asset_name || undefined,
      market: form.market || undefined,
      target_price: form.target_price === "" ? undefined : form.target_price,
      current_price: form.current_price === "" ? undefined : form.current_price,
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
      target_price: d.target_price ?? null,
      current_price: d.current_price ?? null,
      shariah_status: d.shariah_status,
      risk_level: d.risk_level,
      notes: d.notes ?? null,
    };

    const { error } = editing
      ? await supabase.from("watchlist").update(payload).eq("id", editing.id)
      : await supabase.from("watchlist").insert(payload);

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
      .from("watchlist")
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
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add symbol
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="Watchlist is empty"
          description="Add symbols you're considering — screen them for compliance before you ever place an order."
        >
          <Button onClick={openAdd}>Watch your first symbol</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Shariah</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((w) => {
                  const atTarget =
                    w.target_price != null &&
                    w.current_price != null &&
                    w.current_price <= w.target_price;
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <p className="font-medium">{w.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {w.asset_name ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{w.market ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {w.target_price != null
                          ? formatCurrency(w.target_price, currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.current_price != null
                          ? formatCurrency(w.current_price, currency)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {atTarget ? (
                          <Badge variant="success">At target</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Waiting</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ComplianceBadge status={w.shariah_status} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge level={w.risk_level} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(w)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(w)}
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
          </CardContent>
        </Card>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.symbol}` : "Add to watchlist"}
            </DialogTitle>
            <DialogDescription>
              Decide your entry and compliance stance before the market tempts
              you.
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
                <Label>Market</Label>
                <Input
                  value={form.market}
                  onChange={(e) => set("market", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Risk level</Label>
                <Select
                  value={form.risk_level}
                  onValueChange={(v) => set("risk_level", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target buy price</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.target_price}
                  onChange={(e) => set("target_price", e.target.value)}
                />
                {err("target_price")}
              </div>
              <div className="space-y-1.5">
                <Label>Current price</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.current_price}
                  onChange={(e) => set("current_price", e.target.value)}
                />
                {err("current_price")}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
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
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Why is it on the list? What's the plan?"
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
                {editing ? "Save changes" : "Add symbol"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from watchlist</DialogTitle>
            <DialogDescription>
              Remove {deleting?.symbol} from your watchlist?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
