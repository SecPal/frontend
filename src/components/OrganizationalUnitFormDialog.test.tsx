// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitFormDialog } from "./OrganizationalUnitFormDialog";
import type { OrganizationalUnit } from "../types/organizational";

// Mock the API module
vi.mock("../services/organizationalUnitApi", () => ({
  createOrganizationalUnit: vi.fn(),
  updateOrganizationalUnit: vi.fn(),
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
  createOrganizationalUnit,
  updateOrganizationalUnit,
} from "../services/organizationalUnitApi";
import { ApiError } from "../services/secretApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("OrganizationalUnitFormDialog", () => {
  const mockUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Branch",
    description: "Main branch in Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Create mode", () => {
    it("renders create dialog with correct title", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
    });

    it("renders create dialog with parent info when parentName is provided", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          parentId="parent-1"
          parentName="Parent Company"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText("Parent Company")).toBeInTheDocument();
    });

    it("submits create form with correct data", async () => {
      const user = userEvent.setup();
      const newUnit: OrganizationalUnit = {
        ...mockUnit,
        id: "new-unit",
        name: "New Branch",
      };

      vi.mocked(createOrganizationalUnit).mockResolvedValue(newUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          parentId="parent-1"
          onSuccess={mockOnSuccess}
        />
      );

      // Fill in the form
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.clear(nameInput);
      await user.type(nameInput, "New Branch");

      // Select type
      const typeSelect = screen.getByRole("combobox");
      await user.selectOptions(typeSelect, "branch");

      // Submit
      const submitButton = screen.getByRole("button", { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith({
          name: "New Branch",
          type: "branch",
          description: null,
          parent_id: "parent-1",
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(newUnit);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("shows validation error when name is empty", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Try to submit without filling name
      const submitButton = screen.getByRole("button", { name: /create/i });
      await user.click(submitButton);

      expect(screen.getByText("Name is required")).toBeInTheDocument();
      expect(createOrganizationalUnit).not.toHaveBeenCalled();
    });

    it("shows API validation errors", async () => {
      const user = userEvent.setup();

      vi.mocked(createOrganizationalUnit).mockRejectedValue(
        new ApiError("Validation failed", 422, {
          name: ["The name has already been taken."],
        })
      );

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "Existing Name");

      const submitButton = screen.getByRole("button", { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("The name has already been taken.")
        ).toBeInTheDocument();
      });
    });

    it("shows general API error", async () => {
      const user = userEvent.setup();

      vi.mocked(createOrganizationalUnit).mockRejectedValue(
        new ApiError("Server error", 500)
      );

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });
  });

  describe("Edit mode", () => {
    it("renders edit dialog with pre-filled values", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={mockUnit}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText("Edit Organizational Unit")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Berlin Branch")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Main branch in Berlin")
      ).toBeInTheDocument();
    });

    it("submits edit form with correct data", async () => {
      const user = userEvent.setup();
      const updatedUnit: OrganizationalUnit = {
        ...mockUnit,
        name: "Updated Branch",
      };

      vi.mocked(updateOrganizationalUnit).mockResolvedValue(updatedUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={mockUnit}
          onSuccess={mockOnSuccess}
        />
      );

      // Update the name
      const nameInput = screen.getByDisplayValue("Berlin Branch");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Branch");

      // Submit
      const submitButton = screen.getByRole("button", {
        name: /save changes/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateOrganizationalUnit).toHaveBeenCalledWith("unit-1", {
          name: "Updated Branch",
          type: "branch",
          description: "Main branch in Berlin",
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(updatedUnit);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Dialog behavior", () => {
    it("calls onClose when cancel button is clicked", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("resets form when dialog opens", async () => {
      const { rerender } = renderWithI18n(
        <OrganizationalUnitFormDialog
          open={false}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Open dialog
      rerender(
        <I18nProvider i18n={i18n}>
          <OrganizationalUnitFormDialog
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Name should be empty
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      expect(nameInput).toHaveValue("");
    });

    it("disables form controls while submitting", async () => {
      const user = userEvent.setup();

      // Make the API call hang
      vi.mocked(createOrganizationalUnit).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "Test");

      const submitButton = screen.getByRole("button", { name: /create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
    });
  });

  describe("Type selection", () => {
    it("renders all type options", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();

      // Check that options are available
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(7);

      const optionValues = options.map((opt) => opt.getAttribute("value"));
      expect(optionValues).toContain("holding");
      expect(optionValues).toContain("company");
      expect(optionValues).toContain("region");
      expect(optionValues).toContain("branch");
      expect(optionValues).toContain("division");
      expect(optionValues).toContain("department");
      expect(optionValues).toContain("custom");
    });

    it("allows changing type selection", async () => {
      const user = userEvent.setup();
      const newUnit: OrganizationalUnit = {
        ...mockUnit,
        id: "new-unit",
        type: "department",
      };

      vi.mocked(createOrganizationalUnit).mockResolvedValue(newUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Fill name
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "HR Department");

      // Change type
      const typeSelect = screen.getByRole("combobox");
      await user.selectOptions(typeSelect, "department");

      // Submit
      await user.click(screen.getByRole("button", { name: /create/i }));

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "department",
          })
        );
      });
    });
  });

  describe("Description field", () => {
    it("allows entering description", async () => {
      const user = userEvent.setup();
      const newUnit: OrganizationalUnit = {
        ...mockUnit,
        id: "new-unit",
        description: "Test description",
      };

      vi.mocked(createOrganizationalUnit).mockResolvedValue(newUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Fill name
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "Test Unit");

      // Fill description
      const descInput = screen.getByPlaceholderText(/optional description/i);
      await user.type(descInput, "Test description");

      // Submit
      await user.click(screen.getByRole("button", { name: /create/i }));

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Test description",
          })
        );
      });
    });

    it("sends null for empty description", async () => {
      const user = userEvent.setup();
      const newUnit: OrganizationalUnit = {
        ...mockUnit,
        id: "new-unit",
        description: null,
      };

      vi.mocked(createOrganizationalUnit).mockResolvedValue(newUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Fill only name, leave description empty
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "Test Unit");

      // Submit
      await user.click(screen.getByRole("button", { name: /create/i }));

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith(
          expect.objectContaining({
            description: null,
          })
        );
      });
    });
  });

  describe("Error clearing", () => {
    it("clears field error when user starts typing", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      // Try to submit without name to trigger error
      await user.click(screen.getByRole("button", { name: /create/i }));

      // Error should be shown
      expect(screen.getByText("Name is required")).toBeInTheDocument();

      // Start typing
      const nameInput = screen.getByPlaceholderText(/e\.g\., Berlin Branch/i);
      await user.type(nameInput, "A");

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText("Name is required")).not.toBeInTheDocument();
      });
    });
  });
});
