// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MoveOrganizationalUnitDialog } from "./MoveOrganizationalUnitDialog";
import type { OrganizationalUnit } from "../types/organizational";

// Mock the API module
vi.mock("../services/organizationalUnitApi", () => ({
  listOrganizationalUnits: vi.fn(),
  attachOrganizationalUnitParent: vi.fn(),
  detachOrganizationalUnitParent: vi.fn(),
}));

// Mock secretApi for ApiError
vi.mock("../services/secretApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    constructor(
      message: string,
      status: number,
      errors?: Record<string, string[]>
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.errors = errors;
    }
  },
}));

import {
  listOrganizationalUnits,
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
} from "../services/organizationalUnitApi";
import { ApiError } from "../services/secretApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("MoveOrganizationalUnitDialog", () => {
  const mockUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Mitte",
    description: "Branch in central Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockUnitWithParent: OrganizationalUnit = {
    id: "unit-2",
    type: "branch",
    name: "Berlin Kreuzberg",
    description: "Branch in Kreuzberg",
    metadata: null,
    parent: {
      id: "parent-1",
      type: "region",
      name: "Region Berlin",
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockAvailableUnits: OrganizationalUnit[] = [
    {
      id: "available-1",
      type: "region",
      name: "Region Hamburg",
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "available-2",
      type: "region",
      name: "Region München",
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "parent-1",
      type: "region",
      name: "Region Berlin",
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for listOrganizationalUnits
    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: mockAvailableUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: mockAvailableUnits.length,
        root_unit_ids: [],
      },
    });
  });

  describe("Rendering", () => {
    it("renders dialog with unit name in title", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Move "Berlin Mitte"/)).toBeInTheDocument();
    });

    it("does not render when unit is null", () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={null}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Dialog should still be present but content should handle null gracefully
      expect(screen.queryByText(/Move "/)).not.toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={false}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows current parent info when unit has a parent", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithParent}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Region Berlin")).toBeInTheDocument();
      });
    });

    it("shows 'No parent' when unit is a root unit", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        // Check for the current parent display (not the select option)
        expect(
          screen.getByText(/No parent \(root unit\)/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Parent selection", () => {
    it("loads available units when dialog opens", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(listOrganizationalUnits).toHaveBeenCalled();
      });
    });

    it("excludes current unit from available parents", async () => {
      // Include the unit itself in the API response
      vi.mocked(listOrganizationalUnits).mockResolvedValue({
        data: [...mockAvailableUnits, mockUnit],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: mockAvailableUnits.length + 1,
          root_unit_ids: [],
        },
      });

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        // The unit itself should not be selectable as a parent
        const select = screen.getByRole("combobox");
        expect(select).toBeInTheDocument();
      });

      // Check that "Berlin Mitte" is not in the dropdown options
      const select = screen.getByRole("combobox");
      const options = within(select).queryAllByRole("option");
      const unitOption = options.find((opt) =>
        opt.textContent?.includes("Berlin Mitte")
      );
      expect(unitOption).toBeUndefined();
    });

    it("shows 'Make root unit' option in parent selection", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithParent}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        const select = screen.getByRole("combobox");
        expect(select).toBeInTheDocument();
      });

      // Should have a "Make root unit" option
      expect(screen.getByText(/Make root unit/i)).toBeInTheDocument();
    });

    it("allows selecting a new parent from the list", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "available-1");

      expect(select).toHaveValue("available-1");
    });
  });

  describe("Move action", () => {
    it("shows Move and Cancel buttons", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Move/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Cancel/i })
        ).toBeInTheDocument();
      });
    });

    it("calls onClose when Cancel is clicked", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Cancel/i })
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls attachOrganizationalUnitParent when moving to a new parent", async () => {
      const user = userEvent.setup();
      const updatedUnit = { ...mockUnit, parent: mockAvailableUnits[0] };
      vi.mocked(attachOrganizationalUnitParent).mockResolvedValue(updatedUnit);

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Select a new parent
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "available-1");

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(attachOrganizationalUnitParent).toHaveBeenCalledWith(
          "unit-1",
          "available-1"
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls detachOrganizationalUnitParent when making unit a root", async () => {
      const user = userEvent.setup();
      vi.mocked(detachOrganizationalUnitParent).mockResolvedValue(undefined);

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithParent}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Select "Make root unit" option (empty value)
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "");

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(detachOrganizationalUnitParent).toHaveBeenCalledWith(
          "unit-2",
          "parent-1"
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("disables Move button when no change is made", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithParent}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Move button should be disabled when selected parent is the same as current
      const moveButton = screen.getByRole("button", { name: /^Move$/i });
      expect(moveButton).toBeDisabled();
    });

    it("shows loading state during move operation", async () => {
      const user = userEvent.setup();
      // Make the API call hang
      vi.mocked(attachOrganizationalUnitParent).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Select a new parent
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "available-1");

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText(/Moving.../i)).toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("shows error message when move fails", async () => {
      const user = userEvent.setup();
      vi.mocked(attachOrganizationalUnitParent).mockRejectedValue(
        new Error("Move failed")
      );

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Select a new parent
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "available-1");

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Move failed/i)).toBeInTheDocument();
      });

      // Should not close dialog on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("shows error message when loading units fails", async () => {
      vi.mocked(listOrganizationalUnits).mockRejectedValue(
        new Error("Failed to load units")
      );

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to load units/i)).toBeInTheDocument();
      });
    });

    it("handles 409 Conflict error for circular reference", async () => {
      const user = userEvent.setup();
      vi.mocked(attachOrganizationalUnitParent).mockRejectedValue(
        new ApiError("Cannot move unit to its own descendant", 409)
      );

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });

      // Select a new parent
      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "available-1");

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Cannot move unit to its own descendant/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has accessible dialog role", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has accessible combobox for parent selection", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument();
      });
    });
  });
});
