// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useSearchParams } from "react-router-dom";
import {
  fetchActivityLogs,
  type Activity,
  type ActivityFilters,
} from "../../services/activityLogApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Field, Label } from "../../components/fieldset";
import { OrganizationalUnitPicker } from "../../components/OrganizationalUnitPicker";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../components/table";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { ActivityDetailDialog } from "./ActivityDetailDialog";
import { VerificationDots } from "../../components/VerificationDots";

/**
 * Security level badge component
 */
function SecurityLevelBadge({ level }: { level: 1 | 2 | 3 }) {
  const colors = {
    1: "zinc",
    2: "yellow",
    3: "lime",
  } as const;

  const labels = {
    1: <Trans>Basic</Trans>,
    2: <Trans>Enhanced</Trans>,
    3: <Trans>Maximum</Trans>,
  };

  return <Badge color={colors[level]}>{labels[level]}</Badge>;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchActivityLogs(filters);
      setActivities(response.data);
      setPagination(response.meta);
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      let errorMessage = "Failed to load activity logs";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
      setActivities([]);
    } finally {
      setLoading(false);
    }
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
    loadActivities();
  }, [loadActivities]);

  // Auto-refresh: Reload data every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadActivities();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, loadActivities]);

  // Refresh on page focus (when user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      loadActivities();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadActivities]);

  function handleLogNameFilter(log_name: string | undefined) {
    setFilters({ ...filters, log_name, page: 1 });
  }

  function handleOrganizationalUnitFilter(
    organizational_unit_id: string | undefined
  ) {
    setFilters({ ...filters, organizational_unit_id, page: 1 });
  }

  function handleSearch(search: string) {
    setFilters({ ...filters, search, page: 1 });
  }

  function handleFromDateFilter(from_date: string) {
    setFilters({ ...filters, from_date: from_date || undefined, page: 1 });
  }

  function handleToDateFilter(to_date: string) {
    setFilters({ ...filters, to_date: to_date || undefined, page: 1 });
  }

  function handlePageChange(page: number) {
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRowClick(activity: Activity) {
    setSelectedActivity(activity);
    setDetailDialogOpen(true);
  }

  function handleCloseDetailDialog() {
    setDetailDialogOpen(false);
    setSelectedActivity(null);
  }

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading activity logs...</Trans>
        </Text>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <Heading>
          <Trans>Activity Logs</Trans>
        </Heading>
        <div className="flex items-center gap-4">
          {pagination.total > 0 && (
            <Text>
              <Trans>
                Showing {pagination.from} to {pagination.to} of{" "}
                {pagination.total} logs
              </Trans>
            </Text>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => loadActivities()}
              disabled={loading}
              outline
              title={_(msg`Refresh activity logs`)}
            >
              <Trans>Refresh</Trans>
            </Button>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                <Trans>Auto-refresh (30s)</Trans>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Field>
          <Label>
            <Trans>Search</Trans>
          </Label>
          <Input
            type="text"
            placeholder={_(msg`Search in descriptions...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>

        <Field>
          <Label>
            <Trans>From Date</Trans>
          </Label>
          <Input
            type="date"
            value={filters.from_date || ""}
            onChange={(e) => handleFromDateFilter(e.target.value)}
          />
        </Field>

        <Field>
          <Label>
            <Trans>To Date</Trans>
          </Label>
          <Input
            type="date"
            value={filters.to_date || ""}
            onChange={(e) => handleToDateFilter(e.target.value)}
          />
        </Field>

        <Field>
          <Label>
            <Trans>Log Name</Trans>
          </Label>
          <Select
            value={filters.log_name || ""}
            onChange={(e) => handleLogNameFilter(e.target.value || undefined)}
          >
            <option value="">
              <Trans>All logs</Trans>
            </option>
            <option value="default">
              <Trans>Default</Trans>
            </option>
            <option value="auth">
              <Trans>Authentication</Trans>
            </option>
            <option value="permission">
              <Trans>Permissions</Trans>
            </option>
            <option value="hr_access">
              <Trans>HR Access</Trans>
            </option>
          </Select>
        </Field>

        <Field>
          <Label>
            <Trans>Organizational Unit</Trans>
          </Label>
          <OrganizationalUnitPicker
            units={organizationalUnits}
            value={filters.organizational_unit_id || ""}
            onChange={handleOrganizationalUnitFilter}
            allUnitsLabel={_(msg`All units`)}
            disabled={unitsLoading}
          />
        </Field>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-md">
          <Text className="text-red-800 dark:text-red-200">{error}</Text>
        </div>
      )}

      {/* Table */}
      {activities.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Text>
            <Trans>No activity logs found.</Trans>
          </Text>
        </div>
      ) : (
        <>
          <Table className="[--gutter:theme(spacing.6)] sm:[--gutter:theme(spacing.8)]">
            <TableHead>
              <TableRow>
                <TableHeader>
                  <Trans>Date/Time</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Description</Trans>
                </TableHeader>
                <TableHeader className="hidden md:table-cell">
                  <Trans>Log Name</Trans>
                </TableHeader>
                <TableHeader className="hidden lg:table-cell">
                  <Trans>Causer</Trans>
                </TableHeader>
                <TableHeader className="hidden xl:table-cell">
                  <Trans>Organizational Unit</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Security Level</Trans>
                </TableHeader>
                <TableHeader className="w-16 shrink-0">
                  {/* Verification dots - no header */}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={() => handleRowClick(activity)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatDate(activity.created_at)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {activity.description}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge color="zinc">{activity.log_name}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {activity.causer?.name || (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        <Trans>System</Trans>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {activity.organizational_unit?.name || (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        <Trans>Global</Trans>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SecurityLevelBadge level={activity.security_level} />
                  </TableCell>
                  <TableCell className="w-24 shrink-0">
                    <VerificationDots
                      activity={activity}
                      size="sm"
                      showLabels={false}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.last_page > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <Button
                outline
                disabled={pagination.current_page === 1}
                onClick={() => handlePageChange(pagination.current_page - 1)}
              >
                <Trans>Previous</Trans>
              </Button>
              <Text>
                <Trans>
                  Page {pagination.current_page} of {pagination.last_page}
                </Trans>
              </Text>
              <Button
                outline
                disabled={pagination.current_page === pagination.last_page}
                onClick={() => handlePageChange(pagination.current_page + 1)}
              >
                <Trans>Next</Trans>
              </Button>
            </div>
          )}
        </>
      )}

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
