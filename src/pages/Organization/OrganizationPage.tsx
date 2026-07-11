// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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
import { Button } from "@/ui/button";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  OrganizationalUnitTypeBadge,
  Spinner,
} from "@/ui";
import { OrganizationalUnitTree } from "../../components/OrganizationalUnitTree";
import { OfflineDataBanner } from "../../components/OfflineDataBanner";

// Lazy load dialog for better performance
const OrganizationalUnitFormDialog = lazy(() =>
  import("../../components/OrganizationalUnitFormDialog").then((m) => ({
    default: m.OrganizationalUnitFormDialog,
  }))
);
import { getTypeLabel } from "../../lib/organizationalUnitUtils";
import { formatDate } from "../../lib/dateUtils";
import type { OrganizationalUnit } from "../../types/organizational";
import { useOrganizationalUnitsWithOffline } from "../../hooks/useOrganizationalUnitsWithOffline";

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
        <h1 className="text-foreground text-2xl font-semibold tracking-normal">
          <Trans>Organization Structure</Trans>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
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
      {successMessage ? (
        <Alert
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="border-emerald-500/30 bg-emerald-500/10 text-foreground"
        >
          <AlertDescription className="text-foreground">
            {successMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        ref={gridContainerRef}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]"
      >
        {/* Tree View */}
        <div className="min-w-0">
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
        <Card className="xl:sticky xl:top-6 xl:self-start">
          <CardContent className="h-full p-4 xl:max-h-[calc(100svh-var(--app-safe-area-inset-top)-8rem)] xl:overflow-y-auto">
            {selectedUnit ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-foreground text-lg font-semibold tracking-normal">
                    {selectedUnit.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <OrganizationalUnitTypeBadge type={selectedUnit.type} />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleCloseDetail}
                      className="text-muted-foreground min-h-8 px-2 py-1"
                      aria-label={t`Close detail panel`}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground font-medium">
                      <Trans>Type</Trans>
                    </dt>
                    <dd className="text-foreground">
                      {getTypeLabel(selectedUnit.type)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground font-medium">
                      <Trans>Administrative status</Trans>
                    </dt>
                    <dd className="text-foreground">
                      {selectedUnit.is_active ? (
                        <Trans>Active</Trans>
                      ) : (
                        <Trans>Inactive</Trans>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground font-medium">
                      <Trans>Assignment status</Trans>
                    </dt>
                    <dd className="text-foreground">
                      {selectedUnit.is_assignable ? (
                        <Trans>Assignable</Trans>
                      ) : (
                        <Trans>Not assignable</Trans>
                      )}
                    </dd>
                  </div>
                  {selectedUnit.description && (
                    <div>
                      <dt className="text-muted-foreground font-medium">
                        <Trans>Description</Trans>
                      </dt>
                      <dd className="text-foreground">
                        {selectedUnit.description}
                      </dd>
                    </div>
                  )}
                  {selectedUnit.parent && (
                    <div>
                      <dt className="text-muted-foreground font-medium">
                        <Trans>Parent</Trans>
                      </dt>
                      <dd className="text-foreground">
                        {selectedUnit.parent.name}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground font-medium">
                      <Trans>Created</Trans>
                    </dt>
                    <dd className="text-foreground">
                      {formatDate(selectedUnit.created_at, i18n.locale)}
                    </dd>
                  </div>
                </dl>

                {/* Action buttons */}
                <div className="border-border flex flex-col gap-2 border-t pt-4">
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
                <p className="text-muted-foreground text-sm">
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
          <div className="bg-background/80 fixed inset-0 flex items-center justify-center backdrop-blur-sm">
            <Spinner
              aria-label={t`Loading`}
              className="text-foreground size-6"
            />
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
