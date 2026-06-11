// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  lazy,
  Suspense,
} from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { X } from "lucide-react";
import { Badge, Button, Card, CardContent, Spinner } from "@/ui";
import { OrganizationalUnitTree } from "../../components/OrganizationalUnitTree";
import { OfflineDataBanner } from "../../components/OfflineDataBanner";

// Lazy load dialog for better performance
const OrganizationalUnitFormDialog = lazy(() =>
  import("../../components/OrganizationalUnitFormDialog").then((m) => ({
    default: m.OrganizationalUnitFormDialog,
  }))
);
import {
  getTypeLabel,
  getTypeBadgeColor,
} from "../../lib/organizationalUnitUtils";
import { formatDate } from "../../lib/dateUtils";
import type { OrganizationalUnit } from "../../types/organizational";
import { useOrganizationalUnitsWithOffline } from "../../hooks/useOrganizationalUnitsWithOffline";

const typeBadgeClassNames = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  purple:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
} as const;

function getTypeBadgeClassName(type: OrganizationalUnit["type"]) {
  return typeBadgeClassNames[getTypeBadgeColor(type)];
}

/**
 * Optimistic UI state for tree updates without reloading
 * @see Issue #303: UX improvement - avoid full tree reload
 * Each create entry has a unique key so that replacing an entry with the same unit id
 * changes the array reference and triggers the memoized tree recomputation.
 */
interface OptimisticTreeUpdate {
  createdUnits: Array<{
    unit: OrganizationalUnit;
    parentId: string | null;
    key: number;
  }>;
  updatedUnit: { unit: OrganizationalUnit; key: number } | null;
}

/**
 * Organization Page
 *
 * Displays the internal organizational structure (departments, branches, teams).
 * Features Create/Edit functionality via modal dialogs.
 * Fully offline-capable: Data is cached in IndexedDB and available offline.
 *
 * Part of Epic #228 - Organizational Structure Hierarchy.
 * @see Issue #294: Frontend: Organizational unit Create/Edit forms
 * @see Issue #306: Detail panel close functionality (close button, ESC key, toggle selection)
 * @see Issue #283: Epic - Organizational Structure Management (CRUD) - Offline Support
 */
