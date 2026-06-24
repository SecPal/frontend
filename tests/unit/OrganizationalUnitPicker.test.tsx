// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, test, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitPicker } from "../../src/components/OrganizationalUnitPicker";
import type { OrganizationalUnit } from "../../src/types/organizational";

// Wrapper to provide i18n context
function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

function openOrganizationalUnitPicker() {
  const trigger = screen.getByRole("combobox", {
    name: /select organizational unit/i,
  });

  fireEvent.pointerDown(trigger);
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);
}

function selectRadixOption(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
}

describe("OrganizationalUnitPicker", () => {
  const mockUnits: OrganizationalUnit[] = [
    {
      id: "unit-1",
      name: "Holding Company",
      type: "holding",
      parent: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-2",
      name: "Germany Branch",
      type: "branch",
      parent: {
        id: "unit-1",
        name: "Holding Company",
        type: "holding",
        parent: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-3",
      name: "IT Department",
      type: "department",
      parent: {
        id: "unit-2",
        name: "Germany Branch",
        type: "branch",
        parent: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  test("renders All Units option", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    expect(screen.getByText("All Units")).toBeInTheDocument();
  });

  test("renders all organizational units after opening listbox", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    openOrganizationalUnitPicker();

    // Now the options should be visible
    expect(screen.getByText("Holding Company")).toBeInTheDocument();
    expect(screen.getByText("Germany Branch")).toBeInTheDocument();
    expect(screen.getByText("IT Department")).toBeInTheDocument();
  });

  test("displays units in hierarchical order after opening", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    openOrganizationalUnitPicker();

    // Options are rendered in a portal, check in document
    const unitElements = document.querySelectorAll('[role="option"]');
    expect(unitElements.length).toBe(4); // All Units + 3 units
  });

  test("calls onChange when unit is selected", () => {
    const onChange = vi.fn();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    openOrganizationalUnitPicker();

    // Click on an option
    const germanyOption = screen.getByRole("option", {
      name: /Germany Branch/i,
    });
    selectRadixOption(germanyOption);

    expect(onChange).toHaveBeenCalledWith("unit-2");
  });

  test("displays custom label for All Units option", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
        allUnitsLabel="All Organizations"
      />
    );

    expect(screen.getByText("All Organizations")).toBeInTheDocument();
  });

  test("keeps All Units icon aligned and label truncatable after opening", () => {
    const onChange = vi.fn();
    const allUnitsLabel =
      "All organizational units with a deliberately long label";

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
        allUnitsLabel={allUnitsLabel}
      />
    );

    openOrganizationalUnitPicker();

    const option = screen.getByRole("option", { name: allUnitsLabel });
    const label = within(option).getByText(allUnitsLabel);
    const contentRow = label.parentElement;

    expect(contentRow).toHaveClass(
      "flex",
      "w-full",
      "min-w-0",
      "items-center",
      "gap-2"
    );
    expect(contentRow?.querySelector("svg")).toHaveClass("shrink-0");
    expect(label).toHaveClass("min-w-0", "truncate");
  });

  test("handles disabled state", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
        disabled={true}
      />
    );

    const trigger = screen.getByRole("combobox", {
      name: /select organizational unit/i,
    });
    expect(trigger).toBeDisabled();
  });

  test("shows type labels for units after opening", async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    openOrganizationalUnitPicker();

    // Check for type labels in parentheses - use getAllByText since unit names also contain these words
    expect(screen.getByText("(Holding)")).toBeInTheDocument();
    expect(screen.getByText("(Branch)")).toBeInTheDocument();
    expect(screen.getByText("(Department)")).toBeInTheDocument();
  });

  test("handles empty units array", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker units={[]} value="" onChange={onChange} />
    );

    expect(screen.getByText("All Units")).toBeInTheDocument();
  });

  test("alphabetically sorts units within same hierarchy level", async () => {
    const unitsWithMultipleSiblings: OrganizationalUnit[] = [
      {
        id: "unit-1",
        name: "Holding Company",
        type: "holding",
        parent: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "unit-2",
        name: "Zebra Branch",
        type: "branch",
        parent: {
          id: "unit-1",
          name: "Holding Company",
          type: "holding",
          parent: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "unit-3",
        name: "Alpha Branch",
        type: "branch",
        parent: {
          id: "unit-1",
          name: "Holding Company",
          type: "holding",
          parent: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ];

    const onChange = vi.fn();
    renderWithI18n(
      <OrganizationalUnitPicker
        units={unitsWithMultipleSiblings}
        value=""
        onChange={onChange}
      />
    );

    openOrganizationalUnitPicker();

    // Options are in a portal
    const options = document.querySelectorAll('[role="option"]');
    const optionTexts = Array.from(options).map((opt) => opt.textContent);

    const alphaIndex = optionTexts.findIndex((text) =>
      text?.includes("Alpha Branch")
    );
    const zebraIndex = optionTexts.findIndex((text) =>
      text?.includes("Zebra Branch")
    );

    expect(alphaIndex).toBeLessThan(zebraIndex);
  });
});
