// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { Trans, t } from "@lingui/macro";
import { Listbox, ListboxOption, ListboxLabel } from "./listbox";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import { getTypeLabel } from "../lib/organizationalUnitUtils";

/**
 * Flattened unit with hierarchy information for display
 */
interface FlattenedUnit {
  id: string;
  name: string;
  type: OrganizationalUnitType;
  depth: number;
}

/**
 * Icon component for organizational unit types
 */
function UnitTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: OrganizationalUnitType;
  className?: string;
}) {
  switch (type) {
    case "holding":
    case "company":
      return (
        <svg
          className={`${className} text-blue-500`}
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
    case "department":
    case "division":
      return (
        <svg
          className={`${className} text-green-500`}
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
    case "branch":
      return (
        <svg
          className={`${className} text-purple-500`}
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
    case "region":
      return (
        <svg
          className={`${className} text-orange-500`}
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
    default:
      return (
        <svg
          className={`${className} text-gray-500`}
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
}

/**
 * Root icon for "All Units" option
 */
function RootIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} text-gray-400`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

/**
 * Props for OrganizationalUnitPicker
 */
export interface OrganizationalUnitPickerProps {
  /** Available organizational units */
  units: OrganizationalUnit[];
  /** Currently selected unit ID (empty string for "All Units") */
  value: string;
  /** Callback when selection changes */
  onChange: (unitId: string) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Label for "All Units" option */
  allUnitsLabel?: string;
  /** Aria label for the picker */
  ariaLabel?: string;
}

/**
 * Hierarchical organizational unit picker using Listbox
 *
 * Displays organizational units in a hierarchical tree structure with:
 * - Type-specific icons and colors
 * - Indentation based on depth in hierarchy
 * - Type labels for each unit
 * - Searchable/filterable interface
 * - "All Units" option at the top
 */
export function OrganizationalUnitPicker({
  units,
  value,
  onChange,
  disabled = false,
  allUnitsLabel,
  ariaLabel,
}: OrganizationalUnitPickerProps) {
  /**
   * Build a hierarchically sorted list of units for display.
   * This preserves the tree structure as a flat list with depth indicators.
   */
  const sortedUnits = useMemo((): FlattenedUnit[] => {
    if (units.length === 0) return [];

    // Create a map of parent ID to children
    const childrenMap = new Map<string, OrganizationalUnit[]>();
    const rootUnits: OrganizationalUnit[] = [];

    // Build parent-children relationships
    units.forEach((u) => {
      const parentId = u.parent?.id || "";
      if (!parentId) {
        rootUnits.push(u);
      } else {
        const children = childrenMap.get(parentId) || [];
        children.push(u);
        childrenMap.set(parentId, children);
      }
    });

    // Sort children alphabetically within each level
    rootUnits.sort((a, b) => a.name.localeCompare(b.name));
    childrenMap.forEach((children) => {
      children.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Flatten the tree with depth information (pre-order traversal)
    const result: FlattenedUnit[] = [];

    const traverse = (units: OrganizationalUnit[], depth: number) => {
      units.forEach((u) => {
        result.push({
          id: u.id,
          name: u.name,
          type: u.type,
          depth,
        });
        const children = childrenMap.get(u.id);
        if (children) {
          traverse(children, depth + 1);
        }
      });
    };

    traverse(rootUnits, 0);
    return result;
  }, [units]);

  return (
    <Listbox
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel || t`Select organizational unit`}
    >
      {/* "All Units" option */}
      <ListboxOption value="">
        <RootIcon className="h-4 w-4" />
        <ListboxLabel>{allUnitsLabel || <Trans>All Units</Trans>}</ListboxLabel>
      </ListboxOption>

      {/* Hierarchically sorted units with indentation and icons */}
      {sortedUnits.map((u) => (
        <ListboxOption key={u.id} value={u.id}>
          <span
            className="flex items-center gap-2"
            style={{ paddingLeft: `${u.depth * 16}px` }}
          >
            <UnitTypeIcon type={u.type} className="h-4 w-4 shrink-0" />
            <span className="truncate">{u.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({getTypeLabel(u.type)})
            </span>
          </span>
        </ListboxOption>
      ))}
    </Listbox>
  );
}

export default OrganizationalUnitPicker;
