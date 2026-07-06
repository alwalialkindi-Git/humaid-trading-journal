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

const TONE_STYLES: Record<InsightTone, { icon: typeof Lightbulb; iconClass: string }> = {
  positive: { icon: TrendingUp, iconClass: "bg-emerald-50 text-emerald-700" },
  negative: { icon: TrendingDown, iconClass: "bg-red-50 text-red-700" },
  warning: { icon: AlertTriangle, iconClass: "bg-amber-50 text-amber-700" },
  neutral: { icon: Lightbulb, iconClass: "bg-slate-100 text-slate-700" },
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
  columns?: 2 | 3;
}) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Insights will appear here once you log a few trades and holdings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"
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
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {insight.detail}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
