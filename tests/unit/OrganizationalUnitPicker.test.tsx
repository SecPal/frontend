// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitPicker } from "../../src/components/OrganizationalUnitPicker";
import type { OrganizationalUnit } from "../../src/types/organizational";

// Wrapper to provide i18n context
function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
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
    const user = userEvent.setup();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    // Open the listbox by clicking the button
    const button = screen.getByRole("button");
    await user.click(button);

    // Now the options should be visible
    expect(screen.getByText("Holding Company")).toBeInTheDocument();
    expect(screen.getByText("Germany Branch")).toBeInTheDocument();
    expect(screen.getByText("IT Department")).toBeInTheDocument();
  });

  test("displays units in hierarchical order after opening", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    // Open the listbox
    const button = screen.getByRole("button");
    await user.click(button);

    // Options are rendered in a portal, check in document
    const unitElements = document.querySelectorAll('[role="option"]');
    expect(unitElements.length).toBe(4); // All Units + 3 units
  });

  test("calls onChange when unit is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    // Open the listbox
    const button = screen.getByRole("button");
    await user.click(button);

    // Click on an option
    const germanyOption = screen.getByText("Germany Branch");
    await user.click(germanyOption);

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

    const button = screen.getByRole("button");
    expect(button.getAttribute("data-disabled")).toBe("");
  });

  test("shows type labels for units after opening", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={mockUnits}
        value=""
        onChange={onChange}
      />
    );

    // Open the listbox
    const button = screen.getByRole("button");
    await user.click(button);

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
    const user = userEvent.setup();

    renderWithI18n(
      <OrganizationalUnitPicker
        units={unitsWithMultipleSiblings}
        value=""
        onChange={onChange}
      />
    );

    // Open the listbox
    const button = screen.getByRole("button");
    await user.click(button);

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
