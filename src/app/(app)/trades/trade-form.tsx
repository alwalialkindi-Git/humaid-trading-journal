"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  ASSET_TYPES,
  EMOTIONS,
  MISTAKES,
  MISTAKE_LABELS,
  type Trade,
} from "@/lib/types";
import { titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

const tradeSchema = z
  .object({
    symbol: z.string().trim().min(1, "Symbol is required").max(20),
    asset_name: z.string().trim().max(120).optional(),
    market: z.string().trim().max(60).optional(),
    asset_type: z.enum(["stock", "etf", "crypto", "sukuk", "cash", "other"]),
    side: z.enum(["buy", "sell"]),
    quantity: z.coerce.number().positive("Quantity must be positive"),
    // positive (not min 0) so an empty field coerced to 0 is rejected
    entry_price: z.coerce.number().positive("Entry price is required"),
    exit_price: z.coerce.number().min(0).optional(),
    current_price: z.coerce.number().min(0).optional(),
    fees: z.coerce.number().min(0, "Fees cannot be negative"),
    entry_date: z.string().min(1, "Entry date is required"),
    exit_date: z.string().optional(),
    strategy: z.string().trim().max(60).optional(),
    setup_quality: z.coerce.number().int().min(1).max(5).optional(),
    trade_status: z.enum(["open", "closed"]),
    notes: z.string().trim().max(2000).optional(),
    tags: z.string().trim().optional(),
    emotion: z
      .enum(["confident", "fearful", "greedy", "patient", "rushed", "neutral"])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.trade_status === "closed") {
      if (data.exit_price == null) {
        ctx.addIssue({
          code: "custom",
          path: ["exit_price"],
          message: "Exit price is required for closed trades",
        });
      }
      if (!data.exit_date) {
        ctx.addIssue({
          code: "custom",
          path: ["exit_date"],
          message: "Exit date is required for closed trades",
        });
      }
    }
    if (
      data.exit_date &&
      data.entry_date &&
      data.exit_date < data.entry_date
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["exit_date"],
        message: "Exit date cannot be before entry date",
      });
    }
  });

type FieldErrors = Partial<Record<string, string>>;

function field(trade: Trade | null, key: keyof Trade): string {
  const v = trade?.[key];
  return v == null ? "" : String(v);
}

