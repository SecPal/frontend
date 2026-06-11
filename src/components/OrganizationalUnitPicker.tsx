// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Building2, Home, MapPin, Users } from "lucide-react";
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
        <Building2
          className={`${className} text-blue-500`}
          aria-hidden="true"
        />
      );
    case "department":
    case "division":
      return (
        <Users
          className={`${className} text-green-500`}
          aria-hidden="true"
        />
      );
    case "branch":
      return (
        <Building2
          className={`${className} text-purple-500`}
          aria-hidden="true"
        />
      );
    case "region":
      return (
        <MapPin
          className={`${className} text-orange-500`}
          aria-hidden="true"
        />
      );
    default:
      return (
        <Building2
          className={`${className} text-gray-500`}
          aria-hidden="true"
        />
      );
  }
}

/**
 * Root icon for "All Units" option
 */
function RootIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Home
      aria-hidden="true"
      className={`${className} text-gray-400`}
    />
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
