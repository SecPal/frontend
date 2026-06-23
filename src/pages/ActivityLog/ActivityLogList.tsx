// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useState,
  useEffect,
  useCallback,
  type ComponentPropsWithoutRef,
} from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  fetchActivityLogs,
  type Activity,
  type ActivityFilters,
} from "../../services/activityLogApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { OrganizationalUnitPicker } from "../../components/OrganizationalUnitPicker";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Field,
  FieldLabel,
  Input,
  LoadingRegion,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
} from "@/ui";
import { ActivityDetailDialog } from "./ActivityDetailDialog";
import { VerificationDots } from "../../components/VerificationDots";
import { formatApiDateTime } from "../../lib/dateUtils";

const LOG_NAME_ALL_VALUE = "__all_logs__";

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  return formatApiDateTime(dateString, {
    formatOptions: {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  });
}

function LogBadge({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <Badge
      className={cn(
        "bg-zinc-600/10 text-zinc-700 dark:bg-white/5 dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

const ACTIVITY_LOG_DESKTOP_MEDIA_QUERY = "(min-width: 40rem)";

function readUseDesktopTable(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }

  return window.matchMedia(ACTIVITY_LOG_DESKTOP_MEDIA_QUERY).matches;
}

function ActivityTableSkeletonRows({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <td
              key={columnIndex}
              className={cn(
                "px-4 py-3",
                columnIndex === 2 ? "hidden md:table-cell" : "",
                columnIndex === 3 ? "hidden lg:table-cell" : "",
                columnIndex === 4 ? "hidden xl:table-cell" : ""
              )}
            >
              <Skeleton
                className={cn(
                  "h-4",
                  columnIndex === 1
                    ? "w-56 max-w-full"
                    : columnIndex === columns - 1
                      ? "w-12"
                      : "w-28 max-w-full"
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface ActivityMobileSkeletonCardsProps {
  rows: number;
}

function ActivityMobileSkeletonCards({
  rows,
}: ActivityMobileSkeletonCardsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <Skeleton className="mt-4 h-3 w-12" />
        </div>
      ))}
    </>
  );
}

interface ActivityTableChromeProps {
  children: React.ReactNode;
}

function ActivityTableChrome({ children }: ActivityTableChromeProps) {
  return (
    <div
      data-slot="activity-log-table-container"
      className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800"
    >
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900/60">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300"
            >
              <Trans>Date/Time</Trans>
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300"
            >
              <Trans>Description</Trans>
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 text-left font-medium text-zinc-600 md:table-cell dark:text-zinc-300"
            >
              <Trans>Log Name</Trans>
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 text-left font-medium text-zinc-600 lg:table-cell dark:text-zinc-300"
            >
              <Trans>Causer</Trans>
            </th>
            <th
              scope="col"
              className="hidden px-4 py-3 text-left font-medium text-zinc-600 xl:table-cell dark:text-zinc-300"
            >
              <Trans>Organizational Unit</Trans>
            </th>
            <th scope="col" className="w-20 px-4 py-3">
              <span className="sr-only">
                <Trans>Verification Status</Trans>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Activity Log List Page
 *
 * Displays paginated activity logs with filtering capabilities.
 * Supports:
 * - Date range filtering
 * - Log name filtering
 * - Full-text search in descriptions
 * - Organizational unit filtering
 * - Detail view with verification status
 *
 * Security: Only displays logs accessible based on user's organizational scopes
 * and leadership levels (enforced by ActivityPolicy on backend).
 */
export function ActivityLogList() {
  const { _ } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Parse filters from URL search params
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    page: parseInt(searchParams.get("page") || "1", 10),
    per_page: parseInt(searchParams.get("per_page") || "50", 10),
    from_date: searchParams.get("from_date") || undefined,
    to_date: searchParams.get("to_date") || undefined,
    log_name: searchParams.get("log_name") || undefined,
    search: searchParams.get("search") || undefined,
    organizational_unit_id:
      searchParams.get("organizational_unit_id") || undefined,
  }));

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
    from: 0 as number | null,
    to: 0 as number | null,
  });

  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [useDesktopTable, setUseDesktopTable] = useState(readUseDesktopTable);

  // Update URL search params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.page && filters.page > 1)
      params.set("page", filters.page.toString());
    if (filters.per_page && filters.per_page !== 50)
      params.set("per_page", filters.per_page.toString());
    if (filters.from_date) params.set("from_date", filters.from_date);
    if (filters.to_date) params.set("to_date", filters.to_date);
    if (filters.log_name) params.set("log_name", filters.log_name);
    if (filters.search) params.set("search", filters.search);
    if (filters.organizational_unit_id)
      params.set("organizational_unit_id", filters.organizational_unit_id);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const refreshActivities = useCallback(() => {
    setLoading(true);
    setError(null);

    void fetchActivityLogs(filters)
      .then((response) => {
        setActivities(response.data);
        setPagination(response.meta);
      })
      .catch((err) => {
        console.error("Failed to load activity logs:", err);
        let errorMessage = "Failed to load activity logs";

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (
          typeof err === "object" &&
          err !== null &&
          "message" in err
        ) {
          errorMessage = String(err.message);
        }

        setError(errorMessage);
        setActivities((current) => (current.length > 0 ? current : []));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filters]);

  // Load organizational units on mount
  useEffect(() => {
    async function loadUnits() {
      try {
        setUnitsLoading(true);
        const response = await listOrganizationalUnits();
        setOrganizationalUnits(response.data);
      } catch (err) {
        console.error("Failed to load organizational units:", err);
        // Don't block the UI if units fail to load
      } finally {
        setUnitsLoading(false);
      }
    }
    loadUnits();
  }, []);

  useEffect(() => {
    let active = true;

    void fetchActivityLogs(filters)
      .then((response) => {
        if (!active) {
          return;
        }

        setActivities(response.data);
        setPagination(response.meta);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        console.error("Failed to load activity logs:", err);
        let errorMessage = "Failed to load activity logs";

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (
          typeof err === "object" &&
          err !== null &&
          "message" in err
        ) {
          errorMessage = String(err.message);
        }

        setError(errorMessage);
        setActivities((current) => (current.length > 0 ? current : []));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(ACTIVITY_LOG_DESKTOP_MEDIA_QUERY);
    const syncLayout = (event: MediaQueryListEvent) => {
      setUseDesktopTable(event.matches);
    };

    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  // Auto-refresh: Reload data every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshActivities();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refreshActivities]);

  // Refresh on page focus (when user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      refreshActivities();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshActivities]);

  function handleLogNameFilter(log_name: string | undefined) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, log_name, page: 1 });
  }

  function handleOrganizationalUnitFilter(
    organizational_unit_id: string | undefined
  ) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, organizational_unit_id, page: 1 });
  }

  function handleSearch(search: string) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, search, page: 1 });
  }

  function handleFromDateFilter(from_date: string) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, from_date: from_date || undefined, page: 1 });
  }

  function handleToDateFilter(to_date: string) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, to_date: to_date || undefined, page: 1 });
  }

  function handlePageChange(page: number) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRowClick(activity: Activity) {
    setSelectedActivity(activity);
    setDetailDialogOpen(true);
  }

  function handleCloseDetailDialog() {
    setDetailDialogOpen(false);
    // Intentionally keep selectedActivity; ActivityDetailDialog resets its internal state when it opens.
  }

  const showInitialActivitySkeleton = loading && activities.length === 0;
  const showActivityRows = activities.length > 0;
  const activityTableLoadingLabel = _(msg`Loading activity logs...`);

  return (
    <div>
      {/* Header with responsive controls */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          <Trans>Activity Logs</Trans>
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {pagination.total > 0 && (
            <p className="hidden text-sm text-zinc-600 md:block dark:text-zinc-300">
              <Trans>
                Showing {pagination.from} to {pagination.to} of{" "}
                {pagination.total} logs
              </Trans>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={refreshActivities}
              disabled={loading}
              variant="outline"
              title={_(msg`Refresh activity logs`)}
            >
              <RefreshCw
                className={cn("size-4", loading ? "animate-spin" : "")}
                aria-hidden="true"
              />
              <Trans>Refresh</Trans>
            </Button>
            <label
              htmlFor="auto-refresh"
              className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
            >
              <Checkbox
                id="auto-refresh"
                name="auto_refresh"
                checked={autoRefresh}
                onCheckedChange={(checked) => setAutoRefresh(checked === true)}
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                <Trans>Auto-refresh (30s)</Trans>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        {/* Search filter - always visible */}
        <Field>
          <FieldLabel htmlFor="activity-search">
            <Trans>Search</Trans>
          </FieldLabel>
          <Input
            id="activity-search"
            type="text"
            name="search"
            autoComplete="off"
            placeholder={_(msg`Search in descriptions...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>

        {/* Mobile filter toggle button */}
        <Button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          variant="outline"
          className="mt-3 sm:hidden w-full"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {showMobileFilters ? (
            <Trans>Hide options</Trans>
          ) : (
            <Trans>More options</Trans>
          )}
        </Button>

        {/* Additional filters - collapsible on mobile */}
        <div
          className={`${showMobileFilters ? "block" : "hidden"} sm:block mt-4`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field>
              <FieldLabel htmlFor="from-date">
                <Trans>From Date</Trans>
              </FieldLabel>
              <Input
                id="from-date"
                type="date"
                name="from_date"
                autoComplete="off"
                value={filters.from_date || ""}
                onChange={(e) => handleFromDateFilter(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="to-date">
                <Trans>To Date</Trans>
              </FieldLabel>
              <Input
                id="to-date"
                type="date"
                name="to_date"
                autoComplete="off"
                value={filters.to_date || ""}
                onChange={(e) => handleToDateFilter(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="log-name">
                <Trans>Log Name</Trans>
              </FieldLabel>
              <Select
                name="log_name"
                value={filters.log_name || LOG_NAME_ALL_VALUE}
                onValueChange={(value) =>
                  handleLogNameFilter(
                    value === LOG_NAME_ALL_VALUE ? undefined : value
                  )
                }
              >
                <SelectTrigger id="log-name" aria-label={_(msg`Log Name`)}>
                  <SelectValue placeholder={_(msg`All logs`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value={LOG_NAME_ALL_VALUE}
                    data-value={LOG_NAME_ALL_VALUE}
                  >
                    {_(msg`All logs`)}
                  </SelectItem>
                  <SelectItem value="default" data-value="default">
                    {_(msg`Default`)}
                  </SelectItem>
                  <SelectItem value="auth" data-value="auth">
                    {_(msg`Authentication`)}
                  </SelectItem>
                  <SelectItem value="permission" data-value="permission">
                    {_(msg`Permissions`)}
                  </SelectItem>
                  <SelectItem value="hr_access" data-value="hr_access">
                    {_(msg`HR Access`)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>
                <Trans>Organizational Unit</Trans>
              </FieldLabel>
              <OrganizationalUnitPicker
                units={organizationalUnits}
                value={filters.organizational_unit_id || ""}
                onChange={handleOrganizationalUnitFilter}
                allUnitsLabel={_(msg`All units`)}
                disabled={unitsLoading}
                ariaLabel={_(msg`Filter by organizational unit`)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </Alert>
      )}

      {/* Table */}
      <LoadingRegion loading={loading} loadingLabel={activityTableLoadingLabel}>
        {showInitialActivitySkeleton ? (
          useDesktopTable ? (
            <ActivityTableChrome>
              <ActivityTableSkeletonRows columns={6} rows={5} />
            </ActivityTableChrome>
          ) : (
            <div data-slot="activity-log-mobile-list" className="grid gap-3">
              <ActivityMobileSkeletonCards rows={5} />
            </div>
          )
        ) : !showActivityRows ? (
          <div className="rounded-md border border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              <Trans>No activity logs found.</Trans>
            </p>
          </div>
        ) : useDesktopTable ? (
          <ActivityTableChrome>
            {activities.map((activity) => (
              <tr
                key={activity.id}
                className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                onClick={() => handleRowClick(activity)}
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-950 dark:text-zinc-50">
                  {formatDate(activity.created_at)}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-zinc-950 dark:text-zinc-50">
                  {activity.description}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <LogBadge>{activity.log_name}</LogBadge>
                </td>
                <td className="hidden px-4 py-3 text-zinc-950 lg:table-cell dark:text-zinc-50">
                  {activity.causer?.name || (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <Trans>System</Trans>
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-zinc-950 xl:table-cell dark:text-zinc-50">
                  {activity.organizational_unit?.name || (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      <Trans>Global</Trans>
                    </span>
                  )}
                </td>
                <td className="w-20 px-4 py-3">
                  <VerificationDots
                    activity={activity}
                    size="sm"
                    showLabels={false}
                  />
                </td>
              </tr>
            ))}
          </ActivityTableChrome>
        ) : (
          <div data-slot="activity-log-mobile-list" className="grid gap-3">
            {activities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="min-w-0 rounded-md border border-zinc-200 bg-white p-4 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900/60"
                onClick={() => handleRowClick(activity)}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-5 font-medium text-zinc-950 dark:text-zinc-50">
                    {formatDate(activity.created_at)}
                  </p>
                  <VerificationDots
                    activity={activity}
                    size="sm"
                    showLabels={false}
                  />
                </div>
                <p className="mt-3 break-words text-sm text-zinc-950 dark:text-zinc-50">
                  {activity.description}
                </p>
                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <LogBadge
                    className="max-w-full min-w-0 truncate"
                    title={activity.log_name}
                  >
                    {activity.log_name}
                  </LogBadge>
                  <span className="min-w-0 break-all">
                    {activity.causer?.name || <Trans>System</Trans>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.last_page > 1 && showActivityRows && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={pagination.current_page === 1}
              onClick={() => handlePageChange(pagination.current_page - 1)}
              className="w-full sm:w-auto"
            >
              <Trans>Previous</Trans>
            </Button>
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
              <Trans>
                Page {pagination.current_page} of {pagination.last_page}
              </Trans>
            </p>
            <Button
              variant="outline"
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => handlePageChange(pagination.current_page + 1)}
              className="w-full sm:w-auto"
            >
              <Trans>Next</Trans>
            </Button>
          </div>
        )}
      </LoadingRegion>

      {/* Detail Dialog */}
      {selectedActivity && (
        <ActivityDetailDialog
          activity={selectedActivity}
          open={detailDialogOpen}
          onClose={handleCloseDetailDialog}
        />
      )}
    </div>
  );
}

export default ActivityLogList;
