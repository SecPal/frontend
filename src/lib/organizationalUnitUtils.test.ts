// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { i18n } from "@lingui/core";
import {
  getTypeLabel,
  getUnitTypeOptions,
  getTypeBadgeColor,
  getValidChildTypeOptions,
  getDefaultChildType,
  TYPE_HIERARCHY,
} from "./organizationalUnitUtils";

describe("organizationalUnitUtils", () => {
  beforeEach(() => {
    // Activate i18n for tests with empty messages (uses source strings)
    i18n.load("en", {});
    i18n.activate("en");
  });

  describe("getTypeBadgeColor", () => {
    it("returns blue for holding type", () => {
      expect(getTypeBadgeColor("holding")).toBe("blue");
    });

    it("returns blue for company type", () => {
      expect(getTypeBadgeColor("company")).toBe("blue");
    });

    it("returns green for department type", () => {
      expect(getTypeBadgeColor("department")).toBe("green");
    });

    it("returns green for division type", () => {
      expect(getTypeBadgeColor("division")).toBe("green");
    });

    it("returns purple for branch type", () => {
      expect(getTypeBadgeColor("branch")).toBe("purple");
    });

    it("returns orange for region type", () => {
      expect(getTypeBadgeColor("region")).toBe("orange");
    });

    it("returns zinc for custom type", () => {
      expect(getTypeBadgeColor("custom")).toBe("zinc");
    });

    it("returns zinc for unknown types", () => {
      expect(getTypeBadgeColor("unknown-type")).toBe("zinc");
    });
  });

  describe("getTypeLabel", () => {
    it("returns translated label for holding type", () => {
      expect(getTypeLabel("holding")).toBe("Holding");
    });

    it("returns translated label for company type", () => {
      expect(getTypeLabel("company")).toBe("Company");
    });

    it("returns translated label for region type", () => {
      expect(getTypeLabel("region")).toBe("Region");
    });

    it("returns translated label for branch type", () => {
      expect(getTypeLabel("branch")).toBe("Branch");
    });

    it("returns translated label for division type", () => {
      expect(getTypeLabel("division")).toBe("Division");
    });

    it("returns translated label for department type", () => {
      expect(getTypeLabel("department")).toBe("Department");
    });

    it("returns translated label for custom type", () => {
      expect(getTypeLabel("custom")).toBe("Custom");
    });

    it("returns the raw type string for unknown types", () => {
      expect(getTypeLabel("unknown-type")).toBe("unknown-type");
    });
  });

  describe("getUnitTypeOptions", () => {
    it("returns all 7 organizational unit types", () => {
      const options = getUnitTypeOptions();
      expect(options).toHaveLength(7);
    });

    it("returns options with correct values", () => {
      const options = getUnitTypeOptions();
      const values = options.map((o) => o.value);
      expect(values).toEqual([
        "holding",
        "company",
        "region",
        "branch",
        "division",
        "department",
        "custom",
      ]);
    });

    it("returns options with translated labels", () => {
      const options = getUnitTypeOptions();
      const labels = options.map((o) => o.label);
      expect(labels).toEqual([
        "Holding",
        "Company",
        "Region",
        "Branch",
        "Division",
        "Department",
        "Custom",
      ]);
    });
  });

  describe("TYPE_HIERARCHY", () => {
    it("defines correct hierarchy ranks", () => {
      expect(TYPE_HIERARCHY.holding).toBe(1);
      expect(TYPE_HIERARCHY.company).toBe(2);
      expect(TYPE_HIERARCHY.region).toBe(3);
      expect(TYPE_HIERARCHY.branch).toBe(4);
      expect(TYPE_HIERARCHY.division).toBe(5);
      expect(TYPE_HIERARCHY.department).toBe(6);
      expect(TYPE_HIERARCHY.custom).toBe(7);
    });
  });

  describe("getValidChildTypeOptions", () => {
    it("returns only lower-hierarchy types for branch parent", () => {
      const options = getValidChildTypeOptions("branch");
      const values = options.map((o) => o.value);

      // Branch has rank 4, so only types with rank > 4 should be returned
      expect(values).toEqual(["division", "department", "custom"]);
      expect(values).not.toContain("branch"); // Same-level nesting forbidden
      expect(values).not.toContain("holding");
      expect(values).not.toContain("company");
      expect(values).not.toContain("region");
    });

    it("returns only lower-hierarchy types for company parent", () => {
      const options = getValidChildTypeOptions("company");
      const values = options.map((o) => o.value);

      // Company has rank 2, so only types with rank > 2 should be returned
      expect(values).toEqual([
        "region",
        "branch",
        "division",
        "department",
        "custom",
      ]);
      expect(values).not.toContain("company"); // Same-level nesting forbidden
      expect(values).not.toContain("holding");
    });

    it("returns only lower-hierarchy types for holding parent", () => {
      const options = getValidChildTypeOptions("holding");
      const values = options.map((o) => o.value);

      // Holding has rank 1 (highest), so all other types are valid children
      expect(values).toEqual([
        "company",
        "region",
        "branch",
        "division",
        "department",
        "custom",
      ]);
      expect(values).not.toContain("holding"); // Same-level nesting forbidden
    });

    it("returns no options for custom type (lowest hierarchy)", () => {
      const options = getValidChildTypeOptions("custom");

      // Custom has rank 7 (lowest), so no type can be its child
      expect(options).toHaveLength(0);
    });

    it("returns options with translated labels", () => {
      const options = getValidChildTypeOptions("branch");

      expect(options).toHaveLength(3);
      expect(options[0]?.label).toBe("Division");
      expect(options[1]?.label).toBe("Department");
      expect(options[2]?.label).toBe("Custom");
    });
  });

  describe("getDefaultChildType", () => {
    it("returns 'holding' for root units (undefined parent)", () => {
      expect(getDefaultChildType(undefined)).toBe("holding");
    });

    it("returns 'company' for holding parent", () => {
      expect(getDefaultChildType("holding")).toBe("company");
    });

    it("returns 'region' for company parent", () => {
      expect(getDefaultChildType("company")).toBe("region");
    });

    it("returns 'branch' for region parent", () => {
      expect(getDefaultChildType("region")).toBe("branch");
    });

    it("returns 'division' for branch parent", () => {
      expect(getDefaultChildType("branch")).toBe("division");
    });

    it("returns 'department' for division parent", () => {
      expect(getDefaultChildType("division")).toBe("department");
    });

    it("returns 'custom' for department parent", () => {
      expect(getDefaultChildType("department")).toBe("custom");
    });

    it("returns undefined for custom parent (no lower level)", () => {
      expect(getDefaultChildType("custom")).toBeUndefined();
    });
  });
});