export function TradeForm({ trade }: { trade: Trade | null }) {
  const router = useRouter();
  const isEdit = trade !== null;

  const [values, setValues] = useState({
    symbol: field(trade, "symbol"),
    asset_name: field(trade, "asset_name"),
    market: field(trade, "market"),
    asset_type: trade?.asset_type ?? "stock",
    side: trade?.side ?? "buy",
    quantity: field(trade, "quantity"),
    entry_price: field(trade, "entry_price"),
    exit_price: field(trade, "exit_price"),
    current_price: field(trade, "current_price"),
    fees: trade ? String(trade.fees) : "0",
    entry_date: trade?.entry_date?.slice(0, 10) ?? "",
    exit_date: trade?.exit_date?.slice(0, 10) ?? "",
    strategy: field(trade, "strategy"),
    setup_quality: trade?.setup_quality ? String(trade.setup_quality) : "",
    trade_status: trade?.trade_status ?? "open",
    notes: field(trade, "notes"),
    tags: trade?.tags?.join(", ") ?? "",
    emotion: trade?.emotion ?? "",
  });
  const [mistakes, setMistakes] = useState<string[]>(trade?.mistakes ?? []);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleMistake(m: string) {
    setMistakes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const parsed = tradeSchema.safeParse({
      ...values,
      asset_name: values.asset_name || undefined,
      market: values.market || undefined,
      exit_price: values.exit_price === "" ? undefined : values.exit_price,
      current_price: values.current_price === "" ? undefined : values.current_price,
      exit_date: values.exit_date || undefined,
      strategy: values.strategy || undefined,
      setup_quality: values.setup_quality === "" ? undefined : values.setup_quality,
      notes: values.notes || undefined,
      tags: values.tags || undefined,
      emotion: values.emotion === "" ? undefined : values.emotion,
    });

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key != null && !fieldErrors[String(key)]) {
          fieldErrors[String(key)] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFormError("Session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const d = parsed.data;
    const payload = {
      user_id: user.id,
      symbol: d.symbol.toUpperCase(),
      asset_name: d.asset_name ?? null,
      market: d.market ?? null,
      asset_type: d.asset_type,
      side: d.side,
      quantity: d.quantity,
      entry_price: d.entry_price,
      exit_price: d.trade_status === "closed" ? (d.exit_price ?? null) : null,
      current_price: d.trade_status === "open" ? (d.current_price ?? null) : null,
      fees: d.fees,
      entry_date: d.entry_date,
      exit_date: d.trade_status === "closed" ? (d.exit_date ?? null) : null,
      strategy: d.strategy ?? null,
      setup_quality: d.setup_quality ?? null,
      trade_status: d.trade_status,
      notes: d.notes ?? null,
      tags: d.tags
        ? d.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      emotion: d.emotion ?? null,
      mistakes,
    };

    const { error } = isEdit
      ? await supabase.from("trades").update(payload).eq("id", trade.id)
      : await supabase.from("trades").insert(payload);

    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    router.push("/trades");
    router.refresh();
  }

  const err = (key: string) =>
    errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Asset */}
      <Card>
        <CardHeader>
          <CardTitle>Asset</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Symbol *</Label>
            <Input
              id="symbol"
              value={values.symbol}
              onChange={(e) => set("symbol", e.target.value)}
              placeholder="EMAAR"
            />
            {err("symbol")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asset_name">Asset name</Label>
            <Input
              id="asset_name"
              value={values.asset_name}
              onChange={(e) => set("asset_name", e.target.value)}
              placeholder="Emaar Properties"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="market">Market</Label>
            <Input
              id="market"
              value={values.market}
              onChange={(e) => set("market", e.target.value)}
              placeholder="DFM, Tadawul, NASDAQ…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Asset type</Label>
            <Select
              value={values.asset_type}
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
            <Label>Side</Label>
            <Select value={values.side} onValueChange={(v) => set("side", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Spot only — short selling is not supported by design.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={values.trade_status}
              onValueChange={(v) => set("trade_status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Execution */}
      <Card>
        <CardHeader>
          <CardTitle>Execution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={values.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
            {err("quantity")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry_price">Entry price *</Label>
            <Input
              id="entry_price"
              type="number"
              step="any"
              min="0"
              value={values.entry_price}
              onChange={(e) => set("entry_price", e.target.value)}
            />
            {err("entry_price")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fees">Fees</Label>
            <Input
              id="fees"
              type="number"
              step="any"
              min="0"
              value={values.fees}
              onChange={(e) => set("fees", e.target.value)}
            />
            {err("fees")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry_date">Entry date *</Label>
            <Input
              id="entry_date"
              type="date"
              value={values.entry_date}
              onChange={(e) => set("entry_date", e.target.value)}
            />
            {err("entry_date")}
          </div>
          {values.trade_status === "closed" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="exit_price">Exit price *</Label>
                <Input
                  id="exit_price"
                  type="number"
                  step="any"
                  min="0"
                  value={values.exit_price}
                  onChange={(e) => set("exit_price", e.target.value)}
                />
                {err("exit_price")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exit_date">Exit date *</Label>
                <Input
                  id="exit_date"
                  type="date"
                  value={values.exit_date}
                  onChange={(e) => set("exit_date", e.target.value)}
                />
                {err("exit_date")}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="current_price">Current price (optional)</Label>
              <Input
                id="current_price"
                type="number"
                step="any"
                min="0"
                value={values.current_price}
                onChange={(e) => set("current_price", e.target.value)}
                placeholder="For unrealized P&L"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Journal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="strategy">Strategy</Label>
              <Input
                id="strategy"
                value={values.strategy}
                onChange={(e) => set("strategy", e.target.value)}
                placeholder="Breakout, Swing, Position…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Setup quality</Label>
              <Select
                value={values.setup_quality || "none"}
                onValueChange={(v) => set("setup_quality", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rate 1–5" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not rated</SelectItem>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {"★".repeat(n)}
                      {"☆".repeat(5 - n)} ({n})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Emotion</Label>
              <Select
                value={values.emotion || "none"}
                onValueChange={(v) => set("emotion", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="How did you feel?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {EMOTIONS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {titleCase(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={values.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="uae, real-estate, earnings"
            />
          </div>

          <div className="space-y-2">
            <Label>Mistake checklist</Label>
            <p className="text-xs text-muted-foreground">
              Be honest — this is how the journal helps you improve.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {MISTAKES.map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={mistakes.includes(m)}
                    onCheckedChange={() => toggleMistake(m)}
                  />
                  {MISTAKE_LABELS[m]}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="What was the plan? What actually happened? What did you learn?"
            />
          </div>
        </CardContent>
      </Card>

      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Log trade"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/trades")}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
