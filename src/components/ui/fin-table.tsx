"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  densityStorageKey,
  nextSort,
  sortRows,
  type FinDensity,
  type SortState,
} from "@/lib/fin-table";

/**
 * FinTable — the flagship financial table (AMANAH §5, sprint §22).
 *
 * Anatomy: toolbar (filters left · density/export right) → sticky header →
 * rows (44px comfortable / 32px compact) → footer aggregates. Columns declare
 * one of the CLOSED column types; alignment and formatting discipline follow
 * from the type, not per-callsite taste. Mobile renders the DECLARED card
 * transform — the primary figure is stated per table, never guessed (§5).
 *
 * Behavior: single-column sort with a visible indicator; density is a
 * table-level remembered preference (localStorage); row hover raises the
 * border (no zebra); rows are keyboard-focusable and Enter opens the row.
 */

export type FinColumnType =
  | "entity"
  | "money"
  | "quantity"
  | "unit-price"
  | "delta"
  | "percent"
  | "date"
  | "badge"
  | "text"
  | "actions";

const RIGHT_ALIGNED: ReadonlySet<FinColumnType> = new Set([
  "money",
  "quantity",
  "unit-price",
  "delta",
  "percent",
  "actions",
]);

export interface FinCellContext {
  density: FinDensity;
}

export interface FinRowMeta {
  /** True for the just-written row while the settle highlight is owed. */
  highlight: boolean;
}

export interface FinColumn<T> {
  key: string;
  header: React.ReactNode;
  type: FinColumnType;
  cell: (row: T, ctx: FinCellContext) => React.ReactNode;
  /** Present ⇒ the column is sortable. Nulls sort last (lib/fin-table). */
  sortValue?: (row: T) => string | number | null;
  /** Pre-computed footer aggregate (e.g. per-currency Σ) — labeled by caller. */
  footer?: React.ReactNode;
  /** Extra classes on both th and td (widths etc.). */
  className?: string;
  /** Hidden in compact density (secondary columns). */
  hideCompact?: boolean;
}

export interface FinTableProps<T> {
  /** Stable id — density preference is remembered per table. */
  tableId: string;
  columns: FinColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  defaultSort?: SortState;
  /** Group label per row (e.g. month). Grouping expects pre-sorted rows and disables sorting. */
  groupBy?: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowAriaLabel?: (row: T) => string;
  /** Toolbar left side (filters). The density toggle renders on the right. */
  toolbar?: React.ReactNode;
  /** The §5 mobile card transform — declared once per table. The card styles
   * its own settle highlight from meta (cards own their background). */
  mobileCard: (row: T, meta: FinRowMeta) => React.ReactNode;
  /** Row (by rowKey) the user just wrote — settles in with the 2s highlight
   * (AMANAH motion verb "settle", sprint §11). */
  highlightKey?: string | null;
  /** Optional line under the table (as-of caption etc.). */
  footnote?: React.ReactNode;
  className?: string;
}

const FinDensityContext = React.createContext<FinDensity>("comfortable");
export function useFinDensity(): FinDensity {
  return React.useContext(FinDensityContext);
}

/**
 * Density preference store — localStorage-backed external store so the
 * remembered value flows through useSyncExternalStore (no setState-in-effect;
 * SSR snapshot is always "comfortable", corrected after hydration).
 */
const densityListeners = new Set<() => void>();
function subscribeDensity(cb: () => void): () => void {
  densityListeners.add(cb);
  return () => densityListeners.delete(cb);
}
function readDensity(tableId: string): FinDensity {
  const stored = window.localStorage.getItem(densityStorageKey(tableId));
  return stored === "compact" ? "compact" : "comfortable";
}
function writeDensity(tableId: string, density: FinDensity): void {
  window.localStorage.setItem(densityStorageKey(tableId), density);
  for (const cb of densityListeners) cb();
}

