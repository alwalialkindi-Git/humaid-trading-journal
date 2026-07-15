"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SymbolSearchResult } from "@/lib/market-data/types";
import type { AdxNotice, SearchResponse } from "@/lib/market-data/service";
import type { AssetRow } from "@/lib/services";
import { ensureAssetFromSearchAction } from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldIcon } from "@/components/ui/shield-badge";
import { CustomAssetPanel, type CustomAssetPrefillInput } from "./custom-asset-panel";

/**
 * Asset search combobox — implements the binding UAE search rules (§2.4):
 * every result shows exchange/country/currency; warned cross-exchange
 * results need explicit confirmation; ADX queries surface the prefilled
 * "create custom UAE asset" path; the custom path is never hidden.
 *
 * D3 (§11): results are table-aligned (shield placeholder / symbol / name /
 * exchange / ccy columns); Escape clears the open results before it can
 * reach the dialog's close guard. All selection logic unchanged.
 */

export interface SelectedAsset {
  asset: AssetRow;
  quotePrice: number | null;
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; response: SearchResponse }
  | { kind: "confirm-warned"; result: SymbolSearchResult; response: SearchResponse }
  | { kind: "custom"; prefill: CustomAssetPrefillInput | null }
  | { kind: "ensuring" };

export function AssetSearch({
  selected,
  onSelect,
  onClear,
  consumeEscapeRef,
}: {
  selected: SelectedAsset | null;
  onSelect: (selection: SelectedAsset) => void;
  onClear: () => void;
  /** The dialog's Escape hook (§11): Radix handles Escape at the document
   * level BEFORE the input ever sees it, so the dialog asks the search to
   * consume it first. Returns true when open results/query were cleared —
   * the dialog then keeps itself open. */
  consumeEscapeRef?: React.MutableRefObject<(() => boolean) | null>;
}) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const listboxId = useId();

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    if (q.trim().length < 1) {
      setPhase({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: "loading" });
    setError(null);
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Search failed");
      const response = (await res.json()) as SearchResponse;
      setPhase({ kind: "results", response });
      setActiveIndex(response.results.length > 0 ? 0 : -1);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(
        "Live search is unavailable right now — you can still create a custom asset."
      );
      setPhase({ kind: "results", response: emptyResponse(q) });
    }
  }, []);

  // 300ms debounce
  useEffect(() => {
    const t = setTimeout(() => void search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  // Escape-consumption contract with the dialog (no deps: the callback must
  // always close over the CURRENT phase/query/selected).
  useEffect(() => {
    if (!consumeEscapeRef) return;
    consumeEscapeRef.current = () => {
      if (selected) return false; // chip shown — nothing to dismiss
      if (phase.kind === "results" || phase.kind === "loading" || query) {
        setQuery("");
        setPhase({ kind: "idle" });
        return true;
      }
      return false;
    };
    return () => {
      consumeEscapeRef.current = null;
    };
  });

  async function ensure(result: SymbolSearchResult, confirmWarned: boolean) {
    setPhase({ kind: "ensuring" });
    setError(null);
    const res = await ensureAssetFromSearchAction(result, confirmWarned);
    if (!res.ok) {
      setError(res.error);
      setPhase({ kind: "idle" });
      return;
    }
    onSelect({ asset: res.data.asset, quotePrice: res.data.quotePrice });
  }

  function pick(result: SymbolSearchResult, response: SearchResponse) {
    if (result.warning) {
      // §8.8: a warned cross-exchange hit is NEVER selected directly.
      setPhase({ kind: "confirm-warned", result, response });
      return;
    }
    void ensure(result, false);
  }

  function handleKeyDown(e: React.KeyboardEvent, response: SearchResponse) {
    if (e.key === "Escape") {
      // Keyboard completeness (§11): Escape dismisses the results first —
      // it must not fall through to the dialog's close guard.
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      setPhase({ kind: "idle" });
      return;
    }
    const n = response.results.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? -1 : (i + 1) % n));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? -1 : (i - 1 + n) % n));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < n) {
      e.preventDefault();
      const result = response.results[activeIndex];
      // Enter never selects a warned result (§8.8) — it opens the confirm step.
      pick(result, response);
    }
  }

  // ---- selected chip -------------------------------------------------------

  if (selected) {
    const a = selected.asset;
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-accent/50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {a.symbol}
            <span className="ml-2 font-normal text-muted-foreground">{a.name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {a.exchange || "private"} · {a.currency}
            {a.data_tier === "manual_custom" && (
              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                manual price
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            setQuery("");
            setPhase({ kind: "idle" });
          }}
          className="rounded p-1 hover:bg-muted"
          aria-label={`Clear selected asset ${a.symbol}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ---- custom-asset panel --------------------------------------------------

  if (phase.kind === "custom") {
    return (
      <CustomAssetPanel
        prefill={phase.prefill}
        onCreated={(asset) => onSelect({ asset, quotePrice: asset.latest_price })}
        onCancel={() => setPhase({ kind: "idle" })}
      />
    );
  }

  // ---- confirm warned result -------------------------------------------------

  if (phase.kind === "confirm-warned") {
    const r = phase.result;
    return (
      <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{r.warning}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPhase({ kind: "results", response: phase.response })}
          >
            Go back
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void ensure(r, true)}>
            Use {r.symbol} ({r.exchange.name}) anyway
          </Button>
        </div>
      </div>
    );
  }

  // ---- search input + results ---------------------------------------------------

  const response = phase.kind === "results" ? phase.response : null;

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        {phase.kind === "loading" || phase.kind === "ensuring" ? (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
        <Input
          role="combobox"
          aria-expanded={Boolean(response)}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          value={query}
          disabled={phase.kind === "ensuring"}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => response && handleKeyDown(e, response)}
          placeholder="Search any symbol or name — US, Dubai (DFM), Saudi, crypto…"
          className="pl-8"
          autoFocus
        />
      </div>

      {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}

      {response && (
        <div className="mt-2 overflow-hidden rounded-md border" role="presentation">
          {/* ADX notice — the primary path when the query is a known ADX name */}
          {response.adxNotice && (
            <AdxNoticeCard
              notice={response.adxNotice}
              onCreate={(prefill) => setPhase({ kind: "custom", prefill })}
            />
          )}

          <ul id={listboxId} role="listbox" aria-label="Search results">
            {response.results.map((r, i) => (
              <li
                key={`${r.providerSymbol}-${i}`}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <button
                  type="button"
                  onClick={() => pick(r, response)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    // §11: table-aligned result columns — shield placeholder /
                    // symbol / name / exchange / country·ccy.
                    "grid w-full grid-cols-[1rem_5.5rem_minmax(0,1fr)_auto_6.5rem] items-center gap-x-2.5 px-3 py-2.5 text-left text-sm",
                    i === activeIndex ? "bg-accent" : "hover:bg-muted/60",
                    r.warning && "bg-amber-50/70 hover:bg-amber-100/70"
                  )}
                >
                  <span
                    className="text-compliance-unknown"
                    title="Not screened — screening arrives with M3"
                  >
                    <ShieldIcon state="not_reviewed" />
                    <span className="sr-only">Not screened</span>
                  </span>
                  <span className="truncate font-medium">{r.symbol}</span>
                  <span className="truncate text-muted-foreground">{r.name}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
                    {r.exchange.code}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    {r.exchange.country} · {r.exchange.currency}
                  </span>
                  {r.warning && (
                    <span className="col-[2/-1] mt-0.5 flex items-center gap-1 text-xs text-amber-800">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Different exchange — needs confirmation
                    </span>
                  )}
                </button>
              </li>
            ))}
            {response.results.length === 0 && !response.adxNotice && (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                No matches for “{response.query}”.
              </li>
            )}
          </ul>

          {/* The custom path is never hidden (§2.4 rule 4). */}
          <button
            type="button"
            onClick={() => setPhase({ kind: "custom", prefill: null })}
            className="flex w-full items-center gap-2 border-t bg-muted/40 px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Can’t find it? Create a custom asset
          </button>
        </div>
      )}
    </div>
  );
}

function AdxNoticeCard({
  notice,
  onCreate,
}: {
  notice: AdxNotice;
  onCreate: (prefill: CustomAssetPrefillInput) => void;
}) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-3">
      <p className="text-sm text-amber-900">{notice.message}</p>
      <Button
        type="button"
        size="sm"
        className="mt-2"
        onClick={() =>
          onCreate({
            symbol: notice.prefill.symbol,
            name: notice.prefill.name,
            exchange: notice.prefill.exchange,
            currency: notice.prefill.currency,
            country: notice.prefill.country,
          })
        }
      >
        <Plus className="h-4 w-4" /> Create {notice.prefill.symbol} as a custom UAE asset
      </Button>
    </div>
  );
}

function emptyResponse(query: string): SearchResponse {
  return {
    provider: "none",
    query,
    results: [],
    adxNotice: null,
    customAssetPath: true,
    usedFallback: true,
  };
}
