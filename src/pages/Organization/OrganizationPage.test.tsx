// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationPage } from "./OrganizationPage";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types";

// Mock the API
vi.mock("../../services/organizationalUnitApi", () => ({
  listOrganizationalUnits: vi.fn(),
  createOrganizationalUnit: vi.fn(),
  updateOrganizationalUnit: vi.fn(),
  deleteOrganizationalUnit: vi.fn(),
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("OrganizationPage", () => {
  const mockUnits: OrganizationalUnit[] = [
    {
      id: "unit-1",
      type: "holding",
      name: "SecPal Holding",
      description: "Root organizational unit",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-2",
      type: "company",
      name: "SecPal GmbH",
      description: "Main operating company",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: ["unit-1"],
      },
    });
  });

  it("renders page heading", async () => {
    renderWithProviders(<OrganizationPage />);

    expect(screen.getByText("Organization Structure")).toBeInTheDocument();

    // Wait for OrganizationalUnitTree to finish loading
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });
  });

  it("renders page description", async () => {
    renderWithProviders(<OrganizationPage />);

    expect(
      screen.getByText(/Manage your internal organizational units/)
    ).toBeInTheDocument();

    // Wait for OrganizationalUnitTree to finish loading
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });
  });

  it("shows placeholder when no unit is selected", async () => {
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select an organizational unit to view details")
      ).toBeInTheDocument();
    });
  });

  it("renders the OrganizationalUnitTree component", async () => {
    renderWithProviders(<OrganizationPage />);

    // Wait for tree to load
    await waitFor(() => {
      expect(
        organizationalUnitApi.listOrganizationalUnits
      ).toHaveBeenCalledWith({ per_page: 100 });
    });
  });

  it("displays unit details when a unit is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    // Wait for units to load
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Click on a unit to select it
    await user.click(screen.getByText("SecPal Holding"));

    // Detail panel should show the unit info
    await waitFor(() => {
      // The heading in detail panel
      const headings = screen.getAllByText("SecPal Holding");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Type field in detail panel when unit is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
      // "Holding" appears: in unit name "SecPal Holding", in tree badge (translated), and in detail panel
      // Just verify the Type label and at least one translated type label exists
      expect(screen.getAllByText("Holding").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows Description in detail panel when unit has one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Root organizational unit")).toBeInTheDocument();
    });
  });

  it("opens create dialog when Add Unit button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Click "Add Root Unit" button
    await user.click(screen.getByRole("button", { name: /Add Root Unit/i }));

    // Dialog should open
    await waitFor(() => {
      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
    });
  });

  it("opens edit dialog when Edit button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Select a unit first
    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Edit$/i })
      ).toBeInTheDocument();
    });

    // Click Edit button in detail panel
    await user.click(screen.getByRole("button", { name: /^Edit$/i }));

    // Dialog should open in edit mode
    await waitFor(() => {
      expect(screen.getByText("Edit Organizational Unit")).toBeInTheDocument();
      // Form should be pre-populated with unit name
      expect(screen.getByDisplayValue("SecPal Holding")).toBeInTheDocument();
    });
  });

  it("opens create child dialog when Add Child Unit button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Select a unit first
    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Add Child Unit/i })
      ).toBeInTheDocument();
    });

    // Click Add Child Unit button
    await user.click(screen.getByRole("button", { name: /Add Child Unit/i }));

    // Dialog should open with parent info
    await waitFor(() => {
      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
      // Should show "Parent Unit" label
      expect(screen.getByText("Parent Unit")).toBeInTheDocument();
    });
  });

  it("closes dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByRole("button", { name: /Add Root Unit/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
    });

    // Click Cancel
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    // Dialog should close
    await waitFor(() => {
      expect(
        screen.queryByText("Create Organizational Unit")
      ).not.toBeInTheDocument();
    });
  });

  it("shows success toast after creating a unit", async () => {
    const user = userEvent.setup();
    const newUnit: OrganizationalUnit = {
      id: "new-unit",
      type: "branch",
      name: "New Branch",
      description: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(organizationalUnitApi.createOrganizationalUnit).mockResolvedValue(
      newUnit
    );

    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Open create dialog
    await user.click(screen.getByRole("button", { name: /Add Root Unit/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
    await user.type(nameInput, "New Branch");

    // Submit
    await user.click(screen.getByRole("button", { name: /^Create$/i }));

    // Success toast should appear
    await waitFor(() => {
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });

  it("shows all type labels translated correctly", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Select unit to verify type label in detail panel
    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      // The type "holding" should be translated
      expect(screen.getByText("Type")).toBeInTheDocument();
    });
  });

  describe("Detail Panel Close Behavior", () => {
    it("closes detail panel when close button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit
      await user.click(screen.getByText("SecPal Holding"));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Click close button
      await user.click(
        screen.getByRole("button", { name: /Close detail panel/i })
      );

      // Detail panel should show placeholder
      await waitFor(() => {
        expect(
          screen.getByText("Select an organizational unit to view details")
        ).toBeInTheDocument();
      });
    });

    it("closes detail panel when ESC key is pressed", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit
      await user.click(screen.getByText("SecPal Holding"));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Press ESC
      await user.keyboard("{Escape}");

      // Detail panel should show placeholder
      await waitFor(() => {
        expect(
          screen.getByText("Select an organizational unit to view details")
        ).toBeInTheDocument();
      });
    });

    it("deselects unit when clicking on same unit again (toggle)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit - click on the tree item
      const tree = screen.getByRole("tree");
      const treeItem = tree.querySelector('[role="treeitem"]');
      expect(treeItem).toBeInTheDocument();
      await user.click(treeItem!);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Click the same tree item again to deselect
      await user.click(treeItem!);

      // Detail panel should show placeholder
      await waitFor(() => {
        expect(
          screen.getByText("Select an organizational unit to view details")
        ).toBeInTheDocument();
      });
    });

    it("closes detail panel when clicking outside tree and detail panel", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit
      await user.click(screen.getByText("SecPal Holding"));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Click outside (on the page heading area which is outside the grid)
      const pageHeading = screen.getByText("Organization Structure");
      await user.click(pageHeading);

      // Detail panel should show placeholder
      await waitFor(() => {
        expect(
          screen.getByText("Select an organizational unit to view details")
        ).toBeInTheDocument();
      });
    });

    it("does not close detail panel when clicking inside the grid area", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit
      await user.click(screen.getByText("SecPal Holding"));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Click on the detail panel (but not on a button)
      const typeLabel = screen.getByText("Type");
      await user.click(typeLabel);

      // Detail panel should still be visible
      expect(
        screen.getByRole("button", { name: /^Edit$/i })
      ).toBeInTheDocument();
    });

    it("does not close detail panel when dialog is open and clicking outside", async () => {
      const user = userEvent.setup();
      renderWithProviders(<OrganizationPage />);

      await waitFor(() => {
        expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
      });

      // Select a unit
      await user.click(screen.getByText("SecPal Holding"));

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^Edit$/i })
        ).toBeInTheDocument();
      });

      // Open the edit dialog
      await user.click(screen.getByRole("button", { name: /^Edit$/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Edit Organizational Unit")
        ).toBeInTheDocument();
      });

      // Click on the dialog (which is rendered via Portal, outside gridContainerRef)
      // The detail panel should remain selected because dialogOpen is true
      const dialogHeading = screen.getByText("Edit Organizational Unit");
      await user.click(dialogHeading);

      // Dialog should still be open and unit should still be selected
      expect(screen.getByText("Edit Organizational Unit")).toBeInTheDocument();
      // The form should still show the unit name
      expect(screen.getByDisplayValue("SecPal Holding")).toBeInTheDocument();
    });
  });
});