export function FinTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  defaultSort,
  groupBy,
  onRowClick,
  rowAriaLabel,
  toolbar,
  mobileCard,
  highlightKey,
  footnote,
  className,
}: FinTableProps<T>) {
  const density = React.useSyncExternalStore(
    subscribeDensity,
    () => readDensity(tableId),
    () => "comfortable" as FinDensity
  );
  const [sort, setSort] = React.useState<SortState | null>(defaultSort ?? null);

  const changeDensity = (next: FinDensity) => writeDensity(tableId, next);

  const sortable = !groupBy;
  const sorted = React.useMemo(() => {
    if (!sortable || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return sortRows(rows, col.sortValue, sort.dir);
  }, [rows, columns, sort, sortable]);

  const visibleColumns = columns.filter(
    (c) => !(density === "compact" && c.hideCompact)
  );
  const hasFooter = visibleColumns.some((c) => c.footer != null);
  const ctx: FinCellContext = { density };
  const compact = density === "compact";

  return (
    <FinDensityContext.Provider value={density}>
      <div className={className}>
        {/* Toolbar — filters left · density + export seat right */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          <div className="hidden items-center gap-2 md:flex">
            <div
              className="flex overflow-hidden rounded-md border"
              role="group"
              aria-label="Table density"
            >
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => changeDensity(d)}
                  aria-pressed={density === d}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    density === d
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled
              title="Exports arrive with Reports (M4)."
              className="cursor-not-allowed px-2 py-1 text-xs font-medium text-ink-faint"
            >
              Export
            </button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="relative hidden w-full overflow-x-auto scrollbar-thin md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {visibleColumns.map((col) => {
                  const right = RIGHT_ALIGNED.has(col.type);
                  const isSorted = sortable && sort?.key === col.key;
                  const canSort = sortable && col.sortValue != null;
                  return (
                    <th
                      key={col.key}
                      aria-sort={
                        isSorted
                          ? sort!.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cn(
                        "sticky top-0 z-10 h-9 bg-card px-3 align-middle text-[11px] font-semibold uppercase tracking-wide text-ink-muted",
                        right ? "text-right" : "text-left",
                        col.className
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => setSort((s) => nextSort(s, col.key))}
                          className={cn(
                            "inline-flex items-center gap-1 uppercase tracking-wide outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                            isSorted && "text-foreground"
                          )}
                        >
                          {col.header}
                          <span aria-hidden className={cn(!isSorted && "invisible")}>
                            {sort?.dir === "asc" && isSorted ? "↑" : "↓"}
                          </span>
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const groupLabel = groupBy?.(row);
                const prevLabel = i > 0 ? groupBy?.(sorted[i - 1]) : undefined;
                const showGroup = groupBy && groupLabel !== prevLabel;
                return (
                  <React.Fragment key={rowKey(row)}>
                    {showGroup && (
                      <tr className="border-b bg-surface-sunken">
                        <td
                          colSpan={visibleColumns.length}
                          className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
                        >
                          {groupLabel}
                        </td>
                      </tr>
                    )}
                    <tr
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={rowAriaLabel?.(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === "Enter") onRowClick(row);
                            }
                          : undefined
                      }
                      className={cn(
                        "border-b transition-colors",
                        onRowClick &&
                          "cursor-pointer outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/50",
                        highlightKey != null &&
                          rowKey(row) === highlightKey &&
                          "animate-settle"
                      )}
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "whitespace-nowrap px-3 align-middle",
                            compact ? "h-8 py-0 text-xs" : "h-11 py-0",
                            RIGHT_ALIGNED.has(col.type) ? "text-right" : "text-left",
                            col.className
                          )}
                        >
                          {col.cell(row, ctx)}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            {hasFooter && (
              <tfoot>
                <tr className="border-t bg-surface-sunken">
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2 text-sm font-medium",
                        RIGHT_ALIGNED.has(col.type) ? "text-right" : "text-left",
                        col.className
                      )}
                    >
                      {col.footer}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile — the declared card transform (§5) */}
        <div className="space-y-3 md:hidden">
          {sorted.map((row, i) => {
            const groupLabel = groupBy?.(row);
            const prevLabel = i > 0 ? groupBy?.(sorted[i - 1]) : undefined;
            const showGroup = groupBy && groupLabel !== prevLabel;
            return (
              <React.Fragment key={rowKey(row)}>
                {showGroup && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {groupLabel}
                  </p>
                )}
                {mobileCard(row, {
                  highlight: highlightKey != null && rowKey(row) === highlightKey,
                })}
              </React.Fragment>
            );
          })}
        </div>

        {footnote && <div className="mt-2 text-xs text-ink-muted">{footnote}</div>}
      </div>
    </FinDensityContext.Provider>
  );
}
