// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect } from "react";
import { Trans, t } from "@lingui/macro";
import { Button } from "./button";
import { Badge } from "./badge";
import { Heading, Subheading } from "./heading";
import { Text } from "./text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import type { GuardBook, GuardBookReport } from "../types/organizational";
import {
  listGuardBooks,
  deleteGuardBook,
  getGuardBookReports,
  deleteGuardBookReport,
  exportGuardBookReport,
} from "../services/guardBookApi";

/**
 * Icon components
 */
function BookOpenIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function DocumentTextIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function ArrowDownTrayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date range for display
 */
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return `${startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

interface GuardBookCardProps {
  guardBook: GuardBook;
  onSelect?: (guardBook: GuardBook) => void;
  onEdit?: (guardBook: GuardBook) => void;
  onDelete?: (guardBook: GuardBook) => void;
  onGenerateReport?: (guardBook: GuardBook) => void;
  isSelected?: boolean;
}

/**
 * Card component for displaying guard book
 */
function GuardBookCard({
  guardBook,
  onSelect,
  onEdit,
  onDelete,
  onGenerateReport,
  isSelected = false,
}: GuardBookCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
      }`}
      onClick={() => onSelect?.(guardBook)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(guardBook);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              guardBook.is_active
                ? "bg-green-100 dark:bg-green-900/50"
                : "bg-gray-100 dark:bg-gray-800"
            }`}
          >
            <BookOpenIcon
              className={`h-6 w-6 ${
                guardBook.is_active
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {guardBook.title}
            </h4>
            {guardBook.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                {guardBook.description}
              </p>
            )}
          </div>
        </div>
        <Badge color={guardBook.is_active ? "green" : "zinc"}>
          {guardBook.is_active ? (
            <Trans>Active</Trans>
          ) : (
            <Trans>Inactive</Trans>
          )}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        {onGenerateReport && (
          <Button
            plain
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onGenerateReport(guardBook);
            }}
            className="flex items-center gap-1.5 text-sm"
          >
            <DocumentTextIcon className="h-4 w-4" />
            <Trans>Generate Report</Trans>
          </Button>
        )}
        <div className="flex-1" />
        {onEdit && (
          <Button
            plain
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onEdit(guardBook);
            }}
            aria-label={t`Edit ${guardBook.title}`}
            className="p-1"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
            </svg>
          </Button>
        )}
        {onDelete && (
          <Button
            plain
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onDelete(guardBook);
            }}
            aria-label={t`Delete ${guardBook.title}`}
            className="p-1 text-red-600 hover:text-red-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79"
              />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}

interface ReportListProps {
  guardBookId: string;
  onExport?: (report: GuardBookReport) => void;
  onDelete?: (report: GuardBookReport) => void;
}

/**
 * List component for displaying guard book reports
 */
