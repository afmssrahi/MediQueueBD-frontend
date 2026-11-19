"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonRows } from "@/components/shared/skeleton-rows";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** The value used for sorting. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** The fields searched when `searchable` is on. */
  searchFields?: (row: T) => string;
  /** Default sort. */
  defaultSort?: { key: string; direction: "asc" | "desc" };
  pageSize?: number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  /** Rendered instead of the table when the list is empty. */
  renderEmpty?: () => React.ReactNode;
}

type SortDirection = "asc" | "desc";

/**
 * The shared list component.
 *
 * Every list screen in the app uses this so that search, sorting and
 * pagination behave identically everywhere. Sorting is client-side over the
 * rows it is given; the service layer does the paging when a list is large
 * enough to need it.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchable = false,
  searchPlaceholder = "Search…",
  searchFields,
  defaultSort,
  pageSize = 10,
  isLoading = false,
  emptyTitle = "No results found",
  emptyDescription,
  toolbar,
  onRowClick,
  className,
  renderEmpty,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{
    key: string;
    direction: SortDirection;
  } | null>(defaultSort ?? null);
  const [page, setPage] = React.useState(1);

  // A new search or a shorter result set returns to the first page. Adjusting
  // the page during render keeps it in step without a setState in an effect.
  const [lastResetKey, setLastResetKey] = React.useState("");
  const resetKey = `${query}::${rows.length}`;
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setPage(1);
  }

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return rows;

    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = searchFields
        ? searchFields(row)
        : columns
            .map((column) => {
              const value = column.sortValue?.(row);
              return value === undefined || value === null
                ? ""
                : String(value);
            })
            .join(" ");

      return haystack.toLowerCase().includes(needle);
    });
  }, [rows, query, searchable, searchFields, columns]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortValue) return filtered;

    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [filtered, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const visible = React.useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  if (!isLoading && rows.length === 0 && renderEmpty) {
    return <>{renderEmpty()}</>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="sm:max-w-xs"
              aria-label={searchPlaceholder}
            />
          ) : (
            <div />
          )}
          {toolbar && (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          )}
        </div>
      )}

      {isLoading ? (
        <SkeletonRows rows={5} columns={Math.min(columns.length, 5)} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={searchable && query ? undefined : undefined}
        />
      ) : (
        <>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => {
                    const isSorted = sort?.key === column.key;
                    const sortable = Boolean(column.sortValue);
                    return (
                      <TableHead
                        key={column.key}
                        className={column.headerClassName}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.key)}
                            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          >
                            {column.header}
                            {isSorted ? (
                              sort.direction === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={
                      onRowClick ? () => onRowClick(row) : undefined
                    }
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={column.className}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {sorted.length > pageSize && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, sorted.length)} of{" "}
                {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={safePage >= totalPages}
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
