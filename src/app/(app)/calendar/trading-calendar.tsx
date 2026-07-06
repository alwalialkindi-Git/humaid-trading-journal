"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dailyPnlMap, tradePnl } from "@/lib/calculations";
import {
  formatCurrency,
  formatSignedCurrency,
  pnlColor,
} from "@/lib/format";
import type { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TradingCalendar({
  trades,
  currency,
}: {
  trades: Trade[];
  currency: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const pnlByDay = useMemo(() => dailyPnlMap(trades), [trades]);

  // Trades that touched each day (entry or exit)
  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      for (const date of [t.entry_date, t.exit_date]) {
        if (!date) continue;
        const key = date.slice(0, 10);
        const list = map.get(key) ?? [];
        if (!list.includes(t)) list.push(t);
        map.set(key, list);
      }
    }
    return map;
  }, [trades]);

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: (string | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toKey(new Date(year, month, i + 1))
    ),
  ];

  const monthLabel = firstOfMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const monthTotal = [...pnlByDay.entries()]
    .filter(([key]) => key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .reduce((s, [, v]) => s + v, 0);

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDay(null);
  }

  const selectedTrades = selectedDay ? (tradesByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{monthLabel}</CardTitle>
            <CardDescription>
              Month realized P&L:{" "}
              <span className={pnlColor(monthTotal)}>
                {formatSignedCurrency(monthTotal, currency)}
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => changeMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((key, i) => {
              if (!key) return <div key={`empty-${i}`} />;
              const pnl = pnlByDay.get(key);
              const hasTrades = tradesByDay.has(key);
              const dayNum = Number(key.slice(8, 10));
              const isToday = key === toKey(today);
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition-colors sm:aspect-auto sm:min-h-16 sm:py-1.5",
                    pnl != null && pnl > 0 && "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
                    pnl != null && pnl < 0 && "border-red-200 bg-red-50 hover:bg-red-100",
                    pnl == null && hasTrades && "border-slate-200 bg-slate-50 hover:bg-slate-100",
                    pnl == null && !hasTrades && "border-transparent hover:bg-muted/60",
                    isSelected && "ring-2 ring-ring",
                    isToday && "font-bold"
                  )}
                >
                  <span className={cn("leading-none", isToday && "text-primary")}>
                    {dayNum}
                  </span>
                  {pnl != null && (
                    <span
                      className={cn(
                        "mt-1 hidden leading-none sm:block",
                        pnl > 0 ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {pnl > 0 ? "+" : ""}
                      {Math.round(pnl)}
                    </span>
                  )}
                  {pnl == null && hasTrades && (
                    <span className="mt-1 hidden text-muted-foreground sm:block">•</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-emerald-200 bg-emerald-50" />
              Profit day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-red-200 bg-red-50" />
              Loss day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-slate-200 bg-slate-50" />
              Activity, no realized P&L
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Day detail */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDay
              ? // Parse Y-M-D manually — new Date("YYYY-MM-DD") is UTC and can
                // shift to the previous day in negative-offset timezones.
                new Date(
                  Number(selectedDay.slice(0, 4)),
                  Number(selectedDay.slice(5, 7)) - 1,
                  Number(selectedDay.slice(8, 10))
                ).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Select a day"}
          </CardTitle>
          <CardDescription>
            {selectedDay
              ? `${selectedTrades.length} trade${selectedTrades.length === 1 ? "" : "s"} touched this day`
              : "Click a day to see its trades"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedDay && selectedTrades.length === 0 && (
            <p className="text-sm text-muted-foreground">No trades on this day.</p>
          )}
          {selectedTrades.map((t) => {
            const pnl = tradePnl(t);
            const entered = t.entry_date.slice(0, 10) === selectedDay;
            const exited = t.exit_date?.slice(0, 10) === selectedDay;
            return (
              <Link
                key={t.id}
                href={`/trades/${t.id}/edit`}
                className="block rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.symbol}</p>
                  <Badge variant="secondary">
                    {entered && exited
                      ? "entry + exit"
                      : entered
                        ? "entry"
                        : "exit"}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t.quantity} @ {formatCurrency(t.entry_price, currency)}
                  </span>
                  {t.trade_status === "closed" && pnl != null && (
                    <span className={pnlColor(pnl)}>
                      {formatSignedCurrency(pnl, currency)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
