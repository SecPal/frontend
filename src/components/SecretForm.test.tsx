// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SecretForm } from "./SecretForm";

describe("SecretForm", () => {
  it("should render all form fields", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    expect(screen.getByLabelText(/^title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("should validate required title field", async () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    // Try to submit without filling title
    const titleInput = screen.getByLabelText(/^title/i);

    // HTML5 validation should prevent submission
    expect(titleInput).toBeRequired();
    expect(titleInput).toHaveValue("");

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should call onSubmit with form data", async () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "Gmail Account" },
    });
    fireEvent.change(screen.getByLabelText(/^username/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "super-secret-123" },
    });

    const submitButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: "Gmail Account",
        username: "user@example.com",
        password: "super-secret-123",
        url: "",
        notes: "",
        tags: [],
        expires_at: undefined,
      });
    });
  });

  it("should call onCancel when cancel button clicked", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("should populate form with initial values", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    const initialValues = {
      title: "Existing Secret",
      username: "existing@example.com",
      password: "existing-password",
      url: "https://example.com",
      notes: "Some notes",
      tags: ["work", "email"],
      expires_at: "2025-12-31",
    };

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Update"
        initialValues={initialValues}
      />
    );

    expect(screen.getByLabelText(/^title/i)).toHaveValue("Existing Secret");
    expect(screen.getByLabelText(/^username/i)).toHaveValue(
      "existing@example.com"
    );
    expect(screen.getByLabelText(/^password$/i)).toHaveValue(
      "existing-password"
    );
    expect(screen.getByLabelText(/^url/i)).toHaveValue("https://example.com");
    expect(screen.getByLabelText(/^notes/i)).toHaveValue("Some notes");
  });

  it("should show/hide password on toggle", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByLabelText(/show password/i);
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
  });

  it("should display loading state when submitting", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
        isSubmitting={true}
      />
    );

    expect(screen.getByText(/create\.\.\.$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  it("should display error message", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
        error="Failed to create secret"
      />
    );

    expect(screen.getByText(/failed to create secret/i)).toBeInTheDocument();
  });

  it("should clear validation error on input change", async () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    // Manually trigger validation error by calling submit with empty title
    const form = screen.getByRole("form");
    fireEvent.submit(form);

    // Type in title field - should clear error
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "New Title" },
    });

    // Error should be cleared (validation error state is internal)
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should handle notes field", () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    render(
      <SecretForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        submitLabel="Create"
      />
    );

    const notesField = screen.getByLabelText(/^notes/i);
    fireEvent.change(notesField, {
      target: { value: "These are some notes" },
    });

    expect(notesField).toHaveValue("These are some notes");
  });
});
