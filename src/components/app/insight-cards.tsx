import {
  Lightbulb,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Insight, InsightTone } from "@/lib/insights";
import { cn } from "@/lib/utils";

// Token-mapped tones (D4 restyle): dual-theme safe, never hardcoded tints.
const TONE_STYLES: Record<InsightTone, { icon: typeof Lightbulb; iconClass: string }> = {
  positive: { icon: TrendingUp, iconClass: "bg-surface-sunken text-pnl-up" },
  negative: { icon: TrendingDown, iconClass: "bg-surface-sunken text-pnl-down" },
  warning: { icon: AlertTriangle, iconClass: "bg-warn-surface text-warn" },
  neutral: { icon: Lightbulb, iconClass: "bg-surface-sunken text-ink-muted" },
};

/**
 * Insight cards. Currently powered by rule-based analysis (lib/insights.ts);
 * designed so a real AI provider can replace the generator without touching
 * this component.
 */
export function InsightCards({
  insights,
  columns = 3,
}: {
  insights: Insight[];
  /** 1 = stacked (sidebar seat on the dashboard). */
  columns?: 1 | 2 | 3;
}) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-ink-muted">
          <Sparkles className="h-4 w-4" />
          Insights appear as your ledger grows.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 3 && "sm:grid-cols-2 xl:grid-cols-3",
        columns === 2 && "sm:grid-cols-2"
      )}
    >
      {insights.map((insight) => {
        const tone = TONE_STYLES[insight.tone];
        return (
          <Card key={insight.id}>
            <CardContent className="p-5">
              <div
                className={cn(
                  "mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg",
                  tone.iconClass
                )}
              >
                <tone.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold leading-snug">{insight.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                {insight.detail}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
