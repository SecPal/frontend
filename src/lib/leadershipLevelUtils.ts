// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  RankRangeValidation,
  RankRangePreset,
} from "../types/leadershipLevel";

/**
 * Rank Range Validation Utilities
 *
 * Based on Issue #426 Section: Invalid Combination Prevention
 * ADR-009 Section 5: UI/UX Specification
 */

/**
 * Validate rank range combination
 * Prevents invalid combinations like min=5, max=0 and min=0, max=5
 */
export function validateRankRange(
  min: number | null,
  max: number | null
): RankRangeValidation {
  // Invalid: Guards (min=0) mixed with Leadership (max>0 or max=null)
  // Must use separate scopes: one for Guards (min=0, max=0), one for Leadership (min>0, max>0)
  if (min === 0 && (max === null || max > 0)) {
    return {
      valid: false,
      error:
        "Guards (min=0, max=0) and Leadership (min>0, max>0) must use separate scopes.",
    };
  }

  // Invalid: min=5, max=0 (no employees match)
  if (min !== null && min > 0 && (max === null || max === 0)) {
    return {
      valid: false,
      error:
        "Invalid combination: No employees will be visible with this range. Use null/0 for max to see only non-leadership employees.",
    };
  }

  // Invalid: min > max (when both set and max > 0)
  if (min !== null && max !== null && max > 0 && min > max) {
    return {
      valid: false,
      error: "Minimum rank cannot be greater than maximum rank.",
    };
  }

  return { valid: true };
}

/**
 * Check if user's rank is within viewable range (for Step 3 conditional display)
 */
export function isUserRankInViewableRange(
  userRank: number | null,
  minViewableRank: number | null,
  maxViewableRank: number | null
): boolean {
  if (userRank === null) {
    return false; // User has no leadership level
  }

  // Check min boundary
  if (minViewableRank !== null && userRank < minViewableRank) {
    return false;
  }

  // Check max boundary
  // max=null/0 means "only non-leadership", so user rank NOT in range
  if (maxViewableRank === null || maxViewableRank === 0) {
    return false;
  }

  // Check if user rank exceeds max
  if (userRank > maxViewableRank) {
    return false;
  }

  return true;
}

/**
 * Get preset rank range configurations for UI dropdowns
 */
export function getViewingRankPresets(
  userRank: number | null
): RankRangePreset[] {
  const presets: RankRangePreset[] = [
    {
      label: "Only Guards (non-leadership)",
      min: null,
      max: 0,
    },
    {
      label: "All leadership levels",
      min: 1,
      max: 255,
    },
  ];

  // Add "Only subordinates" preset if user has a rank
  if (userRank !== null && userRank < 255) {
    presets.splice(1, 0, {
      label: "Only subordinates",
      min: userRank + 1,
      max: 255,
    });
  }

  presets.push({
    label: "Custom range",
    min: null, // Will be set by user
    max: null,
  });

  return presets;
}

/**
 * Get preset assignment rank range configurations
 */
export function getAssignmentRankPresets(
  userRank: number | null
): RankRangePreset[] {
  const presets: RankRangePreset[] = [
    {
      label: "Cannot assign/remove leadership",
      min: null,
      max: 0,
    },
    {
      label: "Can assign/remove all leadership",
      min: 1,
      max: 255,
    },
  ];

  // Add "Can assign/remove subordinates" preset if user has a rank
  if (userRank !== null && userRank < 255) {
    presets.splice(1, 0, {
      label: "Can assign/remove subordinates",
      min: userRank + 1,
      max: 255,
    });
  }

  presets.push({
    label: "Custom range",
    min: null,
    max: null,
  });

  return presets;
}

/**
 * Generate warning message if max_assignable_rank < max_viewable_rank
 */
export function getPermissionEscalationWarning(
  maxViewableRank: number | null,
  maxAssignableRank: number | null
): string | null {
  // No warning if either is null/0
  if (
    maxViewableRank === null ||
    maxViewableRank === 0 ||
    maxAssignableRank === null ||
    maxAssignableRank === 0
  ) {
    return null;
  }

  // Warning if user can see levels they cannot assign/remove
  if (maxAssignableRank < maxViewableRank) {
    return `User can see leadership levels up to FE${maxViewableRank} but can only assign/remove up to FE${maxAssignableRank}. This may cause confusion.`;
  }

  return null;
}

/**
 * Generate info message explaining null/0 semantics
 */
export function getRankRangeInfoMessage(
  min: number | null,
  max: number | null,
  type: "viewing" | "assignment"
): string | null {
  // max=null/0 means "only non-leadership"
  if (max === null || max === 0) {
    // Special case: both null means no filter at all
    if (min === null && max === null) {
      return null;
    }

    if (type === "viewing") {
      return "Only non-leadership employees (Guards) will be visible.";
    } else {
      return "User cannot assign OR remove ANY leadership level. Can only manage non-leadership employees.";
    }
  }

  // max=255 means "all leadership"
  if (max === 255 && (min === null || min === 1)) {
    if (type === "viewing") {
      return "All leadership levels (FE1-FE255) will be visible.";
    } else {
      return "User can assign/remove all leadership levels.";
    }
  }

  // Custom range
  if (min !== null && max !== null && max > 0) {
    const safeMax = max; // max is guaranteed > 0 here
    if (type === "viewing") {
      return `Only employees with leadership levels FE${min} to FE${safeMax} will be visible.`;
    } else {
      return `User can assign/remove leadership levels FE${min} to FE${safeMax}.`;
    }
  }

  return null;
}
