// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import {
  validateRankRange,
  isUserRankInViewableRange,
  getViewingRankPresets,
  getAssignmentRankPresets,
  getPermissionEscalationWarning,
  getRankRangeInfoMessage,
} from "./leadershipLevelUtils";

describe("leadershipLevelUtils", () => {
  describe("validateRankRange", () => {
    it("should reject invalid combination: min=5, max=0", () => {
      const result = validateRankRange(5, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No employees will be visible");
    });

    it("should reject invalid combination: min=5, max=null", () => {
      const result = validateRankRange(5, null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No employees will be visible");
    });

    it("should reject min > max when both set", () => {
      const result = validateRankRange(10, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum rank cannot be greater");
    });

    it("should accept valid combination: min=null, max=0 (only non-leadership)", () => {
      const result = validateRankRange(null, 0);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid combination: min=5, max=255", () => {
      const result = validateRankRange(5, 255);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid combination: min=1, max=10", () => {
      const result = validateRankRange(1, 10);
      expect(result.valid).toBe(true);
    });

    it("should accept null for both (no filter)", () => {
      const result = validateRankRange(null, null);
      expect(result.valid).toBe(true);
    });
  });

  describe("isUserRankInViewableRange", () => {
    it("should return false if user has no leadership level", () => {
      const result = isUserRankInViewableRange(null, 1, 255);
      expect(result).toBe(false);
    });

    it("should return false if user rank below min", () => {
      const result = isUserRankInViewableRange(3, 5, 255);
      expect(result).toBe(false);
    });

    it("should return false if user rank above max", () => {
      const result = isUserRankInViewableRange(10, 1, 5);
      expect(result).toBe(false);
    });

    it("should return false if max=null/0 (only non-leadership)", () => {
      const result = isUserRankInViewableRange(5, null, 0);
      expect(result).toBe(false);
    });

    it("should return true if user rank within range", () => {
      const result = isUserRankInViewableRange(5, 3, 10);
      expect(result).toBe(true);
    });

    it("should return true if user rank equals min boundary", () => {
      const result = isUserRankInViewableRange(5, 5, 255);
      expect(result).toBe(true);
    });

    it("should return true if user rank equals max boundary", () => {
      const result = isUserRankInViewableRange(10, 1, 10);
      expect(result).toBe(true);
    });

    it("should return true if min=null (no lower bound)", () => {
      const result = isUserRankInViewableRange(3, null, 10);
      expect(result).toBe(true);
    });
  });

  describe("getViewingRankPresets", () => {
    it("should return 4 presets for user with rank", () => {
      const presets = getViewingRankPresets(3);
      expect(presets).toHaveLength(4);
      expect(presets[0]?.label).toBe("Only Guards (non-leadership)");
      expect(presets[1]?.label).toBe("Only subordinates");
      expect(presets[2]?.label).toBe("All leadership levels");
      expect(presets[3]?.label).toBe("Custom range");
    });

    it("should return subordinates preset with correct rank", () => {
      const presets = getViewingRankPresets(3);
      const subordinatesPreset = presets.find((p) =>
        p.label.includes("subordinates")
      );
      expect(subordinatesPreset).toBeDefined();
      expect(subordinatesPreset?.min).toBe(4); // userRank + 1
      expect(subordinatesPreset?.max).toBe(255);
    });

    it("should return 3 presets for user without rank", () => {
      const presets = getViewingRankPresets(null);
      expect(presets).toHaveLength(3);
      expect(
        presets.find((p) => p.label.includes("subordinates"))
      ).toBeUndefined();
    });

    it("should not include subordinates preset if rank=255", () => {
      const presets = getViewingRankPresets(255);
      expect(presets).toHaveLength(3);
      expect(
        presets.find((p) => p.label.includes("subordinates"))
      ).toBeUndefined();
    });
  });

  describe("getAssignmentRankPresets", () => {
    it("should return 4 presets for user with rank", () => {
      const presets = getAssignmentRankPresets(3);
      expect(presets).toHaveLength(4);
      expect(presets[0]?.label).toBe("Cannot assign/remove leadership");
      expect(presets[1]?.label).toBe("Can assign/remove subordinates");
      expect(presets[2]?.label).toBe("Can assign/remove all leadership");
      expect(presets[3]?.label).toBe("Custom range");
    });

    it("should return subordinates preset with correct rank", () => {
      const presets = getAssignmentRankPresets(5);
      const subordinatesPreset = presets.find((p) =>
        p.label.includes("subordinates")
      );
      expect(subordinatesPreset).toBeDefined();
      expect(subordinatesPreset?.min).toBe(6); // userRank + 1
      expect(subordinatesPreset?.max).toBe(255);
    });

    it("should return 3 presets for user without rank", () => {
      const presets = getAssignmentRankPresets(null);
      expect(presets).toHaveLength(3);
    });
  });

  describe("getPermissionEscalationWarning", () => {
    it("should return warning if max_assignable < max_viewable", () => {
      const warning = getPermissionEscalationWarning(10, 5);
      expect(warning).toContain("can see leadership levels up to FE10");
      expect(warning).toContain("assign/remove up to FE5");
    });

    it("should return null if max_assignable >= max_viewable", () => {
      const warning = getPermissionEscalationWarning(5, 10);
      expect(warning).toBeNull();
    });

    it("should return null if either is null/0", () => {
      expect(getPermissionEscalationWarning(0, 5)).toBeNull();
      expect(getPermissionEscalationWarning(5, 0)).toBeNull();
      expect(getPermissionEscalationWarning(null, 5)).toBeNull();
      expect(getPermissionEscalationWarning(5, null)).toBeNull();
    });

    it("should return null if max_assignable equals max_viewable", () => {
      const warning = getPermissionEscalationWarning(10, 10);
      expect(warning).toBeNull();
    });
  });

  describe("getRankRangeInfoMessage", () => {
    it("should return info for viewing non-leadership only", () => {
      const message = getRankRangeInfoMessage(null, 0, "viewing");
      expect(message).toContain("non-leadership employees");
      expect(message).toContain("Guards");
    });

    it("should return info for assignment non-leadership only", () => {
      const message = getRankRangeInfoMessage(null, 0, "assignment");
      expect(message).toContain("cannot assign OR remove ANY");
    });

    it("should return info for viewing all leadership", () => {
      const message = getRankRangeInfoMessage(1, 255, "viewing");
      expect(message).toContain("All leadership levels");
      expect(message).toContain("FE1-FE255");
    });

    it("should return info for assignment all leadership", () => {
      const message = getRankRangeInfoMessage(1, 255, "assignment");
      expect(message).toContain("assign/remove all leadership");
    });

    it("should return info for custom viewing range", () => {
      const message = getRankRangeInfoMessage(5, 10, "viewing");
      expect(message).toContain("FE5 to FE10");
      expect(message).toContain("will be visible");
    });

    it("should return info for custom assignment range", () => {
      const message = getRankRangeInfoMessage(5, 10, "assignment");
      expect(message).toContain("FE5 to FE10");
      expect(message).toContain("assign/remove");
    });

    it("should return null for invalid combinations", () => {
      const message = getRankRangeInfoMessage(null, null, "viewing");
      expect(message).toBeNull();
    });
  });
});
