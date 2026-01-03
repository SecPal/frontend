// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretForm } from "./SecretForm";

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

// Helper to render with I18nProvider
const renderWithI18n = (ui: React.ReactNode) => {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
};

describe("SecretForm", () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    submitLabel: "Save",
  };

  // Helper function to generate future dates for testing
  const getFutureDateString = (daysInFuture = 30): string => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysInFuture);
    return futureDate.toISOString().split("T")[0]!;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Generator", () => {
    it("should generate password when generate button clicked", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText("Password", {
        selector: "input",
      });
      const generateButton = screen.getByLabelText(/generate password/i);

      expect(passwordInput).toHaveValue("");

      await userEvent.click(generateButton);

      expect(passwordInput).not.toHaveValue("");
      const generatedPassword = (passwordInput as HTMLInputElement).value;
      expect(generatedPassword).toHaveLength(16);
    });

    it("should show password strength indicator when password is entered", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText("Password", {
        selector: "input",
      });

      // Type weak password
      await userEvent.type(passwordInput, "abc");

      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });
    });

    it("should update strength indicator as password improves", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText("Password", {
        selector: "input",
      });

      // Type weak password
      await userEvent.type(passwordInput, "abc");
      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Improve to strong password
      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, "MyP@ssw0rd!");
      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });

    it("should toggle password visibility", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText("Password", {
        selector: "input",
      }) as HTMLInputElement;
      const toggleButton = screen.getByLabelText(/show password/i);

      expect(passwordInput.type).toBe("password");

      await userEvent.click(toggleButton);
      expect(passwordInput.type).toBe("text");

      await userEvent.click(toggleButton);
      expect(passwordInput.type).toBe("password");
    });
  });

  describe("Tag Input", () => {
    it("should add tag when Add button clicked", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);
      const addButton = screen.getByRole("button", { name: /add/i });

      await userEvent.type(tagInput, "work");
      await userEvent.click(addButton);

      expect(screen.getByText(/#work/i)).toBeInTheDocument();
      expect(tagInput).toHaveValue("");
    });

    it("should add tag when Enter key pressed", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);

      await userEvent.type(tagInput, "email{Enter}");

      expect(screen.getByText(/#email/i)).toBeInTheDocument();
      expect(tagInput).toHaveValue("");
    });

    it("should remove tag when X button clicked", async () => {
      renderWithI18n(
        <SecretForm
          {...defaultProps}
          initialValues={{ tags: ["work", "email"] }}
        />
      );

      const removeButton = screen.getByLabelText(/remove tag work/i);
      await userEvent.click(removeButton);

      expect(screen.queryByText(/#work/i)).not.toBeInTheDocument();
      expect(screen.getByText(/#email/i)).toBeInTheDocument();
    });

    it("should remove last tag on Backspace when input empty", async () => {
      renderWithI18n(
        <SecretForm
          {...defaultProps}
          initialValues={{ tags: ["work", "email"] }}
        />
      );

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);

      // Focus input and press Backspace
      await userEvent.click(tagInput);
      await userEvent.keyboard("{Backspace}");

      // Last tag (email) should be removed
      expect(screen.queryByText(/#email/i)).not.toBeInTheDocument();
      expect(screen.getByText(/#work/i)).toBeInTheDocument();
    });

    it("should not add duplicate tags", async () => {
      renderWithI18n(
        <SecretForm {...defaultProps} initialValues={{ tags: ["work"] }} />
      );

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);

      await userEvent.type(tagInput, "work{Enter}");

      // Should still have only one "work" tag
      const workTags = screen.getAllByText(/#work/i);
      expect(workTags).toHaveLength(1);
    });

    it("should trim whitespace from tags", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);

      await userEvent.type(tagInput, "  work  {Enter}");

      expect(screen.getByText(/#work/i)).toBeInTheDocument();
    });
  });

  describe("Expiration Date Picker", () => {
    it("should set expiration date", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const dateInput = screen.getByLabelText(/expiration date/i);

      // Use a date 30 days in the future to avoid min date validation issues
      const futureDateString = getFutureDateString();

      await userEvent.type(dateInput, futureDateString);

      expect(dateInput).toHaveValue(futureDateString);
    });

    it("should submit form with expiration date in ISO format", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const dateInput = screen.getByLabelText(/expiration date/i);
      const submitButton = screen.getByRole("button", { name: /save/i });

      // Use a date 30 days in the future to avoid min date validation issues
      const futureDateString = getFutureDateString();

      await userEvent.type(titleInput, "Test Secret");
      await userEvent.type(dateInput, futureDateString);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Test Secret",
            expires_at: `${futureDateString}T23:59:59Z`,
          })
        );
      });
    });

    it("should load initial expiration date", () => {
      renderWithI18n(
        <SecretForm
          {...defaultProps}
          initialValues={{ expires_at: "2025-12-31T23:59:59Z" }}
        />
      );

      const dateInput = screen.getByLabelText(
        /expiration date/i
      ) as HTMLInputElement;
      expect(dateInput.value).toBe("2025-12-31");
    });

    it("should have minimum date set to today", () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const dateInput = screen.getByLabelText(
        /expiration date/i
      ) as HTMLInputElement;
      const today = new Date().toISOString().split("T")[0];

      expect(dateInput.min).toBe(today);
    });
  });

  describe("Form Submission", () => {
    it("should include all new features in submission", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const passwordInput = screen.getByLabelText("Password", {
        selector: "input",
      });
      const tagInput = screen.getByPlaceholderText(/enter tag name/i);
      const dateInput = screen.getByLabelText(/expiration date/i);
      const submitButton = screen.getByRole("button", { name: /save/i });

      // Use a date 30 days in the future to avoid min date validation issues
      const futureDateString = getFutureDateString();

      // Fill form
      await userEvent.type(titleInput, "Test Secret");
      await userEvent.type(passwordInput, "MyP@ssw0rd!");
      await userEvent.type(tagInput, "work{Enter}");
      await userEvent.type(tagInput, "important{Enter}");
      await userEvent.type(dateInput, futureDateString);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title: "Test Secret",
          username: "",
          password: "MyP@ssw0rd!",
          url: "",
          notes: "",
          tags: ["work", "important"],
          expires_at: `${futureDateString}T23:59:59Z`,
        });
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for new fields", () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      expect(screen.getByLabelText(/generate password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/enter tag name/i)
      ).toBeInTheDocument();
    });

    it("should have keyboard navigation for tags", async () => {
      renderWithI18n(<SecretForm {...defaultProps} />);

      const tagInput = screen.getByPlaceholderText(/enter tag name/i);

      // Add tags with keyboard
      await userEvent.type(tagInput, "work{Enter}");
      await userEvent.type(tagInput, "email{Enter}");

      expect(screen.getByText(/#work/i)).toBeInTheDocument();
      expect(screen.getByText(/#email/i)).toBeInTheDocument();
    });
  });
});
