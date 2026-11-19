"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchInputProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
  containerClassName?: string;
}

/** A search field with a clear button. */
export function SearchInput({
  className,
  containerClassName,
  onClear,
  value,
  ...props
}: SearchInputProps) {
  const showClear = Boolean(value);

  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className={cn("pl-8", showClear && "pr-8", className)}
        value={value}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
