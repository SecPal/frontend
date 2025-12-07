// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { DeleteOrganizationalUnitDialog } from "./DeleteOrganizationalUnitDialog";
import type { OrganizationalUnit } from "../types/organizational";

// Mock the API module
vi.mock("../services/organizationalUnitApi", () => ({
  deleteOrganizationalUnit: vi.fn(),
}));

// Mock secretApi for ApiError
vi.mock("../services/secretApi", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

// Mock useOnlineStatus hook
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

import { deleteOrganizationalUnit } from "../services/organizationalUnitApi";
import { ApiError } from "../services/secretApi";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("DeleteOrganizationalUnitDialog", () => {
  const mockUnitWithoutChildren: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Mitte",
    description: "Branch in central Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockUnitWithChildren: OrganizationalUnit = {
    id: "unit-2",
    type: "region",
    name: "Region Berlin",
    description: "Berlin region",
    metadata: null,
    children: [
      {
        id: "child-1",
        type: "branch",
        name: "Berlin Mitte",
        metadata: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "child-2",
        type: "branch",
        name: "Berlin Kreuzberg",
        metadata: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "child-3",
        type: "branch",
        name: "Berlin Prenzlauer Berg",
        metadata: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to online
    vi.mocked(useOnlineStatus).mockReturnValue(true);
  });

  describe("Unit without children", () => {
    it("renders delete confirmation dialog with unit name", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Check dialog title contains both "Delete" and the unit name
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Delete "Berlin Mitte"\?/)).toBeInTheDocument();
      expect(
        screen.getByText(/This action cannot be undone/)
      ).toBeInTheDocument();
    });

    it("shows Delete and Cancel buttons", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(
        screen.getByRole("button", { name: /Delete/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Cancel/i })
      ).toBeInTheDocument();
    });

    it("calls onClose when Cancel is clicked", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /Cancel/i }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls deleteOrganizationalUnit and onSuccess on delete confirmation", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteOrganizationalUnit).mockResolvedValue(undefined);

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /Delete/i }));

      await waitFor(() => {
        expect(deleteOrganizationalUnit).toHaveBeenCalledWith("unit-1");
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("shows loading state during deletion", async () => {
      const user = userEvent.setup();
      // Create a promise we can control
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      vi.mocked(deleteOrganizationalUnit).mockReturnValue(deletePromise);

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /Delete/i }));

      // Check loading state
      expect(screen.getByRole("button", { name: /Deleting/i })).toBeDisabled();

      // Resolve the promise
      resolveDelete!();

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("Unit with children", () => {
    it("shows warning about child units", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/3 child unit/i)).toBeInTheDocument();
      expect(screen.getByText(/Cannot Delete/i)).toBeInTheDocument();
    });

    it("does not show Delete button when unit has children", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(
        screen.queryByRole("button", { name: /^Delete$/i })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /OK/i })).toBeInTheDocument();
    });

    it("calls onClose when OK is clicked for unit with children", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /OK/i }));

      expect(mockOnClose).toHaveBeenCalled();
      expect(deleteOrganizationalUnit).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("shows error message on delete failure", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteOrganizationalUnit).mockRejectedValue(
        new Error("Network error")
      );

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /Delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("handles 409 Conflict gracefully (unit has children on server)", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteOrganizationalUnit).mockRejectedValue(
        new ApiError("Cannot delete unit with children", 409)
      );

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.click(screen.getByRole("button", { name: /Delete/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Cannot delete unit with children/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Dialog state", () => {
    it("does not render when open is false", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={false}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
    });

    it("does not render content when unit is null", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={null}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Dialog opens but with empty content since unit is null
      // The title would show "Delete ""?" which still contains "Delete"
      // But without a unit, delete button should not function
      expect(screen.queryByText(/Berlin Mitte/)).not.toBeInTheDocument();
    });
  });

  describe("Offline behavior", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("shows offline warning when offline", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Deleting organizational units is not possible while offline/i
        )
      ).toBeInTheDocument();
    });

    it("disables delete button when offline", () => {
      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const deleteButton = screen.getByRole("button", { name: /Delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it("does not call deleteOrganizationalUnit when offline", async () => {
      vi.mocked(deleteOrganizationalUnit).mockResolvedValue(undefined);

      renderWithI18n(
        <DeleteOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithoutChildren}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const deleteButton = screen.getByRole("button", { name: /Delete/i });

      // Button is disabled, so click should not trigger deletion
      expect(deleteButton).toBeDisabled();
      expect(deleteOrganizationalUnit).not.toHaveBeenCalled();
    });
  });
});
