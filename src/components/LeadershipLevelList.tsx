// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, t } from "@lingui/macro";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "./table";
import { SpinnerContainer } from "./spinner";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "./dropdown";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import type { LeadershipLevel } from "../types/leadershipLevel";
import {
  fetchLeadershipLevels,
  deleteLeadershipLevel,
  restoreLeadershipLevel,
} from "../services/leadershipLevelApi";
import { ApiError } from "../services/ApiError";

export interface LeadershipLevelListProps {
  /** Callback when user clicks Edit */
  onEdit: (level: LeadershipLevel) => void;
  /** Callback when user clicks Create */
  onCreate: () => void;
  /** Trigger to refresh list from parent */
  refreshTrigger?: number;
}

/**
 * LeadershipLevelList component
 *
 * Displays all leadership levels in a table with CRUD actions.
 * Features:
 * - Table view with rank, name, color badge, active status
 * - Create/Edit/Delete actions
 * - Soft delete with restore functionality
 * - Drag-and-drop reordering (TODO: Phase 2)
 * - Real-time error handling
 *
 * Part of Epic #399 - Leadership Levels System
 * @see Issue #426: Frontend UI for Leadership Levels
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251221-inheritance-blocking-and-leadership-access-control.md
 */
export function LeadershipLevelList({
  onEdit,
  onCreate,
  refreshTrigger,
}: LeadershipLevelListProps) {
  const [levels, setLevels] = useState<LeadershipLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Fetch levels from API
  const loadLevels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchLeadershipLevels({
        include_inactive: showInactive,
      });
      setLevels(response.data);
    } catch (err) {
      console.error("Failed to load leadership levels:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t`Failed to load leadership levels. Please try again.`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  // Load levels on mount and when refreshTrigger changes
  useEffect(() => {
    loadLevels();
  }, [loadLevels, refreshTrigger]);

  // Toggle show inactive
  const handleToggleInactive = useCallback(() => {
    setShowInactive((prev) => !prev);
  }, []);

  // Handle soft delete
  const handleDelete = useCallback(
    async (level: LeadershipLevel) => {
      const confirmMsg = t`Are you sure you want to delete "${level.name}"? This will hide it from employee assignment.`;
      if (!confirm(confirmMsg)) return;

      try {
        await deleteLeadershipLevel(level.id);
        // Reload list to reflect deletion
        await loadLevels();
      } catch (err) {
        console.error("Failed to delete leadership level:", err);
        if (err instanceof ApiError) {
          alert(err.message);
        } else {
          alert(t`Failed to delete leadership level. Please try again.`);
        }
      }
    },
    [loadLevels]
  );

  // Handle restore
  const handleRestore = useCallback(
    async (level: LeadershipLevel) => {
      try {
        await restoreLeadershipLevel(level.id);
        // Reload list to reflect restoration
        await loadLevels();
      } catch (err) {
        console.error("Failed to restore leadership level:", err);
        if (err instanceof ApiError) {
          alert(err.message);
        } else {
          alert(t`Failed to restore leadership level. Please try again.`);
        }
      }
    },
    [loadLevels]
  );

  // Render loading state
  if (isLoading) {
    return (
      <SpinnerContainer>
        <Trans>Loading leadership levels...</Trans>
      </SpinnerContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              <Trans>Error loading leadership levels</Trans>
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
            <div className="mt-4">
              <Button onClick={loadLevels}>
                <Trans>Retry</Trans>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (levels.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          <Trans>No leadership levels</Trans>
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {showInactive ? (
            <Trans>No inactive leadership levels found.</Trans>
          ) : (
            <Trans>Get started by creating a new leadership level.</Trans>
          )}
        </p>
        <div className="mt-6">
          <Button onClick={onCreate}>
            <Trans>Create Leadership Level</Trans>
          </Button>
        </div>
      </div>
    );
  }

  // Render table
  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onCreate}>
            <Trans>Create Leadership Level</Trans>
          </Button>
          <Button plain onClick={handleToggleInactive}>
            {showInactive ? (
              <Trans>Hide Inactive</Trans>
            ) : (
              <Trans>Show Inactive</Trans>
            )}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>
              <Trans>Rank</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Name</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Description</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Status</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Employees</Trans>
            </TableHeader>
            <TableHeader>
              {/* Actions column */}
              <span className="sr-only">
                <Trans>Actions</Trans>
              </span>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {levels.map((level) => (
            <TableRow key={level.id}>
              {/* Rank with color badge */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge
                    color="zinc"
                    className="font-mono"
                    style={
                      level.color
                        ? {
                            backgroundColor: `${level.color}15`,
                            color: level.color,
                          }
                        : undefined
                    }
                  >
                    FE{level.rank}
                  </Badge>
                </div>
              </TableCell>

              {/* Name */}
              <TableCell className="font-medium">{level.name}</TableCell>

              {/* Description */}
              <TableCell className="max-w-md truncate text-zinc-500 dark:text-zinc-400">
                {level.description || "—"}
              </TableCell>

              {/* Status */}
              <TableCell>
                {level.is_active ? (
                  <Badge color="green">
                    <Trans>Active</Trans>
                  </Badge>
                ) : (
                  <Badge color="zinc">
                    <Trans>Inactive</Trans>
                  </Badge>
                )}
              </TableCell>

              {/* Employees count */}
              <TableCell className="text-zinc-500 dark:text-zinc-400">
                {level.employees_count ?? 0}
              </TableCell>

              {/* Actions */}
              <TableCell>
                <div className="flex justify-end">
                  <Dropdown>
                    <DropdownButton
                      plain
                      aria-label={t`Actions for ${level.name}`}
                    >
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem onClick={() => onEdit(level)}>
                        <Trans>Edit</Trans>
                      </DropdownItem>
                      {level.deleted_at ? (
                        <DropdownItem onClick={() => handleRestore(level)}>
                          <Trans>Restore</Trans>
                        </DropdownItem>
                      ) : (
                        <DropdownItem onClick={() => handleDelete(level)}>
                          <Trans>Delete</Trans>
                        </DropdownItem>
                      )}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
