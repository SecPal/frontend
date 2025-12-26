// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { LeadershipLevelForm } from "./LeadershipLevelForm";
import * as leadershipLevelApi from "../services/leadershipLevelApi";
import type { LeadershipLevel } from "../types/leadershipLevel";
import { ApiError } from "../services/ApiError";

// Mock the API module
vi.mock("../services/leadershipLevelApi");

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

describe("LeadershipLevelForm", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockLevel: LeadershipLevel = {
    id: "level-1",
    tenant_id: 1,
    rank: 5,
    name: "Site Manager",
    description: "Manages site operations",
    color: "#3357FF",
    is_active: true,
    employees_count: 15,
    created_at: "2025-12-21T00:00:00Z",
    updated_at: "2025-12-21T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when dialog is closed", () => {
      const { container } = render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={false}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("should render create mode with empty form", () => {
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      expect(screen.getByText(/Create Leadership Level/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Rank/i)).toHaveValue(1);
      expect(screen.getByLabelText(/^Name$/i)).toHaveValue("");
      expect(
        screen.getByRole("button", { name: /Create$/i })
      ).toBeInTheDocument();
    });

    it("should render edit mode with pre-filled form", () => {
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="edit"
            level={mockLevel}
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      expect(screen.getByText(/Edit Leadership Level/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Rank/i)).toHaveValue(5);
      expect(screen.getByLabelText(/^Name$/i)).toHaveValue("Site Manager");
      expect(screen.getByLabelText(/Description/i)).toHaveValue(
        "Manages site operations"
      );
      expect(
        screen.getByRole("button", { name: /Save Changes/i })
      ).toBeInTheDocument();
    });

    it("should display color preview when color is set", () => {
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="edit"
            level={mockLevel}
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const colorPreview = screen.getByLabelText(/Color preview/i);
      expect(colorPreview).toBeInTheDocument();
      expect(colorPreview).toHaveStyle({ backgroundColor: "#3357FF" });
    });

    it("should show active/inactive switch", () => {
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const activeSwitch = screen.getByRole("switch", { name: /Active/i });
      expect(activeSwitch).toBeInTheDocument();
      expect(activeSwitch).toBeChecked(); // Default is true
    });
  });

  describe("Form Validation", () => {
    it("should show error when rank is below 1", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const rankInput = screen.getByLabelText(/Rank/i);
      await user.clear(rankInput);
      await user.type(rankInput, "0");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Rank must be between 1.*and 255/i)
        ).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should show error when rank is above 255", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const rankInput = screen.getByLabelText(/Rank/i);
      await user.clear(rankInput);
      await user.type(rankInput, "256");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Rank must be between 1.*and 255/i)
        ).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should show error when name is empty", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.clear(nameInput);

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should show error when name exceeds 100 characters", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const longName = "A".repeat(101);
      const nameInput = screen.getByLabelText(/^Name$/i);
      fireEvent.change(nameInput, { target: { value: longName } });

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Name must be at most 100 characters/i)
        ).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should show error when description exceeds 1000 characters", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const longDescription = "A".repeat(1001);
      const descriptionInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionInput, {
        target: { value: longDescription },
      });

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Description must be at most 1000 characters/i)
        ).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should show error when color is invalid hex format", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const colorInput = screen.getByPlaceholderText("#FF5733");
      await user.clear(colorInput);
      await user.type(colorInput, "invalid");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Color must be a valid hex code/i)
        ).toBeInTheDocument();
      });

      expect(leadershipLevelApi.createLeadershipLevel).not.toHaveBeenCalled();
    });

    it("should clear field error when user starts typing", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);

      // Type a name first
      await user.type(nameInput, "Test");

      // Clear it to trigger error
      fireEvent.change(nameInput, { target: { value: "" } });

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      });

      // Start typing - error should disappear
      fireEvent.change(nameInput, { target: { value: "New Name" } });

      await waitFor(() => {
        expect(screen.queryByText(/Name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Create Mode", () => {
    it("should successfully create leadership level", async () => {
      const user = userEvent.setup();
      const createdLevel: LeadershipLevel = {
        id: "new-level",
        tenant_id: 1,
        rank: 10,
        name: "Team Lead",
        description: null,
        color: null,
        is_active: true,
        employees_count: 0,
        created_at: "2025-12-25T00:00:00Z",
        updated_at: "2025-12-25T00:00:00Z",
      };

      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockResolvedValueOnce(
        createdLevel
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Fill form
      const rankInput = screen.getByLabelText(/Rank/i);
      await user.clear(rankInput);
      await user.type(rankInput, "10");

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Team Lead");

      // Submit
      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(leadershipLevelApi.createLeadershipLevel).toHaveBeenCalledWith({
          rank: 10,
          name: "Team Lead",
          description: null,
          color: null,
          is_active: true,
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(createdLevel);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should create level with all optional fields", async () => {
      const user = userEvent.setup();
      const createdLevel: LeadershipLevel = {
        id: "new-level",
        tenant_id: 1,
        rank: 15,
        name: "Department Manager",
        description: "Manages department operations",
        color: "#FF5733",
        is_active: false,
        employees_count: 0,
        created_at: "2025-12-25T00:00:00Z",
        updated_at: "2025-12-25T00:00:00Z",
      };

      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockResolvedValueOnce(
        createdLevel
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Fill all fields
      const rankInput = screen.getByLabelText(/Rank/i);
      await user.clear(rankInput);
      await user.type(rankInput, "15");

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Department Manager");

      const descriptionInput = screen.getByLabelText(/Description/i);
      await user.type(descriptionInput, "Manages department operations");

      const colorInput = screen.getByPlaceholderText("#FF5733");
      await user.type(colorInput, "#FF5733");

      const activeSwitch = screen.getByRole("switch", { name: /Active/i });
      await user.click(activeSwitch); // Toggle to false

      // Submit
      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(leadershipLevelApi.createLeadershipLevel).toHaveBeenCalledWith({
          rank: 15,
          name: "Department Manager",
          description: "Manages department operations",
          color: "#FF5733",
          is_active: false,
        });
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(createdLevel);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Edit Mode", () => {
    it("should successfully update leadership level", async () => {
      const user = userEvent.setup();
      const updatedLevel: LeadershipLevel = {
        ...mockLevel,
        name: "Updated Manager",
        updated_at: "2025-12-26T00:00:00Z",
      };

      vi.mocked(leadershipLevelApi.updateLeadershipLevel).mockResolvedValueOnce(
        updatedLevel
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="edit"
            level={mockLevel}
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Update name
      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Manager");

      // Submit
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(leadershipLevelApi.updateLeadershipLevel).toHaveBeenCalledWith(
          "level-1",
          {
            rank: 5,
            name: "Updated Manager",
            description: "Manages site operations",
            color: "#3357FF",
            is_active: true,
          }
        );
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(updatedLevel);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should trim whitespace from text fields", async () => {
      const user = userEvent.setup();
      const updatedLevel: LeadershipLevel = {
        ...mockLevel,
        name: "Trimmed Name",
        description: "Trimmed Description",
      };

      vi.mocked(leadershipLevelApi.updateLeadershipLevel).mockResolvedValueOnce(
        updatedLevel
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="edit"
            level={mockLevel}
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Add whitespace
      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.clear(nameInput);
      await user.type(nameInput, "  Trimmed Name  ");

      const descriptionInput = screen.getByLabelText(/Description/i);
      await user.clear(descriptionInput);
      await user.type(descriptionInput, "  Trimmed Description  ");

      // Submit
      const submitButton = screen.getByRole("button", {
        name: /Save Changes/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(leadershipLevelApi.updateLeadershipLevel).toHaveBeenCalledWith(
          "level-1",
          expect.objectContaining({
            name: "Trimmed Name",
            description: "Trimmed Description",
          })
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should display API validation errors for specific fields", async () => {
      const user = userEvent.setup();
      const apiError = new ApiError("Validation failed", 422, {
        json: () =>
          Promise.resolve({
            errors: {
              rank: ["Rank 5 is already taken"],
              name: ["Name must be unique"],
            },
          }),
      } as Response);

      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockRejectedValueOnce(
        apiError
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Rank 5 is already taken/i)
          ).toBeInTheDocument();
          expect(screen.getByText(/Name must be unique/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should display general error on network failure", async () => {
      const user = userEvent.setup();
      const networkError = new ApiError("Network error", 0);

      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockRejectedValueOnce(
        networkError
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(
        () => {
          expect(screen.getByText(/Network error/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("should show fallback error message for unknown errors", async () => {
      const user = userEvent.setup();
      const unknownError = new Error("Unknown error");

      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockRejectedValueOnce(
        unknownError
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(
        () => {
          expect(
            screen.getByText(/Failed to save leadership level/i)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("User Interactions", () => {
    it("should disable submit button while submitting", async () => {
      const user = userEvent.setup();
      vi.mocked(leadershipLevelApi.createLeadershipLevel).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      const submitButton = screen.getByRole("button", { name: /Create$/i });
      await user.click(submitButton);

      await waitFor(
        () => {
          // Button changes to "Saving..." when submitting
          const savingButton = screen.getByRole("button", { name: /Saving/i });
          expect(savingButton).toBeInTheDocument();
          expect(savingButton).toBeDisabled();
        },
        { timeout: 2000 }
      );
    });

    it("should call onClose when Cancel button clicked", async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const cancelButton = screen.getByRole("button", { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should reset form when reopening dialog in create mode", async () => {
      const { rerender } = render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const user = userEvent.setup();
      const nameInput = screen.getByLabelText(/^Name$/i);
      await user.type(nameInput, "Test Name");

      // Close dialog
      rerender(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={false}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      // Reopen dialog - form should be reset
      rerender(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelForm
            open={true}
            onClose={mockOnClose}
            mode="create"
            onSuccess={mockOnSuccess}
          />
        </I18nProvider>
      );

      const nameInputAfterReopen = screen.getByLabelText(/^Name$/i);
      expect(nameInputAfterReopen).toHaveValue("");
    });
  });
});
