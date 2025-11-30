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
import type { SecPalObject, ObjectArea } from "../types/organizational";
import {
  listObjects,
  getObject,
  deleteObject,
  getObjectAreas,
  deleteObjectArea,
} from "../services/objectApi";

/**
 * Icon components
 */
function BuildingIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

function MapPinIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function RectangleGroupIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
      />
    </svg>
  );
}

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

interface ObjectCardProps {
  object: SecPalObject;
  onSelect?: (object: SecPalObject) => void;
  onEdit?: (object: SecPalObject) => void;
  onDelete?: (object: SecPalObject) => void;
  onViewAreas?: (object: SecPalObject) => void;
  onManageGuardBooks?: (object: SecPalObject) => void;
  isSelected?: boolean;
}

/**
 * Card component for displaying object details
 */
function ObjectCard({
  object,
  onSelect,
  onEdit,
  onDelete,
  onViewAreas,
  onManageGuardBooks,
  isSelected = false,
}: ObjectCardProps) {
  const areaCount = object.areas?.length ?? 0;
  const guardBookCount = object.guard_books?.length ?? 0;

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
      }`}
      onClick={() => onSelect?.(object)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(object);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <BuildingIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              {object.name}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {object.object_number}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              plain
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onEdit(object);
              }}
              aria-label={t`Edit ${object.name}`}
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
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </Button>
          )}
          {onDelete && (
            <Button
              plain
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDelete(object);
              }}
              aria-label={t`Delete ${object.name}`}
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
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </Button>
          )}
        </div>
      </div>

      {/* Address */}
      {object.address && (
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-600 dark:text-gray-300">
          <MapPinIcon className="h-4 w-4 text-gray-400" />
          <span className="truncate">{object.address}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mt-4">
        {onViewAreas && (
          <Button
            plain
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onViewAreas(object);
            }}
            className="flex items-center gap-1.5 text-sm"
          >
            <RectangleGroupIcon className="h-4 w-4" />
            <span>
              {areaCount} <Trans>Areas</Trans>
            </span>
          </Button>
        )}
        {onManageGuardBooks && (
          <Button
            plain
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onManageGuardBooks(object);
            }}
            className="flex items-center gap-1.5 text-sm"
          >
            <BookOpenIcon className="h-4 w-4" />
            <span>
              {guardBookCount} <Trans>Guard Books</Trans>
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}

interface ObjectAreaListProps {
  objectId: string;
  onEdit?: (area: ObjectArea) => void;
  onDelete?: (area: ObjectArea) => void;
  onCreate?: () => void;
}

/**
 * List component for displaying object areas
 */
function ObjectAreaList({
  objectId,
  onEdit,
  onDelete,
  onCreate,
}: ObjectAreaListProps) {
  const [areas, setAreas] = useState<ObjectArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAreas = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedAreas = await getObjectAreas(objectId);
      setAreas(loadedAreas);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Failed to load areas`);
    } finally {
      setIsLoading(false);
    }
  }, [objectId]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const handleDelete = useCallback(
    async (area: ObjectArea) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete "${area.name}"? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteObjectArea(area.id);
        await loadAreas();
        onDelete?.(area);
      } catch (err) {
        setError(err instanceof Error ? err.message : t`Failed to delete area`);
      }
    },
    [loadAreas, onDelete]
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
        <Button plain onClick={loadAreas} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <RectangleGroupIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <Text>
          <Trans>No areas defined for this object.</Trans>
        </Text>
        {onCreate && (
          <Button plain onClick={onCreate} className="mt-2">
            <Trans>Add Area</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Subheading>
          <Trans>Object Areas</Trans>
        </Subheading>
        {onCreate && (
          <Button plain onClick={onCreate}>
            <Trans>Add Area</Trans>
          </Button>
        )}
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>
              <Trans>Name</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Description</Trans>
            </TableHeader>
            <TableHeader>
              <Trans>Separate Guard Book</Trans>
            </TableHeader>
            <TableHeader className="text-right">
              <Trans>Actions</Trans>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {areas.map((area) => (
            <TableRow key={area.id}>
              <TableCell className="font-medium">{area.name}</TableCell>
              <TableCell className="text-gray-500">
                {area.description || "-"}
              </TableCell>
              <TableCell>
                {area.requires_separate_guard_book ? (
                  <Badge color="green">
                    <Trans>Yes</Trans>
                  </Badge>
                ) : (
                  <Badge color="zinc">
                    <Trans>No</Trans>
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {onEdit && (
                    <Button
                      plain
                      onClick={() => onEdit(area)}
                      aria-label={t`Edit ${area.name}`}
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
                      onClick={() => handleDelete(area)}
                      aria-label={t`Delete ${area.name}`}
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
    </div>
  );
}

export interface ObjectManagerProps {
  /** Filter by customer ID */
  customerId?: string;
  /** Callback when an object is selected */
  onSelect?: (object: SecPalObject) => void;
  /** Callback when edit action is triggered */
  onEdit?: (object: SecPalObject) => void;
  /** Callback when delete action is triggered */
  onDelete?: (object: SecPalObject) => void;
  /** Callback when create action is triggered */
  onCreate?: () => void;
  /** Callback when area edit is triggered */
  onEditArea?: (area: ObjectArea) => void;
  /** Callback when area delete is triggered */
  onDeleteArea?: (area: ObjectArea) => void;
  /** Callback when area create is triggered */
  onCreateArea?: (objectId: string) => void;
  /** Callback when manage guard books is triggered */
  onManageGuardBooks?: (object: SecPalObject) => void;
  /** Currently selected object ID */
  selectedId?: string | null;
  /** CSS class name */
  className?: string;
}

/**
 * Manager component for displaying and managing objects and their areas
 *
 * Features:
 * - Grid view of objects as cards
 * - Object details with areas
 * - Selection support
 * - CRUD actions for objects and areas
 * - Loading and error states
 * - Empty state
 */
export function ObjectManager({
  customerId,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  onEditArea,
  onDeleteArea,
  onCreateArea,
  onManageGuardBooks,
  selectedId,
  className = "",
}: ObjectManagerProps) {
  const [objects, setObjects] = useState<SecPalObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<SecPalObject | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadObjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listObjects({
        customer_id: customerId,
        per_page: 100,
      });
      setObjects(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Failed to load objects`);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  // Load selected object details when selectedId changes
  useEffect(() => {
    if (selectedId) {
      const loadSelectedObject = async () => {
        try {
          const object = await getObject(selectedId);
          setSelectedObject(object);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : t`Failed to load selected object`
          );
        }
      };
      loadSelectedObject();
    } else {
      setSelectedObject(null);
    }
  }, [selectedId]);

  const handleSelect = useCallback(
    (object: SecPalObject) => {
      setSelectedObject(object);
      onSelect?.(object);
    },
    [onSelect]
  );

  const handleDelete = useCallback(
    async (object: SecPalObject) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete "${object.name}"? This will also delete all areas and guard books. This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteObject(object.id);
        await loadObjects();
        if (selectedObject?.id === object.id) {
          setSelectedObject(null);
        }
        onDelete?.(object);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t`Failed to delete object`
        );
      }
    },
    [loadObjects, onDelete, selectedObject]
  );

  const handleViewAreas = useCallback((object: SecPalObject) => {
    setSelectedObject(object);
  }, []);

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
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
        <Button plain onClick={loadObjects} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (objects.length === 0) {
    return (
      <div
        className={`${className} text-center py-8 text-gray-500 dark:text-gray-400`}
      >
        <BuildingIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <Subheading>
          <Trans>No Objects</Trans>
        </Subheading>
        <Text className="mt-2">
          <Trans>Get started by adding your first object.</Trans>
        </Text>
        {onCreate && (
          <Button onClick={onCreate} className="mt-4">
            <Trans>Add Object</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}>
          <Trans>Objects</Trans>
        </Heading>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Add Object</Trans>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Object List */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {objects.map((object) => (
              <ObjectCard
                key={object.id}
                object={object}
                onSelect={handleSelect}
                onEdit={onEdit}
                onDelete={handleDelete}
                onViewAreas={handleViewAreas}
                onManageGuardBooks={onManageGuardBooks}
                isSelected={selectedObject?.id === object.id}
              />
            ))}
          </div>
        </div>

        {/* Selected Object Details */}
        <div className="lg:col-span-1">
          {selectedObject ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <Subheading>{selectedObject.name}</Subheading>
              <Text className="text-gray-500 mt-1">
                {selectedObject.object_number}
              </Text>

              {selectedObject.address && (
                <div className="flex items-start gap-2 mt-4">
                  <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <Text>{selectedObject.address}</Text>
                </div>
              )}

              {selectedObject.gps_coordinates && (
                <div className="mt-2 text-sm text-gray-500">
                  GPS: {selectedObject.gps_coordinates.lat.toFixed(6)},{" "}
                  {selectedObject.gps_coordinates.lon.toFixed(6)}
                </div>
              )}

              <div className="mt-6">
                <ObjectAreaList
                  objectId={selectedObject.id}
                  onEdit={onEditArea}
                  onDelete={onDeleteArea}
                  onCreate={
                    onCreateArea
                      ? () => onCreateArea(selectedObject.id)
                      : undefined
                  }
                />
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-gray-500">
              <Text>
                <Trans>Select an object to view details</Trans>
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ObjectManager;
