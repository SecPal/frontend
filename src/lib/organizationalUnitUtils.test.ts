// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { i18n } from "@lingui/core";
import {
  getTypeLabel,
  getUnitTypeOptions,
  getTypeBadgeColor,
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
});
