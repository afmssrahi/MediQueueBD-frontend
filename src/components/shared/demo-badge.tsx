import * as React from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DemoBadgeProps {
  label?: string;
  className?: string;
}

/**
 * The "this is demo data" pill.
 *
 * The document requires that simulated output is never presented as real, so
 * this badge appears on every screen that shows demo data or a simulated
 * result.
 */
export function DemoBadge({ label = "Demo data", className }: DemoBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <FlaskConical className="size-3" />
      {label}
    </Badge>
  );
}
