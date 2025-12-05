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
