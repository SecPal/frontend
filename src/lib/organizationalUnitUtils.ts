// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { t } from "@lingui/macro";
import type { OrganizationalUnitType } from "../types/organizational";

/**
 * Badge color type for organizational unit type badges
 * Matches the color prop accepted by the Badge component
 */
export type BadgeColor = "blue" | "green" | "purple" | "orange" | "zinc";

/**
 * Hierarchy ranking for organizational unit types
 * Lower numbers = higher in hierarchy (more senior)
 * Child units must have rank >= parent rank
 *
 * This mirrors the backend validation in StoreOrganizationalUnitRequest
 * @see Issue #301: Backend validation for organizational unit hierarchy
 */
export const TYPE_HIERARCHY: Record<OrganizationalUnitType, number> = {
  holding: 1,
  company: 2,
  region: 3,
  branch: 4,
  division: 5,
  department: 6,
  custom: 7,
};

/**
 * Get badge color for organizational unit type
 *
 * Color mapping:
 * - blue: holding, company (top-level organizational entities)
 * - green: department, division (team-based units)
 * - purple: branch (physical locations)
 * - orange: region (geographic groupings)
 * - zinc: custom/unknown types
 *
 * @param type - The organizational unit type
 * @returns Badge color string
 */
export function getTypeBadgeColor(
  type: OrganizationalUnitType | string
): BadgeColor {
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

/**
 * Get translated type label for organizational unit type
 *
 * Note: This function must be called at render time, not at module load time,
 * because Lingui's t() macro requires an active i18n context.
 *
 * @param type - The organizational unit type
 * @returns Translated label string
 */
export function getTypeLabel(type: OrganizationalUnitType | string): string {
  switch (type) {
    case "holding":
      return t`Holding`;
    case "company":
      return t`Company`;
    case "region":
      return t`Region`;
    case "branch":
      return t`Branch`;
    case "division":
      return t`Division`;
    case "department":
      return t`Department`;
    case "custom":
      return t`Custom`;
    default:
      return type;
  }
}

/**
 * Get translated type options for organizational unit select dropdowns
 *
 * Note: This function must be called at render time, not at module load time,
 * because Lingui's t() macro requires an active i18n context.
 *
 * @returns Array of type options with value and translated label
 */
export function getUnitTypeOptions(): Array<{
  value: OrganizationalUnitType;
  label: string;
}> {
  return [
    { value: "holding", label: t`Holding` },
    { value: "company", label: t`Company` },
    { value: "region", label: t`Region` },
    { value: "branch", label: t`Branch` },
    { value: "division", label: t`Division` },
    { value: "department", label: t`Department` },
    { value: "custom", label: t`Custom` },
  ];
}

/**
 * Get valid child type options for a given parent type
 * Filters types based on hierarchy rules: child rank must be > parent rank
 * (i.e., child must be lower in hierarchy than parent)
 *
 * @param parentType - The parent's organizational unit type
 * @returns Array of valid child type options with value and translated label
 *
 * @example
 * // For a branch parent (rank 4), returns: division, department, custom
 * // (not branch itself, as same-level nesting is invalid)
 * getValidChildTypeOptions('branch')
 */
export function getValidChildTypeOptions(
  parentType: OrganizationalUnitType
): Array<{
  value: OrganizationalUnitType;
  label: string;
}> {
  const parentRank = TYPE_HIERARCHY[parentType];
  const allOptions = getUnitTypeOptions();

  return allOptions.filter((option) => {
    const childRank = TYPE_HIERARCHY[option.value];
    return childRank > parentRank;
  });
}

/**
 * Get the default child type for a given parent type
 * Returns the next level down in the hierarchy (parent rank + 1)
 * If no next level exists, returns undefined
 *
 * @param parentType - The parent's organizational unit type, or undefined for root units
 * @returns The default child type, or undefined if no valid child type exists
 *
 * @example
 * getDefaultChildType('holding') // returns 'company'
 * getDefaultChildType('branch')  // returns 'division'
 * getDefaultChildType('custom')  // returns undefined (no lower level)
 * getDefaultChildType(undefined) // returns 'holding' (for root units)
 */
export function getDefaultChildType(
  parentType: OrganizationalUnitType | undefined
): OrganizationalUnitType | undefined {
  // For root units, default to 'holding'
  if (!parentType) {
    return "holding";
  }

  const parentRank = TYPE_HIERARCHY[parentType];
  const allTypes = Object.keys(TYPE_HIERARCHY) as OrganizationalUnitType[];

  // Find the type with rank = parentRank + 1
  return allTypes.find((type) => TYPE_HIERARCHY[type] === parentRank + 1);
}
