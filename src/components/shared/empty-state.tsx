"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

/** Shown when a request succeeded but returned nothing. */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {description && (
            <p className="max-w-md text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Shown when a request failed. */
export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card className={cn("border-destructive/40", className)}>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-5 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title ?? "We could not load this"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description ??
              "The request failed. Check your connection and try again."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
