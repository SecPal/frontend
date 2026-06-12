// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from ".";

describe("shared shadcn/radix UI basis", () => {
  it("uses the login-derived control tokens for fields and actions", () => {
    render(
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            aria-invalid
            aria-describedby="email-help email-error"
          />
          <FieldDescription id="email-help">
            Use your work account.
          </FieldDescription>
          <FieldError id="email-error">Email is required.</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea id="notes" />
        </Field>
        <Button variant="outline">Continue</Button>
      </FieldGroup>
    );

    const email = screen.getByRole("textbox", { name: "Email address" });
    const notes = screen.getByRole("textbox", { name: "Notes" });
    const button = screen.getByRole("button", { name: "Continue" });

    expect(email).toBeInvalid();
    expect(email).toHaveAccessibleDescription(
      "Use your work account. Email is required."
    );
    expect(email).toHaveClass(
      "rounded-md",
      "border-zinc-300",
      "focus-visible:ring-blue-600",
      "dark:bg-zinc-950"
    );
    expect(notes).toHaveClass("min-h-24", "resize-y");
    expect(button).toHaveClass(
      "rounded-md",
      "border-zinc-300",
      "focus-visible:ring-blue-600"
    );
  });

  it("renders Radix select, checkbox, and radio group primitives", async () => {
    const user = userEvent.setup();
    const handleRadioChange = vi.fn();
    const handleCheckboxChange = vi.fn();

    render(
      <div>
        <Field>
          <FieldLabel htmlFor="language">Language</FieldLabel>
          <Select defaultValue="de">
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <FieldLabel htmlFor="terms" className="flex items-center gap-2">
          <Checkbox id="terms" onCheckedChange={handleCheckboxChange} />
          Accept terms
        </FieldLabel>
        <RadioGroup
          aria-label="Verification method"
          defaultValue="totp"
          onValueChange={handleRadioChange}
        >
          <FieldLabel htmlFor="totp" className="flex items-center gap-2">
            <RadioGroupItem id="totp" value="totp" />
            Authenticator
          </FieldLabel>
          <FieldLabel htmlFor="recovery" className="flex items-center gap-2">
            <RadioGroupItem id="recovery" value="recovery" />
            Recovery code
          </FieldLabel>
        </RadioGroup>
      </div>
    );

    const language = screen.getByRole("combobox", { name: "Language" });
    expect(language).toHaveTextContent("German");
    await user.click(language);
    const englishOption = screen.getByRole("option", { name: "English" });
    expect(englishOption).toHaveAttribute("data-slot", "ui-select-item");
    await user.click(englishOption);

    await user.click(screen.getByRole("checkbox", { name: "Accept terms" }));
    expect(handleCheckboxChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("radio", { name: "Recovery code" }));
    expect(handleRadioChange).toHaveBeenCalledWith("recovery");
  });

  it("renders a Radix dialog with the shared responsive content boundary", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Dialog open onClose={handleClose}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>Review before continuing.</DialogDescription>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Confirm action" });
    expect(dialog).toHaveAccessibleDescription("Review before continuing.");
    expect(dialog).toHaveClass(
      "max-h-[calc(100dvh-2rem)]",
      "overflow-y-auto",
      "dark:bg-zinc-950"
    );
    await user.keyboard("{Escape}");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("provides alert, card, and badge surfaces with stable slots", () => {
    render(
      <Card aria-labelledby="required">
        <CardHeader>
          <CardTitle id="required">Required information</CardTitle>
          <Badge>Optional</Badge>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Missing fields</AlertTitle>
            <AlertDescription>Complete every required field.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );

    expect(
      screen.getByRole("region", { name: "Required information" })
    ).toHaveAttribute("data-slot", "ui-card");
    expect(screen.getByText("Optional")).toHaveAttribute(
      "data-slot",
      "ui-badge"
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Missing fieldsComplete every required field."
    );
  });
});