function ReportList({ guardBookId, onExport, onDelete }: ReportListProps) {
  const [reports, setReports] = useState<GuardBookReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getGuardBookReports(guardBookId);
      setReports(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Failed to load reports`);
    } finally {
      setIsLoading(false);
    }
  }, [guardBookId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExport = useCallback(
    async (report: GuardBookReport) => {
      setIsExporting(report.id);
      try {
        const blob = await exportGuardBookReport(report.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${report.report_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onExport?.(report);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t`Failed to export report`
        );
      } finally {
        setIsExporting(null);
      }
    },
    [onExport]
  );

  const handleDelete = useCallback(
    async (report: GuardBookReport) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete this report? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteGuardBookReport(report.id);
        await loadReports();
        onDelete?.(report);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t`Failed to delete report`
        );
      }
    },
    [loadReports, onDelete]
  );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <Text>{error}</Text>
        <Button plain onClick={loadReports} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <Text>
          <Trans>No reports generated yet.</Trans>
        </Text>
      </div>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>
            <Trans>Report #</Trans>
          </TableHeader>
          <TableHeader>
            <Trans>Period</Trans>
          </TableHeader>
          <TableHeader>
            <Trans>Events</Trans>
          </TableHeader>
          <TableHeader>
            <Trans>Generated</Trans>
          </TableHeader>
          <TableHeader className="text-right">
            <Trans>Actions</Trans>
          </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">
              {report.report_number}
            </TableCell>
            <TableCell>
              {formatDateRange(report.period_start, report.period_end)}
            </TableCell>
            <TableCell>
              <Badge color="blue">{report.total_events}</Badge>
            </TableCell>
            <TableCell className="text-gray-500">
              {formatDate(report.generated_at)}
              {report.generated_by && (
                <span className="ml-1">
                  <Trans>by</Trans> {report.generated_by.name}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  plain
                  onClick={() => handleExport(report)}
                  disabled={isExporting === report.id}
                  aria-label={t`Export report ${report.report_number}`}
                >
                  {isExporting === report.id ? (
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  )}
                </Button>
                {onDelete && (
                  <Button
                    plain
                    onClick={() => handleDelete(report)}
                    aria-label={t`Delete report ${report.report_number}`}
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79"
                      />
                    </svg>
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export interface GuardBookManagerProps {
  /** Filter by object ID */
  objectId?: string;
  /** Filter by object area ID */
  objectAreaId?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Callback when a guard book is selected */
  onSelect?: (guardBook: GuardBook) => void;
  /** Callback when edit action is triggered */
  onEdit?: (guardBook: GuardBook) => void;
  /** Callback when delete action is triggered */
  onDelete?: (guardBook: GuardBook) => void;
  /** Callback when create action is triggered */
  onCreate?: () => void;
  /** Callback when generate report is triggered */
  onGenerateReport?: (guardBook: GuardBook) => void;
  /** Currently selected guard book ID */
  selectedId?: string | null;
  /** CSS class name */
  className?: string;
}

/**
 * Manager component for displaying and managing guard books
 *
 * Features:
 * - Grid view of guard books as cards
 * - Report list for selected guard book
 * - Export reports as PDF
 * - Selection support
 * - CRUD actions
 * - Loading and error states
 * - Empty state
 */
export function GuardBookManager({
  objectId,
  objectAreaId,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  onGenerateReport,
  selectedId,
  className = "",
}: GuardBookManagerProps) {
  const [guardBooks, setGuardBooks] = useState<GuardBook[]>([]);
  const [selectedGuardBook, setSelectedGuardBook] = useState<GuardBook | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuardBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listGuardBooks({
        object_id: objectId,
        object_area_id: objectAreaId,
        is_active: isActive,
        per_page: 100,
      });
      setGuardBooks(response.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t`Failed to load guard books`
      );
    } finally {
      setIsLoading(false);
    }
  }, [objectId, objectAreaId, isActive]);

  useEffect(() => {
    loadGuardBooks();
  }, [loadGuardBooks]);

  // Update selected guard book when selectedId changes
  useEffect(() => {
    if (selectedId) {
      const guardBook = guardBooks.find((gb) => gb.id === selectedId);
      setSelectedGuardBook(guardBook || null);
    } else {
      setSelectedGuardBook(null);
    }
  }, [selectedId, guardBooks]);

  const handleSelect = useCallback(
    (guardBook: GuardBook) => {
      setSelectedGuardBook(guardBook);
      onSelect?.(guardBook);
    },
    [onSelect]
  );

  const handleDelete = useCallback(
    async (guardBook: GuardBook) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete "${guardBook.title}"? This will also delete all reports. This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteGuardBook(guardBook.id);
        await loadGuardBooks();
        if (selectedGuardBook?.id === guardBook.id) {
          setSelectedGuardBook(null);
        }
        onDelete?.(guardBook);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t`Failed to delete guard book`
        );
      }
    },
    [loadGuardBooks, onDelete, selectedGuardBook]
  );

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${className} text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg`}
      >
        <Text>{error}</Text>
        <Button plain onClick={loadGuardBooks} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (guardBooks.length === 0) {
    return (
      <div
        className={`${className} text-center py-8 text-gray-500 dark:text-gray-400`}
      >
        <BookOpenIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <Subheading>
          <Trans>No Guard Books</Trans>
        </Subheading>
        <Text className="mt-2">
          <Trans>Get started by creating your first guard book.</Trans>
        </Text>
        {onCreate && (
          <Button onClick={onCreate} className="mt-4">
            <Trans>Create Guard Book</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}>
          <Trans>Guard Books</Trans>
        </Heading>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Create Guard Book</Trans>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guard Book List */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guardBooks.map((guardBook) => (
              <GuardBookCard
                key={guardBook.id}
                guardBook={guardBook}
                onSelect={handleSelect}
                onEdit={onEdit}
                onDelete={handleDelete}
                onGenerateReport={onGenerateReport}
                isSelected={selectedGuardBook?.id === guardBook.id}
              />
            ))}
          </div>
        </div>

        {/* Selected Guard Book Details / Reports */}
        <div className="lg:col-span-1">
          {selectedGuardBook ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <Subheading>{selectedGuardBook.title}</Subheading>
              {selectedGuardBook.description && (
                <Text className="text-gray-500 mt-1">
                  {selectedGuardBook.description}
                </Text>
              )}

              <div className="mt-2">
                <Badge color={selectedGuardBook.is_active ? "green" : "zinc"}>
                  {selectedGuardBook.is_active ? (
                    <Trans>Active</Trans>
                  ) : (
                    <Trans>Inactive</Trans>
                  )}
                </Badge>
              </div>

              <div className="mt-6">
                <Subheading>
                  <Trans>Reports</Trans>
                </Subheading>
                <div className="mt-3">
                  <ReportList guardBookId={selectedGuardBook.id} />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-gray-500">
              <Text>
                <Trans>Select a guard book to view reports</Trans>
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuardBookManager;
