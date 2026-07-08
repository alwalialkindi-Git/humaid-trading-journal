"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { previewSellRealizedPnl } from "@/lib/engine/positions";
import type { TransactionType } from "@/lib/engine/positions";
import type { TransactionInput, TransactionRow } from "@/lib/services";
import {
  createTransactionAction,
  getDialogContextAction,
  updateTransactionAction,
  type DialogContext,
} from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useToast } from "@/components/ui/toaster";
import { AssetSearch, type SelectedAsset } from "./asset-search";
import { BrokerSelect } from "./broker-select";

/**
 * Add/Edit Transaction dialog — Phase 5 "The Loop" write path (§9.2).
 * One shell, per-type field groups, submit → server action → services →
 * engine trial recompute. Client validation is convenience; the service
 * layer is the law; engine messages render verbatim.
 */

const TYPE_OPTIONS: { value: TransactionType; label: string; group: string }[] = [
  { value: "buy", label: "Buy", group: "Trade" },
  { value: "sell", label: "Sell", group: "Trade" },
  { value: "dividend", label: "Dividend", group: "Income" },
  { value: "deposit", label: "Deposit", group: "Cash" },
  { value: "withdrawal", label: "Withdraw", group: "Cash" },
  { value: "fee", label: "Fee", group: "Cash" },
  { value: "zakat_payment", label: "Zakat payment", group: "Obligation" },
  { value: "purification_payment", label: "Purification", group: "Obligation" },
];

const SACRED_COPY: Partial<Record<TransactionType, string>> = {
  zakat_payment: "Recording a zakat payment — may it be accepted.",
  purification_payment:
    "Recording a purification payment — the impermissible share, given to charity.",
};

interface EditTarget {
  transaction: TransactionRow;
  assetLabel: { symbol: string; name: string; currency: string } | null;
}

export interface DialogPreset {
  type: TransactionType;
  asset?: { id: string; symbol: string; name: string; currency: string };
}

