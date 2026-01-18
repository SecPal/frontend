// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { RJSFSchema } from "@rjsf/utils";
import { JsonSchemaForm } from "./JsonSchemaForm";

// Helper to convert const schemas to RJSFSchema type
const toRJSFSchema = (schema: unknown): RJSFSchema => schema as RJSFSchema;

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

describe("JsonSchemaForm", () => {
  it("renders form with text input field", () => {
    const schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
      required: ["name"],
    } as const;

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm schema={toRJSFSchema(schema)} onSubmit={handleSubmit} />
      </I18nProvider>
    );

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("renders submit button with custom label", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    } as const;

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          onSubmit={handleSubmit}
          submitLabel="Next Step"
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("button", { name: /next step/i })
    ).toBeInTheDocument();
  });

  it("renders save draft button when onSaveDraft is provided", () => {
    const schema = {
      type: "object",
      properties: {
        email: { type: "string" },
      },
    } as const;

    const handleSubmit = vi.fn();
    const handleSaveDraft = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("button", { name: /save draft/i })
    ).toBeInTheDocument();
  });

  it("calls onSubmit with form data when form is submitted", async () => {
    const schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
      required: ["name"],
    } as const;

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm schema={toRJSFSchema(schema)} onSubmit={handleSubmit} />
      </I18nProvider>
    );

    const input = screen.getByLabelText(/name/i);
    const submitButton = screen.getByRole("button", { name: /submit/i });

    fireEvent.change(input, { target: { value: "John Doe" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
        })
      );
    });
  });

  it("calls onSaveDraft when save draft button is clicked", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    } as const;

    const handleSubmit = vi.fn();
    const handleSaveDraft = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
        />
      </I18nProvider>
    );

    const draftButton = screen.getByRole("button", { name: /save draft/i });
    fireEvent.click(draftButton);

    expect(handleSaveDraft).toHaveBeenCalled();
  });

  it("disables form controls when disabled prop is true", () => {
    const schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
    } as const;

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          onSubmit={handleSubmit}
          disabled
        />
      </I18nProvider>
    );

    const input = screen.getByLabelText(/name/i);
    const submitButton = screen.getByRole("button", { name: /submit/i });

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it("validates required fields", async () => {
    const schema = {
      type: "object",
      properties: {
        email: {
          type: "string",
          format: "email",
          title: "Email",
        },
      },
      required: ["email"],
    } as const;

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm schema={toRJSFSchema(schema)} onSubmit={handleSubmit} />
      </I18nProvider>
    );

    const submitButton = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(submitButton);

    // onSubmit should not be called if validation fails
    await waitFor(() => {
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    // Error message should be displayed (use getAllByText due to multiple error displays in RJSF)
    await waitFor(() => {
      const errorMessages = screen.getAllByText(/must have required property/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it("pre-fills form with formData prop", () => {
    const schema = {
      type: "object",
      properties: {
        name: {
          type: "string",
          title: "Name",
        },
      },
    } as const;

    const formData = { name: "Jane Doe" };
    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          formData={formData}
          onSubmit={handleSubmit}
        />
      </I18nProvider>
    );

    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(input.value).toBe("Jane Doe");
  });

  it("supports custom uiSchema for styling", () => {
    const schema = {
      type: "object",
      properties: {
        password: {
          type: "string",
          title: "Password",
        },
      },
    } as const;

    const uiSchema = {
      password: {
        "ui:widget": "password",
      },
    };

    const handleSubmit = vi.fn();

    render(
      <I18nProvider i18n={i18n}>
        <JsonSchemaForm
          schema={toRJSFSchema(schema)}
          uiSchema={uiSchema}
          onSubmit={handleSubmit}
        />
      </I18nProvider>
    );

    const input = screen.getByLabelText(/password/i);
    expect(input).toHaveAttribute("type", "password");
  });
});
