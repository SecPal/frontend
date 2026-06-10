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
  CommandPopover,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Progress,
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

  it("renders badge and progress primitives with accessible state", () => {
    render(
      <div>
        <Badge>Optional</Badge>
        <Progress value={40} aria-label="Onboarding progress" />
      </div>
    );

    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Onboarding progress" })
    ).toHaveAttribute("aria-valuenow", "40");
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

  it("opens the popover and highlights the first option when ArrowDown is pressed on the closed trigger", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Country" });
    expect(trigger).not.toHaveAttribute("aria-activedescendant");

    trigger.focus();
    await user.keyboard("{ArrowDown}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    // First ArrowDown opens the popover and highlights the first option,
    // matching the visual list order. It must not skip past the first item.
    const searchbox = screen.getByRole("searchbox");
    expect(searchbox).toHaveAttribute("aria-activedescendant", options[0]!.id);
  });

  it("navigates options with ArrowDown/ArrowUp inside the search box and selects with Enter", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    const searchbox = screen.getByRole("searchbox");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    expect(searchbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getAllByRole("option")[1]!.id
    );

    await user.keyboard("{Enter}");
    expect(handleValueChange).toHaveBeenCalledWith("fr");
  });

  it("closes the popover when Escape is pressed and clears stale query/active index for the next open", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    expect(screen.getByRole("searchbox")).toBeInTheDocument();

    // Move the active index away from the first option and apply a query so
    // there is observable stale state to be cleared on Escape.
    await user.type(screen.getByRole("searchbox"), "fra");
    expect(screen.getByRole("searchbox")).toHaveValue("fra");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    // Re-open: query must be reset and the first option must be the active
    // descendant again, so the popover does not show stale filtering or an
    // out-of-context active option.
    await user.click(screen.getByRole("combobox", { name: "Country" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "aria-activedescendant",
      options[0]!.id
    );
  });

  it("clears stale query/active index when the trigger closes the popover", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Country" });

    await user.click(trigger);
    await user.type(screen.getByRole("searchbox"), "fra");
    expect(screen.getByRole("searchbox")).toHaveValue("fra");

    await user.click(trigger);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "aria-activedescendant",
      options[0]!.id
    );
  });

  it("renders the empty message when no options match the query", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        emptyMessage="No matches"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.type(screen.getByRole("searchbox"), "zzzzzz");

    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("activates an option on hover and selects it on click", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    const options = screen.getAllByRole("option");

    await user.hover(options[1]!);
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "aria-activedescendant",
      options[1]!.id
    );

    await user.click(options[1]!);
    expect(handleValueChange).toHaveBeenCalledWith("fr");
  });

  it("does not call onValueChange when a disabled option is clicked", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France", disabled: true },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    const options = screen.getAllByRole("option");

    await user.click(options[1]!);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it("skips disabled options when navigating with the keyboard", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France", disabled: true },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    const searchbox = screen.getByRole("searchbox");
    const options = screen.getAllByRole("option");

    await user.keyboard("{ArrowDown}");
    expect(searchbox).toHaveAttribute("aria-activedescendant", options[2]!.id);

    await user.keyboard("{Enter}");
    expect(handleValueChange).toHaveBeenCalledWith("es");
  });

  it("renders an error message bound to the trigger via aria-describedby and marks it invalid", () => {
    render(
      <CommandPopover
        label="Country"
        errorMessage="Country is required"
        onValueChange={vi.fn()}
        options={[{ value: "de", label: "Germany" }]}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Country" });
    expect(trigger).toBeInvalid();
    expect(trigger).toHaveAccessibleDescription("Country is required");
  });

  it("ignores Enter on a disabled active option", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[{ value: "de", label: "Germany", disabled: true }]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.keyboard("{Enter}");

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("does not move the active index when ArrowDown is pressed on an empty result list", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    const searchbox = screen.getByRole("searchbox");
    await user.type(searchbox, "zzzzz");

    await user.keyboard("{ArrowDown}");
    expect(searchbox).not.toHaveAttribute("aria-activedescendant");
  });

  it("keeps the active index stable when ArrowDown only finds disabled options", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <CommandPopover
        label="Country"
        onValueChange={handleValueChange}
        options={[
          { value: "de", label: "Germany", disabled: true },
          { value: "fr", label: "France", disabled: true },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.keyboard("{ArrowDown}");

    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it("exposes an accessible name for the searchbox derived from the localized search placeholder", async () => {
    const user = userEvent.setup();

    render(
      <CommandPopover
        label="Country"
        searchPlaceholder="Search or select country"
        onValueChange={vi.fn()}
        options={[{ value: "de", label: "Germany" }]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));

    expect(
      screen.getByRole("searchbox", { name: "Search or select country" })
    ).toBeInTheDocument();
  });

  it("disables the trigger when the disabled prop is set", () => {
    render(
      <CommandPopover
        label="Country"
        disabled
        onValueChange={vi.fn()}
        options={[{ value: "de", label: "Germany" }]}
      />
    );

    expect(screen.getByRole("combobox", { name: "Country" })).toBeDisabled();
  });
});