export function TransactionDialog({
  open,
  onOpenChange,
  edit,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit?: EditTarget | null;
  preset?: DialogPreset | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(edit);

  const [context, setContext] = useState<DialogContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const [type, setType] = useState<TransactionType>("buy");
  const [portfolioId, setPortfolioId] = useState("");
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [positionAssetId, setPositionAssetId] = useState(""); // sell/dividend picker
  const [presetBuyAsset, setPresetBuyAsset] = useState<DialogPreset["asset"] | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fees, setFees] = useState("0");
  const [currency, setCurrency] = useState("AED");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));
  const [tradeTime, setTradeTime] = useState("");
  const [purification, setPurification] = useState("0");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load context + apply edit target when the dialog opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const res = await getDialogContextAction();
      if (cancelled) return;
      if (!res.ok) {
        setContextError(res.error);
        return;
      }
      setContext(res.data);
      const defaultPf =
        res.data.portfolios.find((p) => p.is_default) ?? res.data.portfolios[0];
      const remembered =
        typeof window !== "undefined" ? localStorage.getItem("htj.lastPortfolio") : null;
      const rememberedBroker =
        typeof window !== "undefined" ? localStorage.getItem("htj.lastBroker") : null;

      if (edit) {
        const t = edit.transaction;
        setType(t.type);
        setPortfolioId(t.portfolio_id);
        setBrokerId(t.broker_id);
        setPositionAssetId(t.asset_id ?? "");
        setQuantity(t.quantity != null ? String(t.quantity) : "");
        setPrice(t.price != null ? String(t.price) : "");
        setAmount(t.amount != null ? String(t.amount) : "");
        setFees(String(t.fees));
        setCurrency(t.currency);
        setTradeDate(t.trade_date.slice(0, 10));
        setTradeTime(t.trade_time?.slice(0, 5) ?? "");
        setPurification(
          t.purification_percentage != null ? String(t.purification_percentage) : "0"
        );
        setNotes(t.notes ?? "");
      } else {
        const pf =
          res.data.portfolios.find((p) => p.id === remembered) ?? defaultPf ?? null;
        if (pf) {
          setPortfolioId(pf.id);
          setCurrency(pf.base_currency);
        }
        if (rememberedBroker && res.data.brokers.some((b) => b.id === rememberedBroker)) {
          setBrokerId(rememberedBroker);
        }
        if (preset) {
          setType(preset.type);
          if (preset.asset) {
            if (preset.type === "buy") setPresetBuyAsset(preset.asset);
            else setPositionAssetId(preset.asset.id);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = useCallback(() => {
    setType("buy");
    setSelectedAsset(null);
    setPresetBuyAsset(null);
    setPositionAssetId("");
    setQuantity("");
    setPrice("");
    setAmount("");
    setFees("0");
    setTradeTime("");
    setPurification("0");
    setNotes("");
    setFormError(null);
    setMoreOpen(false);
  }, []);

  const portfolioHoldings = useMemo(
    () => (context?.holdings ?? []).filter((h) => h.portfolio_id === portfolioId),
    [context, portfolioId]
  );
  const openPositions = portfolioHoldings.filter((h) => h.quantity > 0);
  const sellSource = openPositions.find((h) => h.asset.id === positionAssetId) ?? null;
  const dividendSource =
    portfolioHoldings.find((h) => h.asset.id === positionAssetId) ?? null;

  const isAssetType = type === "buy" || type === "sell" || type === "dividend";
  const activeAssetId =
    type === "buy"
      ? (selectedAsset?.asset.id ??
        presetBuyAsset?.id ??
        (isEdit ? edit!.transaction.asset_id : null))
      : positionAssetId || null;

  // Sell preview — the same code the server persists (engine export).
  const preview = useMemo(() => {
    if (type !== "sell" || !sellSource) return null;
    return previewSellRealizedPnl({
      heldQuantity: sellSource.quantity,
      averageCost: sellSource.average_cost,
      sellQuantity: Number(quantity),
      sellPrice: Number(price),
      fees: Number(fees) || 0,
    });
  }, [type, sellSource, quantity, price, fees]);

  function effectiveCurrency(): string {
    if (type === "buy") {
      return (
        selectedAsset?.asset.currency ??
        presetBuyAsset?.currency ??
        edit?.assetLabel?.currency ??
        currency
      );
    }
    if (type === "sell") return sellSource?.asset.currency ?? currency;
    if (type === "dividend") return dividendSource?.asset.currency ?? currency;
    return currency;
  }

  function clientValidate(): string | null {
    if (!portfolioId) return "Choose a portfolio.";
    if (!tradeDate) return "Trade date is required.";
    if (isAssetType && !activeAssetId) {
      return type === "buy" ? "Search and select an asset." : "Choose a position.";
    }
    if (type === "buy" || type === "sell") {
      if (!(Number(quantity) > 0)) return "Quantity must be greater than zero.";
      if (!(Number(price) >= 0) || price === "") return "Enter the execution price.";
      if (type === "sell" && sellSource && Number(quantity) > sellSource.quantity) {
        return `You hold ${sellSource.quantity} — short selling isn’t supported; you can only sell what you own.`;
      }
    }
    const needsAmount = type === "dividend" || !isAssetType;
    if (needsAmount && !(Number(amount) > 0)) {
      return "Amount must be greater than zero.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientError = clientValidate();
    if (clientError) {
      setFormError(clientError);
      return;
    }

    const input: TransactionInput = {
      portfolio_id: portfolioId,
      broker_id: brokerId,
      type,
      currency: effectiveCurrency(),
      trade_date: tradeDate,
      trade_time: tradeTime || null,
      fees: Number(fees) || 0,
      notes: notes.trim() || null,
      ...(isAssetType ? { asset_id: activeAssetId } : {}),
      ...(type === "buy" || type === "sell"
        ? { quantity: Number(quantity), price: Number(price) }
        : {}),
      ...(type === "dividend"
        ? { amount: Number(amount), purification_percentage: Number(purification) || 0 }
        : {}),
      ...(!isAssetType ? { amount: Number(amount) } : {}),
    };

    setSaving(true);
    const res = isEdit
      ? await updateTransactionAction(edit!.transaction.id, input)
      : await createTransactionAction(input);
    setSaving(false);

    if (!res.ok) {
      setFormError(res.error);
      return;
    }

    localStorage.setItem("htj.lastPortfolio", portfolioId);
    if (brokerId) localStorage.setItem("htj.lastBroker", brokerId);

    const label = TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
    toast(
      isEdit
        ? "Transaction updated — positions recomputed."
        : type === "sell" && res.data.realized_pnl != null
          ? `${label} recorded — realized P&L ${res.data.realized_pnl >= 0 ? "+" : ""}${res.data.realized_pnl} ${input.currency}.`
          : `${label} recorded — portfolio updated.`
    );
    reset();
    onOpenChange(false);
    router.refresh();
  }

  const groups = [...new Set(TYPE_OPTIONS.map((t) => t.group))];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Changes replay through the engine — history stays consistent."
              : "Record what happened at the market; your portfolio recomputes instantly."}
          </DialogDescription>
        </DialogHeader>

        {contextError ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{contextError}</p>
        ) : !context ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Type switcher — grouped chips (radiogroup) */}
            {!isEdit && (
              <div role="radiogroup" aria-label="Transaction type" className="space-y-2">
                {groups.map((group) => (
                  <div key={group} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {group}
                    </span>
                    {TYPE_OPTIONS.filter((t) => t.group === group).map((t) => {
                      const disabled = t.value === "sell" && openPositions.length === 0;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={type === t.value}
                          disabled={disabled}
                          title={disabled ? "No open positions to sell" : undefined}
                          onClick={() => {
                            setType(t.value);
                            setPositionAssetId("");
                            setFormError(null);
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm transition-colors",
                            type === t.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-muted",
                            disabled && "cursor-not-allowed opacity-40"
                          )}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {SACRED_COPY[type] && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {SACRED_COPY[type]}
              </p>
            )}

            {/* Asset selection */}
            {type === "buy" &&
              (isEdit && edit?.assetLabel ? (
                <StaticAssetChip label={edit.assetLabel} />
              ) : presetBuyAsset ? (
                <StaticAssetChip label={presetBuyAsset} />
              ) : (
                <div className="space-y-1">
                  <Label>Asset *</Label>
                  <AssetSearch
                    selected={selectedAsset}
                    onSelect={(sel) => {
                      setSelectedAsset(sel);
                      if (sel.quotePrice != null && price === "") {
                        setPrice(String(sel.quotePrice));
                      }
                    }}
                    onClear={() => setSelectedAsset(null)}
                  />
                  {selectedAsset?.quotePrice != null && (
                    <p className="text-xs text-muted-foreground">
                      Market price prefilled — adjust to your fill price.
                    </p>
                  )}
                </div>
              ))}

            {(type === "sell" || type === "dividend") &&
              (isEdit && edit?.assetLabel ? (
                <StaticAssetChip label={edit.assetLabel} />
              ) : (
                <div className="space-y-1">
                  <Label>{type === "sell" ? "Position *" : "Asset *"}</Label>
                  <Select value={positionAssetId || undefined} onValueChange={setPositionAssetId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          type === "sell" ? "Choose an open position" : "Choose an asset you hold or held"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(type === "sell" ? openPositions : portfolioHoldings).map((h) => (
                        <SelectItem key={h.asset.id} value={h.asset.id}>
                          {h.asset.symbol} · {h.quantity} held
                          {type === "sell" ? ` @ ${h.average_cost} avg` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {type === "sell" && sellSource && (
                    <p className="text-xs text-muted-foreground">
                      You hold {sellSource.quantity} @ {sellSource.average_cost} avg (
                      {sellSource.asset.currency}).
                    </p>
                  )}
                </div>
              ))}

            {/* Numbers */}
            <div className="grid grid-cols-2 gap-3">
              {(type === "buy" || type === "sell") && (
                <>
                  <div className="space-y-1">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Price ({effectiveCurrency()}) *</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Fees</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={fees}
                      onChange={(e) => setFees(e.target.value)}
                    />
                  </div>
                </>
              )}

              {(type === "dividend" || !isAssetType) && (
                <div className="space-y-1">
                  <Label>Amount ({effectiveCurrency()}) *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}

              {type === "dividend" && (
                <div className="space-y-1">
                  <Label>Purification %</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    max="100"
                    value={purification}
                    onChange={(e) => setPurification(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The impermissible share of this dividend, given to charity — separate
                    from zakat.
                  </p>
                </div>
              )}

              {!isAssetType && (
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label>Trade date *</Label>
                <Input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  When it executed — backdating is fine.
                </p>
              </div>

              <div className="space-y-1">
                <Label>Portfolio *</Label>
                <Select value={portfolioId || undefined} onValueChange={(v) => setPortfolioId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    {context.portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.is_default ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <BrokerSelect
              brokers={context.brokers}
              value={brokerId}
              onChange={setBrokerId}
              onBrokerCreated={(b) =>
                setContext((c) => (c ? { ...c, brokers: [...c.brokers, b] } : c))
              }
            />

            {/* Sell preview — engine code, cannot disagree with the server */}
            {type === "sell" && preview?.valid && (
              <p
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  preview.realizedPnl >= 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-red-50 text-red-700"
                )}
              >
                Realized P&L preview: {preview.realizedPnl >= 0 ? "+" : ""}
                {preview.realizedPnl} {effectiveCurrency()}
              </p>
            )}

            {/* More details */}
            <div>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                aria-expanded={moreOpen}
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")}
                />
                More details
              </button>
              {moreOpen && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Trade time</Label>
                    <Input
                      type="time"
                      value={tradeTime}
                      onChange={(e) => setTradeTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls same-day ordering.
                    </p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Note / strategy / tags</Label>
                    <Textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Why this decision? (full journaling arrives with the Journal)"
                    />
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Save transaction"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StaticAssetChip({
  label,
}: {
  label: { symbol: string; name: string; currency: string };
}) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <p className="text-sm font-medium">
        {label.symbol}
        <span className="ml-2 font-normal text-muted-foreground">{label.name}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {label.currency} · asset can’t be changed while editing
      </p>
    </div>
  );
}