export function OrganizationPage() {
  const { i18n } = useLingui();
  // Offline-first organizational units hook
  const { isOffline, isStale, lastSynced, refresh } =
    useOrganizationalUnitsWithOffline();
  const [selectedUnit, setSelectedUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [dialogParentName, setDialogParentName] = useState<string | null>(null);
  const [dialogParentType, setDialogParentType] = useState<
    OrganizationalUnit["type"] | null
  >(null);
  const [editingUnit, setEditingUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Success toast state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Optimistic UI state for tree updates (Issue #303)
  const [optimisticUpdate, setOptimisticUpdate] =
    useState<OptimisticTreeUpdate>({
      createdUnits: [],
      updatedUnit: null,
    });

  // Ref for timeout cleanup
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for click-outside detection
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // ESC key handler to close detail panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedUnit) {
        setSelectedUnit(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedUnit]);

  // Click-outside handler to close detail panel
  // Note: Skip when dialog is open, as dialogs are rendered via Portal outside the grid
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectedUnit &&
        !dialogOpen &&
        gridContainerRef.current &&
        !gridContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedUnit(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedUnit, dialogOpen]);

  // Toggle selection: clicking the same unit deselects it
  const handleSelect = useCallback(
    (unit: OrganizationalUnit) => {
      if (selectedUnit?.id === unit.id) {
        setSelectedUnit(null);
      } else {
        setSelectedUnit(unit);
      }
    },
    [selectedUnit?.id]
  );

  // Close detail panel handler
  const handleCloseDetail = useCallback(() => {
    setSelectedUnit(null);
  }, []);

  const handleEdit = useCallback((unit: OrganizationalUnit) => {
    setDialogMode("edit");
    setEditingUnit(unit);
    setDialogParentId(null);
    setDialogParentName(null);
    setDialogParentType(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (unit: OrganizationalUnit) => {
      // Refresh data from cache after delete
      refresh();

      // Delete is handled by OrganizationalUnitTree internally
      // This callback is for post-delete actions
      if (unit.id === selectedUnit?.id) {
        setSelectedUnit(null);
      }
    },
    [selectedUnit?.id, refresh]
  );

  const handleCreate = useCallback(() => {
    // Create at root level (no parent)
    setDialogMode("create");
    setEditingUnit(null);
    setDialogParentId(null);
    setDialogParentName(null);
    setDialogParentType(null);
    setDialogOpen(true);
  }, []);

  const handleCreateChild = useCallback((unit: OrganizationalUnit) => {
    setDialogMode("create");
    setEditingUnit(null);
    setDialogParentId(unit.id);
    setDialogParentName(unit.name);
    setDialogParentType(unit.type);
    setDialogOpen(true);
  }, []);

  const handleMove = useCallback(() => {
    // Refresh data from cache after move
    refresh();

    // Move is handled with optimistic UI in OrganizationalUnitTree
    // This callback is for post-move actions
    setSelectedUnit(null);
  }, [refresh]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingUnit(null);
  }, []);

  const handleDialogSuccess = useCallback(
    (unit: OrganizationalUnit) => {
      // Refresh data from cache to ensure consistency
      refresh();

      // Optimistic UI update (Issue #303) - update tree without reload
      // Use Date.now() as key to ensure each update triggers useEffect
      if (dialogMode === "create") {
        setOptimisticUpdate((current) => ({
          createdUnits: [
            ...current.createdUnits.filter(
              (entry) => entry.unit.id !== unit.id
            ),
            { unit, parentId: dialogParentId, key: Date.now() },
          ],
          updatedUnit: null,
        }));
      } else {
        setOptimisticUpdate((current) => ({
          createdUnits: current.createdUnits,
          updatedUnit: { unit, key: Date.now() },
        }));
        // Update selected unit if editing
        setSelectedUnit(unit);
      }

      // Show success message
      const message =
        dialogMode === "create"
          ? t`"${unit.name}" created successfully`
          : t`"${unit.name}" updated successfully`;
      setSuccessMessage(message);

      // Clear any existing timeout before setting a new one
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successTimeoutRef.current = null;
      }, 3000);
    },
    [dialogMode, dialogParentId, refresh]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          <Trans>Organization Structure</Trans>
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Trans>
            Manage your internal organizational units including departments,
            branches, and teams.
          </Trans>
        </p>
      </div>

      {/* Offline/Stale data banner */}
      <OfflineDataBanner
        isOffline={isOffline}
        isStale={isStale}
        lastSynced={lastSynced}
        onRefresh={refresh}
      />

      {/* Success toast */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <div
        ref={gridContainerRef}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Tree View */}
        <div className="lg:col-span-2">
          <OrganizationalUnitTree
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateChild={handleCreateChild}
            onCreate={handleCreate}
            onMove={handleMove}
            createdUnits={optimisticUpdate.createdUnits}
            updatedUnit={optimisticUpdate.updatedUnit}
            selectedId={selectedUnit?.id}
          />
        </div>

        {/* Detail Panel */}
        <Card>
          <CardContent className="h-full p-4">
          {selectedUnit ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
                  {selectedUnit.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Badge className={getTypeBadgeClassName(selectedUnit.type)}>
                    {getTypeLabel(selectedUnit.type)}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCloseDetail}
                    className="min-h-8 px-2 py-1 text-zinc-500"
                    aria-label={t`Close detail panel`}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Type</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {getTypeLabel(selectedUnit.type)}
                  </dd>
                </div>
                {selectedUnit.description && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Description</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      {selectedUnit.description}
                    </dd>
                  </div>
                )}
                {selectedUnit.parent && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Parent</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      {selectedUnit.parent.name}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Created</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {formatDate(selectedUnit.created_at, i18n.locale)}
                  </dd>
                </div>
              </dl>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Button onClick={() => handleEdit(selectedUnit)}>
                  <Trans>Edit</Trans>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCreateChild(selectedUnit)}
                >
                  <Trans>Add Child Unit</Trans>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center">
              <p className="text-sm text-zinc-500">
                <Trans>Select an organizational unit to view details</Trans>
              </p>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog - Lazy loaded for better performance */}
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-zinc-950/25 dark:bg-zinc-950/50">
            <Spinner aria-label={t`Loading`} className="size-6 text-white" />
          </div>
        }
      >
        <OrganizationalUnitFormDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          mode={dialogMode}
          parentId={dialogParentId}
          parentName={dialogParentName}
          parentType={dialogParentType}
          unit={editingUnit}
          onSuccess={handleDialogSuccess}
        />
      </Suspense>
    </div>
  );
}

export default OrganizationPage;
