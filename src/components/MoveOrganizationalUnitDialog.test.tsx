// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../locales/en/messages.mjs";
import { MoveOrganizationalUnitDialog } from "./MoveOrganizationalUnitDialog";
import type { OrganizationalUnit } from "../types/organizational";

// Mock the offline hook
vi.mock("../hooks/useOrganizationalUnitsWithOffline", () => ({
  useOrganizationalUnitsWithOffline: vi.fn(),
}));

// Mock the API module (only mutation operations)
vi.mock("../services/organizationalUnitApi", () => ({
  attachOrganizationalUnitParent: vi.fn(),
  detachOrganizationalUnitParent: vi.fn(),
}));

// Mock ApiError for error-path assertions
vi.mock("../services/ApiError", () => ({
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

import { useOrganizationalUnitsWithOffline } from "../hooks/useOrganizationalUnitsWithOffline";
import {
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
} from "../services/organizationalUnitApi";
import { ApiError } from "../services/ApiError";

function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

function getParentSelectTrigger() {
  return screen.getByRole("combobox", { name: /Select new parent/i });
}

function openParentSelect() {
  const trigger = getParentSelectTrigger();

  fireEvent.pointerDown(trigger);
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);

  return trigger;
}

function selectParentOption(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.pointerUp(option);
  fireEvent.click(option);
}

describe("MoveOrganizationalUnitDialog", () => {
  const mockUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Mitte",
    is_legal_entity: false,
    is_establishment: false,
    description: "Branch in central Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockUnitWithParent: OrganizationalUnit = {
    id: "unit-2",
    type: "branch",
    name: "Berlin Kreuzberg",
    is_legal_entity: false,
    is_establishment: false,
    description: "Branch in Kreuzberg",
    metadata: null,
    parent: {
      id: "parent-1",
      type: "region",
      name: "Region Berlin",
      is_legal_entity: false,
      is_establishment: false,
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
      is_legal_entity: false,
      is_establishment: false,
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "available-2",
      type: "region",
      name: "Region München",
      is_legal_entity: false,
      is_establishment: false,
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "parent-1",
      type: "region",
      name: "Region Berlin",
      is_legal_entity: false,
      is_establishment: false,
      metadata: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockHookResponse = {
    units: mockAvailableUnits,
    loading: false,
    error: null,
    isOffline: false,
    isStale: false,
    rootUnitIds: [],
    lastSynced: null,
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.activate("en");
    // Default mock for hook
    vi.mocked(useOrganizationalUnitsWithOffline).mockReturnValue(
      mockHookResponse
    );
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

    it("uses the larger dialog width for the move flow", () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-lg");
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
        // Check for current parent label AND text together
        expect(screen.getByText("Current parent:")).toBeInTheDocument();
        // Use getAllByText since parent name appears in dropdown too
        const regionTexts = screen.getAllByText("Region Berlin");
        expect(regionTexts.length).toBeGreaterThan(0);
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

    it("keeps move dialog banners and context blocks on canonical theme tokens", async () => {
      vi.mocked(useOrganizationalUnitsWithOffline).mockReturnValue({
        ...mockHookResponse,
        isOffline: true,
        isStale: false,
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
        expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
      });

      const iconShell = screen
        .getByText(/move "berlin mitte"/i)
        .closest("div")?.previousElementSibling;
      const offlineBanner = screen
        .getByText(/you're offline/i)
        .closest('[data-slot="alert"]');
      const currentParentBox = screen
        .getByText("Current parent:")
        .closest("div");
      const currentParentLabel = screen.getByText("Current parent:");
      const currentParentValue = screen.getByText(/no parent \(root unit\)/i);

      expect(iconShell).toHaveClass("bg-primary/10");
      expect(offlineBanner).toHaveClass(
        "border-destructive/30",
        "bg-destructive/10"
      );
      expect(offlineBanner).toHaveAttribute("data-slot", "alert");
      expect(currentParentBox).toHaveClass("border-border", "bg-muted");
      expect(currentParentLabel).toHaveClass("text-muted-foreground");
      expect(currentParentValue).toHaveClass("text-foreground");

      expect(iconShell?.className).not.toContain("bg-blue-100");
      expect(offlineBanner?.className).not.toContain("bg-red-50");
      expect(currentParentBox?.className).not.toContain("bg-gray-50");
      expect(currentParentLabel.className).not.toContain("text-gray-500");
      expect(currentParentValue.className).not.toContain("text-zinc-950");

      vi.mocked(useOrganizationalUnitsWithOffline).mockReturnValue({
        ...mockHookResponse,
        isOffline: false,
        isStale: true,
      });

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const staleBanner = await screen.findByText(/viewing cached data/i);
      expect(staleBanner.closest('[data-slot="alert"]')).toHaveClass(
        "border-primary/30",
        "bg-primary/10"
      );
      expect(staleBanner.closest('[data-slot="alert"]')).toHaveAttribute(
        "role",
        "status"
      );
      expect(staleBanner).toHaveClass("text-primary");
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

      // Hook should provide units automatically
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });
    });

    it("excludes current unit from available parents", async () => {
      // Include the unit itself in the hook response
      vi.mocked(useOrganizationalUnitsWithOffline).mockReturnValue({
        ...mockHookResponse,
        units: [...mockAvailableUnits, mockUnit],
      });

      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Wait for loading to complete and find the listbox button
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown.
      openParentSelect();

      // Check that "Berlin Mitte" is not in the dropdown options
      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const unitOption = options.find((opt) =>
          opt.textContent?.includes("Berlin Mitte")
        );
        expect(unitOption).toBeUndefined();
      });
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

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(getParentSelectTrigger()).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Open the Radix Select dropdown.
      openParentSelect();

      // Should have a "Make root unit" option
      await waitFor(
        () => {
          expect(screen.getByText(/Make root unit/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    }, 15000);

    it("keeps the root option icon aligned and label truncatable", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnitWithParent}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(
        () => {
          expect(getParentSelectTrigger()).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      openParentSelect();

      const option = await screen.findByRole(
        "option",
        { name: /Make root unit/i },
        { timeout: 5000 }
      );
      const label = within(option).getByText(/Make root unit/i);
      const contentRow = label.parentElement;

      expect(contentRow).toBeInTheDocument();
      if (!contentRow) {
        throw new Error(
          "Expected the root-unit option content row to be present."
        );
      }

      const icon = contentRow.querySelector("svg");

      expect(contentRow).toHaveClass(
        "flex",
        "w-full",
        "min-w-0",
        "items-center",
        "gap-2"
      );
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("shrink-0");
      expect(label).toHaveClass("min-w-0", "truncate");
    }, 15000);

    it("allows selecting a new parent from the list", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown.
      const listboxButton = openParentSelect();

      // Select Region Hamburg
      await waitFor(() => {
        expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Region Hamburg/i })
      );

      // Verify the selection is shown in the button
      await waitFor(() => {
        expect(listboxButton).toHaveTextContent("Region Hamburg");
      });
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown and select a new parent.
      openParentSelect();

      await waitFor(() => {
        expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Region Hamburg/i })
      );

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(attachOrganizationalUnitParent).toHaveBeenCalledWith(
          "unit-1",
          "available-1"
        );
      });

      expect(mockOnSuccess).toHaveBeenCalledWith("available-1");
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown and select "Make root unit".
      openParentSelect();

      await waitFor(() => {
        expect(screen.getByText(/Make root unit/i)).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Make root unit/i })
      );

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(detachOrganizationalUnitParent).toHaveBeenCalledWith(
          "unit-2",
          "parent-1"
        );
      });

      expect(mockOnSuccess).toHaveBeenCalledWith("");
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown and select a new parent.
      openParentSelect();

      await waitFor(() => {
        expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Region Hamburg/i })
      );

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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown and select a new parent.
      openParentSelect();

      await waitFor(() => {
        expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Region Hamburg/i })
      );

      // Click Move
      await user.click(screen.getByRole("button", { name: /^Move$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Move failed/i)).toBeInTheDocument();
      });

      const moveError = screen
        .getByText(/Move failed/i)
        .closest('[data-slot="alert"]');
      expect(moveError).toHaveClass(
        "border-destructive/30",
        "bg-destructive/10"
      );
      expect(moveError).toHaveClass("text-foreground");
      expect(moveError).toHaveAttribute("data-slot", "alert");

      // Should not close dialog on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("shows error message when loading units fails", async () => {
      vi.mocked(useOrganizationalUnitsWithOffline).mockReturnValue({
        ...mockHookResponse,
        error: "Failed to load units",
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
        expect(screen.getByText(/Failed to load units/i)).toBeInTheDocument();
      });

      const loadError = screen
        .getByText(/Failed to load units/i)
        .closest('[data-slot="alert"]');
      expect(loadError).toHaveClass(
        "border-destructive/30",
        "bg-destructive/10"
      );
      expect(loadError).toHaveClass("text-foreground");
      expect(loadError).toHaveAttribute("data-slot", "alert");
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

      // Wait for loading to complete
      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });

      // Open the Radix Select dropdown and select a new parent.
      openParentSelect();

      await waitFor(() => {
        expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
      });
      selectParentOption(
        screen.getByRole("option", { name: /Region Hamburg/i })
      );

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

    it("has accessible listbox button for parent selection", async () => {
      renderWithI18n(
        <MoveOrganizationalUnitDialog
          open={true}
          unit={mockUnit}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await waitFor(() => {
        expect(getParentSelectTrigger()).toBeInTheDocument();
      });
    });
  });
});
