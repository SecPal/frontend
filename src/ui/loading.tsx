// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

function boundedCount(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function SkeletonStatus({ loadingLabel }: { loadingLabel: string }) {
  return <span className="sr-only">{loadingLabel}</span>;
}

function SectionSkeletonContent({
  rows,
  showHeader,
}: {
  rows: number;
  showHeader: boolean;
}) {
  return (
    <div data-slot="section-skeleton-content" aria-hidden="true">
      {showHeader ? (
        <div className="mb-5 space-y-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-4",
              index === rows - 1 ? "w-2/3 max-w-full" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  className,
  loadingLabel,
  sections = 3,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  sections?: number;
}) {
  const sectionCount = boundedCount(sections, 3);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="page-skeleton"
      className={cn("space-y-8", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: sectionCount }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-6 text-card-foreground"
          >
            <SectionSkeletonContent rows={4} showHeader />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionSkeleton({
  className,
  loadingLabel,
  rows = 4,
  showHeader = true,
  decorative = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  rows?: number;
  showHeader?: boolean;
  decorative?: boolean;
}) {
  if (decorative) {
    return (
      <div
        {...props}
        aria-hidden="true"
        data-slot="section-skeleton"
        className={cn(
          "rounded-lg border border-border bg-card p-6 text-card-foreground",
          className
        )}
      >
        <SectionSkeletonContent
          rows={boundedCount(rows, 4)}
          showHeader={showHeader}
        />
      </div>
    );
  }

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="section-skeleton"
      className={cn(
        "rounded-lg border border-border bg-card p-6 text-card-foreground",
        className
      )}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <SectionSkeletonContent
        rows={boundedCount(rows, 4)}
        showHeader={showHeader}
      />
    </div>
  );
}

export function TableSkeleton({
  className,
  loadingLabel,
  columns = 4,
  rows = 5,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  columns?: number;
  rows?: number;
}) {
  const columnCount = boundedCount(columns, 4);
  const rowCount = boundedCount(rows, 5);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="table-skeleton"
      className={cn("overflow-x-auto", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <table
        aria-hidden="true"
        className="w-full caption-bottom text-left text-sm text-foreground"
      >
        <thead className="text-muted-foreground">
          <tr>
            {Array.from({ length: columnCount }, (_, index) => (
              <th
                key={index}
                scope="col"
                className="border-b border-border px-2 py-2"
              >
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <td
                  key={columnIndex}
                  className="border-b border-border px-2 py-4"
                >
                  <Skeleton
                    className={cn("h-4", columnIndex === 0 ? "w-32" : "w-24")}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormSkeleton({
  className,
  loadingLabel,
  fields = 4,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  fields?: number;
}) {
  const fieldCount = boundedCount(fields, 4);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="form-skeleton"
      className={cn("space-y-6", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <div aria-hidden="true" className="space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

export function LoadingRegion({
  className,
  loading,
  loadingLabel,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  loading: boolean;
  loadingLabel: string;
}) {
  return (
    <div
      {...props}
      aria-busy={loading || undefined}
      data-slot="loading-region"
      className={cn("relative", className)}
    >
      {children}
      {loading ? (
        <span
          role="status"
          aria-label={loadingLabel}
          aria-live="polite"
          className="sr-only"
        >
          {loadingLabel}
        </span>
      ) : null}
    </div>
  );
}

export function Spinner({
  className,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof Loader2>, "aria-label"> & {
  "aria-label": string;
}) {
  return (
    <Loader2
      role="status"
      aria-label={ariaLabel}
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
