// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect } from "react";
import { Trans, t } from "@lingui/macro";
import { Button } from "./button";
import { Badge } from "./badge";
import { Heading, Subheading } from "./heading";
import { Text } from "./text";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import {
  listOrganizationalUnits,
  deleteOrganizationalUnit,
} from "../services/organizationalUnitApi";

/**
 * Icon components for tree visualization
 */
function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function BuildingOfficeIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
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

/**
 * Get icon for organizational unit type
 */
function getUnitIcon(type: OrganizationalUnitType) {
  switch (type) {
    case "holding":
    case "company":
      return <BuildingOfficeIcon className="h-5 w-5 text-blue-500" />;
    case "department":
    case "division":
      return <UsersIcon className="h-5 w-5 text-green-500" />;
    case "branch":
      return <BuildingOfficeIcon className="h-5 w-5 text-purple-500" />;
    case "region":
      return <MapPinIcon className="h-5 w-5 text-orange-500" />;
    default:
      return <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />;
  }
}

/**
 * Get badge color for organizational unit type
 */
function getTypeBadgeColor(type: OrganizationalUnitType) {
  switch (type) {
    case "holding":
    case "company":
      return "blue";
    case "department":
    case "division":
      return "green";
    case "branch":
      return "purple";
    case "region":
      return "orange";
    default:
      return "zinc";
  }
}

interface TreeNodeProps {
  unit: OrganizationalUnit;
  level: number;
  onSelect?: (unit: OrganizationalUnit) => void;
  onEdit?: (unit: OrganizationalUnit) => void;
  onDelete?: (unit: OrganizationalUnit) => void;
  selectedId?: string | null;
}

/**
 * Single tree node component
 */
function TreeNode({
  unit,
  level,
  onSelect,
  onEdit,
  onDelete,
  selectedId,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = unit.children && unit.children.length > 0;
  const isSelected = selectedId === unit.id;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    },
    [isExpanded]
  );

  const handleSelect = useCallback(() => {
    onSelect?.(unit);
  }, [onSelect, unit]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(unit);
    },
    [onEdit, unit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(unit);
    },
    [onDelete, unit]
  );

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
        style={{ paddingLeft: `${level * 24 + 12}px` }}
        onClick={handleSelect}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect();
          }
        }}
      >
        {/* Expand/Collapse Button */}
        <button
          type="button"
          className={`p-0.5 rounded transition-colors ${
            hasChildren
              ? "hover:bg-gray-200 dark:hover:bg-gray-700"
              : "invisible"
          }`}
          onClick={handleToggle}
          aria-label={isExpanded ? t`Collapse` : t`Expand`}
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Icon */}
        {getUnitIcon(unit.type)}

        {/* Name */}
        <span className="flex-1 font-medium text-gray-900 dark:text-gray-100 truncate">
          {unit.name}
        </span>

        {/* Type Badge */}
        <Badge color={getTypeBadgeColor(unit.type)}>{unit.type}</Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              plain
              onClick={handleEdit}
              aria-label={t`Edit ${unit.name}`}
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
              onClick={handleDelete}
              aria-label={t`Delete ${unit.name}`}
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

      {/* Children */}
      {hasChildren && isExpanded && (
        <div role="group">
          {unit.children!.map((child) => (
            <TreeNode
              key={child.id}
              unit={child}
              level={level + 1}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface OrganizationalUnitTreeProps {
  /** Callback when a unit is selected */
  onSelect?: (unit: OrganizationalUnit) => void;
  /** Callback when edit action is triggered */
  onEdit?: (unit: OrganizationalUnit) => void;
  /** Callback when delete action is triggered */
  onDelete?: (unit: OrganizationalUnit) => void;
  /** Callback when create action is triggered */
  onCreate?: () => void;
  /** Currently selected unit ID */
  selectedId?: string | null;
  /** Filter by unit type */
  typeFilter?: OrganizationalUnitType;
  /** Show only root units (no children) */
  flatView?: boolean;
  /** CSS class name */
  className?: string;
}

/**
 * Tree view component for displaying organizational hierarchy
 *
 * Features:
 * - Hierarchical tree view with expand/collapse
 * - Icons for different unit types
 * - Selection support
 * - Edit/Delete actions
 * - Loading and error states
 * - Empty state
 */
export function OrganizationalUnitTree({
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  selectedId,
  typeFilter,
  flatView = false,
  className = "",
}: OrganizationalUnitTreeProps) {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all units - the API returns hierarchical data when include=children is supported
      const response = await listOrganizationalUnits({
        type: typeFilter,
        per_page: 100,
      });

      if (flatView) {
        setUnits(response.data);
      } else {
        // Build tree from flat list
        const buildTree = (
          items: OrganizationalUnit[]
        ): OrganizationalUnit[] => {
          const itemMap = new Map<string, OrganizationalUnit>();
          const rootItems: OrganizationalUnit[] = [];

          // First pass: create map
          items.forEach((item) => {
            itemMap.set(item.id, { ...item, children: [] });
          });

          // Second pass: build tree
          items.forEach((item) => {
            const node = itemMap.get(item.id)!;
            if (item.parent?.id && itemMap.has(item.parent.id)) {
              const parent = itemMap.get(item.parent.id)!;
              parent.children = parent.children || [];
              parent.children.push(node);
            } else {
              rootItems.push(node);
            }
          });

          return rootItems;
        };

        setUnits(buildTree(response.data));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t`Failed to load organizational units`
      );
    } finally {
      setIsLoading(false);
    }
  }, [flatView, typeFilter]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const handleDelete = useCallback(
    async (unit: OrganizationalUnit) => {
      if (
        !window.confirm(
          t`Are you sure you want to delete "${unit.name}"? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        await deleteOrganizationalUnit(unit.id);
        await loadUnits();
        onDelete?.(unit);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t`Failed to delete organizational unit`
        );
      }
    },
    [loadUnits, onDelete]
  );

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${className} text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg`}
      >
        <Text>{error}</Text>
        <Button plain onClick={loadUnits} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div
        className={`${className} text-center py-8 text-gray-500 dark:text-gray-400`}
      >
        <BuildingOfficeIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <Subheading>
          <Trans>No Organizational Units</Trans>
        </Subheading>
        <Text className="mt-2">
          <Trans>Get started by creating your first organizational unit.</Trans>
        </Text>
        {onCreate && (
          <Button onClick={onCreate} className="mt-4">
            <Trans>Create Organizational Unit</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}>
          <Trans>Organizational Structure</Trans>
        </Heading>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Add Unit</Trans>
          </Button>
        )}
      </div>

      <div
        role="tree"
        aria-label={t`Organizational structure`}
        className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800"
      >
        {units.map((unit) => (
          <div key={unit.id} className="group">
            <TreeNode
              unit={unit}
              level={0}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={handleDelete}
              selectedId={selectedId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrganizationalUnitTree;
