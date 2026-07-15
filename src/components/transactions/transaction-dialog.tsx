"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { GlossaryTerm } from "@/components/ui/glossary-term";
import {
  decideClose,
  isDraftDirty,
  serializeDraft,
  submitOutcome,
  type DraftSnapshot,
} from "@/lib/transactions/draft";
import { buildTicketLine, parseFigure } from "@/lib/transactions/ticket";
import { markSettled } from "@/lib/transactions/settle";
import { AssetSearch, type SelectedAsset } from "./asset-search";
import { BrokerSelect } from "./broker-select";
import { TicketLine } from "./ticket-line";
import { TypeSegmentRow } from "./type-segment-row";

/**
 * Add/Edit Transaction dialog — Phase 5 "The Loop" write path (§9.2),
 * compacted in D3 (§11): segmented type row, live TicketLine (the user
 * confirms a sentence; it becomes the toast on save), save-settle moment
 * (the written row settles into Activity with the 2s highlight), ⌘/Ctrl+Enter
 * submits. One shell, per-type field groups, submit → server action →
 * services → engine trial recompute. Client validation is convenience; the
 * service layer is the law; engine messages render verbatim.
 */

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

  // Draft protection (Bug 1): snapshot taken after the dialog initializes;
  // any close request while dirty must confirm — never silently discard.
  const snapshotRef = useRef<string | null>(null);
  const armSnapshotRef = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
      // Initialization done — the NEXT committed render is the clean state
      // the dirty check compares against.
      armSnapshotRef.current = true;
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
    setConfirmDiscard(false);
    snapshotRef.current = null;
    armSnapshotRef.current = false;
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

  // ---- draft protection (Bug 1) -------------------------------------------

  const currentSnapshot = useCallback(
    (): DraftSnapshot => ({
      type,
      assetKey: activeAssetId,
      portfolioId,
      brokerId,
      quantity,
      price,
      amount,
      fees,
      currency,
      tradeDate,
      tradeTime,
      purification,
      notes,
    }),
    [
      type,
      activeAssetId,
      portfolioId,
      brokerId,
      quantity,
      price,
      amount,
      fees,
      currency,
      tradeDate,
      tradeTime,
      purification,
      notes,
    ]
  );

  // Capture the clean snapshot on the first committed render after init.
  useEffect(() => {
    if (armSnapshotRef.current) {
      armSnapshotRef.current = false;
      snapshotRef.current = serializeDraft(currentSnapshot());
    }
  });

  const hardClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  /** Every close path (Escape, backdrop, X, Cancel) funnels through here. */
  const requestClose = useCallback(() => {
    const decision = decideClose({
      dirty: isDraftDirty(currentSnapshot(), snapshotRef.current),
      saving,
    });
    if (decision === "ignore") return;
    if (decision === "confirm") {
      setConfirmDiscard(true);
      return;
    }
    hardClose();
  }, [currentSnapshot, saving, hardClose]);

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

  // The ticket line (§11) — one builder feeds the summary AND the toast.
  const activeAssetSymbol =
    type === "buy"
      ? (selectedAsset?.asset.symbol ??
        presetBuyAsset?.symbol ??
        edit?.assetLabel?.symbol ??
        null)
      : type === "sell"
        ? (sellSource?.asset.symbol ?? edit?.assetLabel?.symbol ?? null)
        : type === "dividend"
          ? (dividendSource?.asset.symbol ?? edit?.assetLabel?.symbol ?? null)
          : null;
  const ticket = useMemo(
    () =>
      buildTicketLine({
        type,
        assetSymbol: activeAssetSymbol,
        quantity: parseFigure(quantity),
        price: parseFigure(price),
        amount: parseFigure(amount),
        fees: Number(fees) || 0,
        currency: effectiveCurrency(),
        tradeDate,
        portfolioName:
          context?.portfolios.find((p) => p.id === portfolioId)?.name ?? null,
        brokerName: brokerId
          ? (context?.brokers.find((b) => b.id === brokerId)?.name ?? null)
          : null,
        realizedPnl:
          type === "sell" && preview?.valid ? preview.realizedPnl : null,
      }),
    // effectiveCurrency reads only state already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      type,
      activeAssetSymbol,
      quantity,
      price,
      amount,
      fees,
      currency,
      tradeDate,
      portfolioId,
      brokerId,
      context,
      preview,
      selectedAsset,
      presetBuyAsset,
      sellSource,
      dividendSource,
    ]
  );

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

    // Bug 1 contract (submitOutcome): failure keeps the dialog open with
    // every field intact and the ACTUAL server error visible; success
    // closes, clears the draft, and the revalidated routes (server-side)
    // plus router.refresh() update every read model.
    const outcome = submitOutcome(res);
    if (outcome.keepOpen) {
      setFormError(res.ok ? null : res.error);
      return;
    }

    localStorage.setItem("htj.lastPortfolio", portfolioId);
    if (brokerId) localStorage.setItem("htj.lastBroker", brokerId);

    // Save-settle moment (§11): the written row settles into Activity with
    // the 2s highlight; the ticket line becomes the toast content.
    if (res.ok) markSettled(res.data.id);
    if (outcome.toast) toast(ticket?.toast ?? outcome.toast);
    reset();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Radix funnels EVERY internal close request here (Escape, backdrop,
        // the X button). A dirty draft is never silently discarded (Bug 1) —
        // the dialog stays open until requestClose decides.
        if (!next) requestClose();
      }}
    >
      {/* §11: desktop dialog 560px; mobile full sheet (bottom-anchored). */}
      <DialogContent className="max-w-[560px] max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none">
        {confirmDiscard && (
          <div
            role="alertdialog"
            aria-label="Discard this unsaved transaction?"
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/95 p-6"
          >
            <div className="w-full max-w-xs space-y-3 text-center">
              <p className="text-sm font-semibold">Discard this unsaved transaction?</p>
              <p className="text-xs text-ink-muted">
                The details you entered will be lost.
              </p>
              <div className="flex justify-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDiscard(false)}
                  autoFocus
                >
                  Keep editing
                </Button>
                <Button size="sm" variant="destructive" onClick={hardClose}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
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
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
            onKeyDown={(e) => {
              // Keyboard completeness (§11): ⌘/Ctrl+Enter saves from any field.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.requestSubmit();
              }
            }}
          >
            {/* Type switcher — one compact segmented row (§11) */}
            {!isEdit && (
              <TypeSegmentRow
                value={type}
                sellDisabled={openPositions.length === 0}
                onChange={(t) => {
                  setType(t);
                  setPositionAssetId("");
                  setFormError(null);
                }}
              />
            )}

            {SACRED_COPY[type] && (
              // Sacred types keep their copy; confirmation carries the brass accent (§11).
              <p className="rounded-md bg-sacred-surface px-3 py-2 text-sm text-sacred">
                ◆ {SACRED_COPY[type]}
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
                      You hold {sellSource.quantity} @ {sellSource.average_cost}{" "}
                      <GlossaryTerm k="average_cost">avg</GlossaryTerm> (
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
                    The impermissible share of this dividend, given to charity —{" "}
                    <GlossaryTerm k="purification">what is purification?</GlossaryTerm>
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

            {/* The ticket line (§11) — sell P&L preview rides here (engine code,
                cannot disagree with the server). */}
            <TicketLine ticket={ticket} />

            {formError && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
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
