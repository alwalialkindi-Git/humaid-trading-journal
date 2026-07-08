"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { AssetRow } from "@/lib/services";
import { createCustomAssetAction } from "@/app/(app)/portfolio/actions";
import { EXCHANGES } from "@/lib/market-data/exchange-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Custom asset creation — the manual tier (§8.7): ADX listings (no provider
 * coverage in M1), private sukuk, local funds, real estate. UAE exchanges
 * are surfaced first in the picker.
 */

export interface CustomAssetPrefillInput {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  country?: string;
}

// UAE first, then the rest, then "private / unlisted".
const EXCHANGE_OPTIONS = [
  "ADX",
  "DFM",
  "NASDAQ_DUBAI",
  "TADAWUL",
  "NASDAQ",
  "NYSE",
  "NYSE_ARCA",
  "CRYPTO",
] as const;

const ASSET_CLASSES = [
  ["stock", "Stock"],
  ["etf", "ETF"],
  ["sukuk", "Sukuk"],
  ["fund", "Fund"],
  ["crypto", "Crypto"],
  ["commodity", "Commodity (gold/silver)"],
  ["other", "Other"],
] as const;

export function CustomAssetPanel({
  prefill,
  onCreated,
  onCancel,
}: {
  prefill: CustomAssetPrefillInput | null;
  onCreated: (asset: AssetRow) => void;
  onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState(prefill?.symbol ?? "");
  const [name, setName] = useState(prefill?.name ?? "");
  const [exchange, setExchange] = useState(prefill?.exchange ?? "ADX");
  const [currency, setCurrency] = useState(
    prefill?.currency ?? EXCHANGES[prefill?.exchange ?? "ADX"]?.currency ?? "AED"
  );
  const [assetClass, setAssetClass] = useState("stock");
  const [sector, setSector] = useState("");
  const [isin, setIsin] = useState("");
  const [price, setPrice] = useState("");
  const [priceDate, setPriceDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceNote, setSourceNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleExchangeChange(code: string) {
    setExchange(code);
    const info = EXCHANGES[code];
    if (info && info.currency !== "*") setCurrency(info.currency);
  }

  async function handleCreate() {
    setError(null);
    if (!symbol.trim() || !name.trim()) {
      setError("Symbol and name are required.");
      return;
    }
    setBusy(true);
    const res = await createCustomAssetAction({
      symbol: symbol.trim(),
      name: name.trim(),
      exchange: exchange === "PRIVATE" ? "" : exchange,
      currency,
      asset_class: assetClass as never,
      sector: sector.trim() || null,
      isin: isin.trim() || null,
      latest_price: price === "" ? null : Number(price),
      price_as_of: price === "" ? null : new Date(`${priceDate}T12:00:00Z`).toISOString(),
      price_source_note: sourceNote.trim() || null,
      country: prefill?.country ?? null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated(res.data);
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-medium">Create custom asset</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Symbol *</Label>
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="ADIB" />
        </div>
        <div className="space-y-1">
          <Label>Company / asset name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Abu Dhabi Islamic Bank" />
        </div>
        <div className="space-y-1">
          <Label>Exchange</Label>
          <Select value={exchange} onValueChange={handleExchangeChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXCHANGE_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {EXCHANGES[code].name} ({code})
                </SelectItem>
              ))}
              <SelectItem value="PRIVATE">Private / unlisted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
        </div>
        <div className="space-y-1">
          <Label>Asset class</Label>
          <Select value={assetClass} onValueChange={setAssetClass}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASSET_CLASSES.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Sector (optional)</Label>
          <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Islamic Financials" />
        </div>
        <div className="space-y-1">
          <Label>ISIN (optional)</Label>
          <Input value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase())} maxLength={12} />
        </div>
        <div className="space-y-1">
          <Label>Latest price</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="13.15"
          />
        </div>
        <div className="space-y-1">
          <Label>Price date</Label>
          <Input type="date" value={priceDate} onChange={(e) => setPriceDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Price source (optional)</Label>
          <Input
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
            placeholder="e.g. ADX website close"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Manual assets participate fully in your portfolio, P&L, zakat, and screening —
        you just update the price yourself.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={handleCreate} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create asset
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>
          Back to search
        </Button>
      </div>
    </div>
  );
}
