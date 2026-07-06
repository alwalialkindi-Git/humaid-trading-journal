import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tracking-tight", valueClassName)}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
