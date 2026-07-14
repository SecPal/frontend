// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitFormDialog } from "./OrganizationalUnitFormDialog";
import type { OrganizationalUnit } from "../types/organizational";
import { messages as deMessages } from "../locales/de/messages.mjs";
import { messages as enMessages } from "../locales/en/messages.mjs";

vi.mock("./dialog", () => ({
  Dialog: vi.fn(({ open, children }) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null
  ),
  DialogTitle: vi.fn(({ children }) => <div>{children}</div>),
  DialogDescription: vi.fn(({ children }) => <div>{children}</div>),
  DialogBody: vi.fn(({ children }) => <div>{children}</div>),
  DialogActions: vi.fn(({ children }) => <div>{children}</div>),
}));

// Mock the API module
vi.mock("../services/organizationalUnitApi", () => ({
  createOrganizationalUnit: vi.fn(),
  updateOrganizationalUnit: vi.fn(),
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

// Mock useOnlineStatus hook
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

import {
  createOrganizationalUnit,
  updateOrganizationalUnit,
} from "../services/organizationalUnitApi";
import { ApiError } from "../services/ApiError";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

function submitDialogForm(buttonName: RegExp) {
  const submitButton = screen.getByRole("button", { name: buttonName });
  const form = submitButton.closest("form");

  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

async function openTypeSelect() {
  const trigger = screen.getByRole("combobox", { name: /type/i });
  fireEvent.pointerDown(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(trigger, { button: 0 });

  return screen.findAllByRole("option");
}

async function getTypeOptionValues() {
  const options = await openTypeSelect();
  return options.map((option) => option.getAttribute("data-value"));
}

async function selectTypeOption(value: string) {
  const options = await openTypeSelect();
  const option = options.find(
    (candidate) => candidate.getAttribute("data-value") === value
  );
  expect(option).toBeInTheDocument();

  fireEvent.pointerDown(option!, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option!, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option!, { button: 0 });
}

describe("OrganizationalUnitFormDialog", () => {
  const mockUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Branch",
    is_legal_entity: false,
    is_establishment: false,
    description: "Main branch in Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.activate("en");
    // Default to online
    vi.mocked(useOnlineStatus).mockReturnValue(true);
  });

  describe("Create mode", () => {
    it("submits active and assignable status independently", async () => {
      const user = userEvent.setup();
      vi.mocked(createOrganizationalUnit).mockResolvedValue(mockUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      await user.type(
        screen.getByPlaceholderText(/e\.g\., Berlin Branch/i),
        "Independent status unit"
      );
      await user.click(
        screen.getByRole("checkbox", {
          name: "Assignable for new assignments",
        })
      );

      submitDialogForm(/create/i);

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith(
          expect.objectContaining({
            is_active: true,
            is_assignable: false,
          })
        );
      });
    });

    it("uses the precise German label for legal entities", () => {
      i18n.load("de", deMessages);
      i18n.activate("de");

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText("Rechtsträger")).toBeInTheDocument();
    });

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
      fireEvent.change(nameInput, { target: { value: "New Branch" } });

      await selectTypeOption("branch");

      // Submit
      submitDialogForm(/create/i);

      await waitFor(() => {
        expect(createOrganizationalUnit).toHaveBeenCalledWith({
          name: "New Branch",
          type: "branch",
          description: null,
          parent_id: "parent-1",
          is_active: true,
          is_assignable: true,
          is_legal_entity: false,
          is_establishment: false,
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(newUnit);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("initializes both legal status flags to false", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText("Legal Entity")).not.toBeChecked();
      expect(screen.getByLabelText("Establishment")).not.toBeChecked();
    });

    it("allows legal status flags to be toggled independently", async () => {
      const user = userEvent.setup();

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const legalEntityCheckbox = screen.getByLabelText("Legal Entity");
      const establishmentCheckbox = screen.getByLabelText("Establishment");

      await user.click(legalEntityCheckbox);

      expect(legalEntityCheckbox).toBeChecked();
      expect(establishmentCheckbox).not.toBeChecked();

      await user.click(establishmentCheckbox);

      expect(legalEntityCheckbox).toBeChecked();
      expect(establishmentCheckbox).toBeChecked();

      await user.click(legalEntityCheckbox);

      expect(legalEntityCheckbox).not.toBeChecked();
      expect(establishmentCheckbox).toBeChecked();
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

    it("initializes legal status flags independently from the edited unit", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={{
            ...mockUnit,
            is_legal_entity: true,
            is_establishment: false,
          }}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText("Legal Entity")).toBeChecked();
      expect(screen.getByLabelText("Establishment")).not.toBeChecked();
    });

    it("submits edit form with correct data", async () => {
      const user = userEvent.setup();
      const updatedUnit: OrganizationalUnit = {
        ...mockUnit,
        name: "Updated Branch",
        is_legal_entity: false,
        is_establishment: true,
      };

      vi.mocked(updateOrganizationalUnit).mockResolvedValue(updatedUnit);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={{
            ...mockUnit,
            is_legal_entity: true,
            is_establishment: false,
          }}
          onSuccess={mockOnSuccess}
        />
      );

      // Update the name
      const nameInput = screen.getByDisplayValue("Berlin Branch");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Branch");
      await user.click(screen.getByLabelText("Legal Entity"));
      await user.click(screen.getByLabelText("Establishment"));

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
          is_active: true,
          is_assignable: true,
          is_legal_entity: false,
          is_establishment: true,
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
      expect(screen.getByLabelText("Legal Entity")).toBeDisabled();
      expect(screen.getByLabelText("Establishment")).toBeDisabled();
    });
  });

  describe("Type selection", () => {
    it("renders all type options", async () => {
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

      const optionValues = await getTypeOptionValues();
      expect(optionValues.length).toBe(7);
      expect(optionValues).toContain("holding");
      expect(optionValues).toContain("company");
      expect(optionValues).toContain("region");
      expect(optionValues).toContain("branch");
      expect(optionValues).toContain("division");
      expect(optionValues).toContain("department");
      expect(optionValues).toContain("custom");
    });

    it("filters type options based on parent hierarchy (branch parent)", async () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          parentId="parent-1"
          parentName="Berlin Branch"
          parentType="branch"
          onSuccess={mockOnSuccess}
        />
      );

      // Branch has rank 4, so only types with rank > 4 should be available
      // Expected: division (5), department (6), custom (7)
      // NOT branch itself (same-level nesting is invalid)
      const optionValues = await getTypeOptionValues();
      expect(optionValues.length).toBe(3);
      expect(optionValues).not.toContain("holding");
      expect(optionValues).not.toContain("company");
      expect(optionValues).not.toContain("region");
      expect(optionValues).not.toContain("branch"); // Changed: no same-level nesting
      expect(optionValues).toContain("division");
      expect(optionValues).toContain("department");
      expect(optionValues).toContain("custom");
    });

    it("filters type options based on parent hierarchy (company parent)", async () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          parentId="parent-1"
          parentName="Acme Corp"
          parentType="company"
          onSuccess={mockOnSuccess}
        />
      );

      // Company has rank 2, so only types with rank > 2 should be available
      // Expected: region (3), branch (4), division (5), department (6), custom (7)
      // NOT company itself (same-level nesting is invalid)
      const optionValues = await getTypeOptionValues();
      expect(optionValues.length).toBe(5);
      expect(optionValues).not.toContain("holding");
      expect(optionValues).not.toContain("company"); // Changed: no same-level nesting
      expect(optionValues).toContain("region");
      expect(optionValues).toContain("branch");
      expect(optionValues).toContain("division");
      expect(optionValues).toContain("department");
      expect(optionValues).toContain("custom");
    });

    it("shows all types when creating root unit (no parent)", async () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const optionValues = await getTypeOptionValues();
      expect(optionValues.length).toBe(7); // All types available
    });

    it("shows all types in edit mode regardless of parent", async () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={mockUnit}
          parentId="parent-1"
          parentName="Berlin Branch"
          parentType="branch"
          onSuccess={mockOnSuccess}
        />
      );

      const optionValues = await getTypeOptionValues();
      expect(optionValues.length).toBe(7); // All types available in edit mode
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

      await selectTypeOption("department");

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
      fireEvent.change(nameInput, { target: { value: "Test Unit" } });

      // Fill description
      const descInput = screen.getByPlaceholderText(/optional description/i);
      fireEvent.change(descInput, {
        target: { value: "Test description" },
      });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /create/i }));

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

  describe("Offline behavior", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("shows offline warning in create mode", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Creating organizational units is not possible while offline/i
        )
      ).toBeInTheDocument();
    });

    it("keeps offline alerts, general API errors, and parent-unit surfaces on canonical theme tokens", async () => {
      vi.mocked(createOrganizationalUnit).mockRejectedValueOnce(
        new ApiError("Server error", 500)
      );

      const user = userEvent.setup();
      const { unmount } = renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          parentId="parent-1"
          parentName="Parent Company"
          onSuccess={mockOnSuccess}
        />
      );

      const offlineAlert = screen
        .getByText(
          /creating organizational units is not possible while offline/i
        )
        .closest('[data-slot="alert"]');
      const parentBox = screen.getByText("Parent Company");
      expect(offlineAlert).toHaveClass(
        "border-destructive/30",
        "bg-destructive/10"
      );
      expect(screen.getByText(/you're offline/i)).toHaveAttribute(
        "data-slot",
        "alert-title"
      );
      expect(parentBox).toHaveClass("border-border", "bg-muted");
      expect(parentBox.className).not.toContain("border-zinc-200");

      unmount();
      vi.mocked(useOnlineStatus).mockReturnValue(true);

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      await user.type(
        screen.getByPlaceholderText(/e\.g\., Berlin Branch/i),
        "Test Name"
      );
      await user.click(screen.getByRole("button", { name: /create/i }));

      const generalError = await screen.findByText("Server error");
      expect(generalError.closest('[data-slot="alert"]')).toHaveClass(
        "border-destructive/30",
        "bg-destructive/10"
      );
    });

    it("shows offline warning in edit mode", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={mockUnit}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Editing organizational units is not possible while offline/i
        )
      ).toBeInTheDocument();
    });

    it("disables create button when offline", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole("button", { name: /Create/i });
      expect(createButton).toBeDisabled();
    });

    it("disables save button when offline", () => {
      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="edit"
          unit={mockUnit}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole("button", { name: /Save/i });
      expect(saveButton).toBeDisabled();
    });

    it("does not call createOrganizationalUnit when offline", async () => {
      vi.mocked(createOrganizationalUnit).mockResolvedValue(
        {} as OrganizationalUnit
      );

      renderWithI18n(
        <OrganizationalUnitFormDialog
          open={true}
          onClose={mockOnClose}
          mode="create"
          onSuccess={mockOnSuccess}
        />
      );

      const createButton = screen.getByRole("button", { name: /Create/i });

      // Button is disabled, so API should not be called
      expect(createButton).toBeDisabled();
      expect(createOrganizationalUnit).not.toHaveBeenCalled();
    });
  });
});
