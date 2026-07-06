"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import {
  WARNING_CATEGORIES,
  WARNING_LABELS,
  type ShariahScreening,
  type WarningCategory,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

const ratio = z.coerce.number().min(0, "Cannot be negative").max(100, "Max 100%");

const screeningSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20),
  asset_name: z.string().trim().max(120).optional(),
  market: z.string().trim().max(60).optional(),
  business_activity: z.string().trim().max(300).optional(),
  compliance_status: z.enum(["compliant", "doubtful", "non_compliant", "not_reviewed"]),
  debt_ratio: ratio.optional(),
  interest_income_ratio: ratio.optional(),
  cash_and_receivables_ratio: ratio.optional(),
  purification_percentage: ratio.optional(),
  screening_source: z.string().trim().max(120).optional(),
  last_reviewed_date: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
});

const EMPTY_FORM = {
  symbol: "",
  asset_name: "",
  market: "",
  business_activity: "",
  compliance_status: "not_reviewed",
  debt_ratio: "",
  interest_income_ratio: "",
  cash_and_receivables_ratio: "",
  purification_percentage: "",
  screening_source: "",
  last_reviewed_date: "",
  notes: "",
};

export function ScreeningsManager({
  screenings,
}: {
  screenings: ShariahScreening[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShariahScreening | null>(null);
  const [deleting, setDeleting] = useState<ShariahScreening | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return screenings.filter((s) => {
      if (statusFilter !== "all" && s.compliance_status !== statusFilter)
        return false;
      if (
        q &&
        !s.symbol.toLowerCase().includes(q) &&
        !(s.asset_name ?? "").toLowerCase().includes(q) &&
        !(s.business_activity ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [screenings, search, statusFilter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setWarnings([]);
    setErrors({});
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(s: ShariahScreening) {
    setEditing(s);
    setForm({
      symbol: s.symbol,
      asset_name: s.asset_name ?? "",
      market: s.market ?? "",
      business_activity: s.business_activity ?? "",
      compliance_status: s.compliance_status,
      debt_ratio: s.debt_ratio != null ? String(s.debt_ratio) : "",
      interest_income_ratio:
        s.interest_income_ratio != null ? String(s.interest_income_ratio) : "",
      cash_and_receivables_ratio:
        s.cash_and_receivables_ratio != null
          ? String(s.cash_and_receivables_ratio)
          : "",
      purification_percentage:
        s.purification_percentage != null
          ? String(s.purification_percentage)
          : "",
      screening_source: s.screening_source ?? "",
      last_reviewed_date: s.last_reviewed_date?.slice(0, 10) ?? "",
      notes: s.notes ?? "",
    });
    setWarnings(s.warning_categories ?? []);
    setErrors({});
    setFormError(null);
    setDialogOpen(true);
  }

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleWarning(w: string) {
    setWarnings((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const parsed = screeningSchema.safeParse({
      ...form,
      asset_name: form.asset_name || undefined,
      market: form.market || undefined,
      business_activity: form.business_activity || undefined,
      debt_ratio: form.debt_ratio === "" ? undefined : form.debt_ratio,
      interest_income_ratio:
        form.interest_income_ratio === "" ? undefined : form.interest_income_ratio,
      cash_and_receivables_ratio:
        form.cash_and_receivables_ratio === ""
          ? undefined
          : form.cash_and_receivables_ratio,
      purification_percentage:
        form.purification_percentage === ""
          ? undefined
          : form.purification_percentage,
      screening_source: form.screening_source || undefined,
      last_reviewed_date: form.last_reviewed_date || undefined,
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
      business_activity: d.business_activity ?? null,
      compliance_status: d.compliance_status,
      debt_ratio: d.debt_ratio ?? null,
      interest_income_ratio: d.interest_income_ratio ?? null,
      cash_and_receivables_ratio: d.cash_and_receivables_ratio ?? null,
      purification_percentage: d.purification_percentage ?? null,
      screening_source: d.screening_source ?? null,
      last_reviewed_date: d.last_reviewed_date ?? null,
      warning_categories: warnings,
      notes: d.notes ?? null,
    };

    const { error } = editing
      ? await supabase
          .from("shariah_screenings")
          .update(payload)
          .eq("id", editing.id)
      : await supabase.from("shariah_screenings").insert(payload);

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
      .from("shariah_screenings")
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search screenings…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="doubtful">Doubtful</SelectItem>
              <SelectItem value="non_compliant">Non-compliant</SelectItem>
              <SelectItem value="not_reviewed">Not reviewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> New screening
        </Button>
      </div>

      {screenings.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No screenings recorded"
          description="Record the compliance status and financial ratios of the assets you own or watch."
        >
          <Button onClick={openAdd}>Screen your first asset</Button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No screenings match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Debt %</TableHead>
                  <TableHead className="text-right">Interest inc. %</TableHead>
                  <TableHead className="text-right">Cash+Rec. %</TableHead>
                  <TableHead className="text-right">Purif. %</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.symbol}</p>
                      <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {s.business_activity ?? s.asset_name ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ComplianceBadge status={s.compliance_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {s.debt_ratio != null ? `${s.debt_ratio}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.interest_income_ratio != null
                        ? `${s.interest_income_ratio}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.cash_and_receivables_ratio != null
                        ? `${s.cash_and_receivables_ratio}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.purification_percentage != null
                        ? `${s.purification_percentage}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {s.warning_categories.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {s.warning_categories.slice(0, 2).map((w) => (
                            <Badge key={w} variant="danger" className="text-[10px]">
                              {WARNING_LABELS[w as WarningCategory] ?? w}
                            </Badge>
                          ))}
                          {s.warning_categories.length > 2 && (
                            <Badge variant="neutral" className="text-[10px]">
                              +{s.warning_categories.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(s.last_reviewed_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(s)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(s)}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit screening: ${editing.symbol}` : "New Shariah screening"}
            </DialogTitle>
            <DialogDescription>
              Common AAOIFI-style thresholds: debt &lt; 30%, interest income
              &lt; 5%, cash &amp; receivables &lt; 70% — but follow your own
              scholar&apos;s methodology.
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
                <Label>Compliance status</Label>
                <Select
                  value={form.compliance_status}
                  onValueChange={(v) => set("compliance_status", v)}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Business activity</Label>
                <Input
                  value={form.business_activity}
                  onChange={(e) => set("business_activity", e.target.value)}
                  placeholder="What does the company actually do?"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Debt ratio %</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.debt_ratio}
                  onChange={(e) => set("debt_ratio", e.target.value)}
                />
                {err("debt_ratio")}
              </div>
              <div className="space-y-1.5">
                <Label>Interest income %</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.interest_income_ratio}
                  onChange={(e) => set("interest_income_ratio", e.target.value)}
                />
                {err("interest_income_ratio")}
              </div>
              <div className="space-y-1.5">
                <Label>Cash &amp; receivables %</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.cash_and_receivables_ratio}
                  onChange={(e) =>
                    set("cash_and_receivables_ratio", e.target.value)
                  }
                />
                {err("cash_and_receivables_ratio")}
              </div>
              <div className="space-y-1.5">
                <Label>Purification %</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.purification_percentage}
                  onChange={(e) => set("purification_percentage", e.target.value)}
                />
                {err("purification_percentage")}
              </div>
              <div className="space-y-1.5">
                <Label>Screening source</Label>
                <Input
                  value={form.screening_source}
                  onChange={(e) => set("screening_source", e.target.value)}
                  placeholder="Manual, screening app, scholar…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last reviewed</Label>
                <Input
                  type="date"
                  value={form.last_reviewed_date}
                  onChange={(e) => set("last_reviewed_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Warning categories</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {WARNING_CATEGORIES.map((w) => (
                  <label
                    key={w}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={warnings.includes(w)}
                      onCheckedChange={() => toggleWarning(w)}
                    />
                    {WARNING_LABELS[w]}
                  </label>
                ))}
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
                {editing ? "Save changes" : "Save screening"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete screening</DialogTitle>
            <DialogDescription>
              Delete the {deleting?.symbol} screening record? This cannot be
              undone.
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
