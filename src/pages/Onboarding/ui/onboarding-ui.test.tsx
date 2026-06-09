// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  CommandPopover,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  Textarea,
} from ".";

describe("onboarding shadcn primitives", () => {
  it("wire labels, descriptions, and error states to form controls", () => {
    render(
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="first-name">First names</FieldLabel>
          <Input
            id="first-name"
            aria-describedby="first-name-help first-name-error"
            aria-invalid
          />
          <FieldDescription id="first-name-help">
            Use all names from your ID.
          </FieldDescription>
          <FieldError id="first-name-error">
            First names are required.
          </FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="contract-type">Contract type</FieldLabel>
          <Select id="contract-type" defaultValue="full_time">
            <option value="full_time">Full time</option>
          </Select>
        </Field>
      </FieldGroup>
    );

    const firstNames = screen.getByRole("textbox", { name: "First names" });

    expect(firstNames).toBeInvalid();
    expect(firstNames).toHaveAccessibleDescription(
      "Use all names from your ID. First names are required."
    );
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Contract type" })).toHaveValue(
      "full_time"
    );
  });

  it("preserves native disabled states and keyboard focus order", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Button>Previous</Button>
        <Button disabled>Save draft</Button>
        <label>
          <Checkbox /> I confirm the data is correct
        </label>
      </>
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();

    await user.tab();
    expect(
      screen.getByRole("checkbox", {
        name: "I confirm the data is correct",
      })
    ).toHaveFocus();

    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("supports accessible radio groups for single-choice onboarding fields", async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup>
        <legend>Upload identity document now?</legend>
        <label>
          <RadioGroupItem name="upload-now" value="yes" /> Yes
        </label>
        <label>
          <RadioGroupItem name="upload-now" value="no" /> No
        </label>
      </RadioGroup>
    );

    await user.click(screen.getByRole("radio", { name: "No" }));

    expect(
      screen.getByRole("group", { name: "Upload identity document now?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeChecked();
  });

  it("provides alert and card semantics without Catalyst wrappers", () => {
    render(
      <Card aria-labelledby="required-information">
        <CardHeader>
          <CardTitle id="required-information">Required information</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Missing fields</AlertTitle>
            <AlertDescription>Complete the required fields.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );

    expect(
      screen.getByRole("region", { name: "Required information" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Missing fieldsComplete the required fields."
    );
  });

  it("supports a keyboard-searchable command popover select", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Nationality"
        value="de"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany", keywords: ["Deutschland"] },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Nationality" }));
    await user.type(screen.getByRole("searchbox"), "fra");
    await user.keyboard("{Enter}");

    expect(handleValueChange).toHaveBeenCalledWith("fr");
  });
});
