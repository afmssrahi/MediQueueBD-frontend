import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
}

/**
 * A single headline number.
 *
 * `value` accepts a skeleton while the data is loading, so the card never
 * collapses and reflows while a request is in flight.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            {typeof value === "string" || typeof value === "number" ? (
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            ) : (
              value
            )}
            {hint && (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          {Icon && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          )}
        </div>
        {trend && <StatTrend {...trend} />}
      </CardContent>
    </Card>
  );
}

function StatTrend({ value, label }: { value: number; label?: string }) {
  const Icon =
    value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone =
    value > 0
      ? "text-success"
      : value < 0
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <p className={cn("mt-3 flex items-center gap-1 text-xs", tone)}>
      <Icon className="size-3.5" />
      <span className="font-medium">
        {value > 0 ? "+" : ""}
        {value}%
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </p>
  );
}

/** A stat card that is still loading. */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
