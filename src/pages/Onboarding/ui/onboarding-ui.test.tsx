// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { RuntimeStyleCspSupport } from "@/lib/RuntimeStyleCspSupport";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AutocompleteListbox,
  AutocompleteOption,
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
  OnboardingAuthCard,
  OnboardingAuthHeader,
  OnboardingAuthShell,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  Textarea,
} from ".";

const defaultCommandPopoverText = {
  placeholder: "Select option",
  searchPlaceholder: "Search options",
  emptyMessage: "No results found",
} as const;

function TestCommandPopover({
  placeholder = defaultCommandPopoverText.placeholder,
  searchPlaceholder = defaultCommandPopoverText.searchPlaceholder,
  emptyMessage = defaultCommandPopoverText.emptyMessage,
  ...props
}: Omit<
  ComponentProps<typeof CommandPopover>,
  keyof typeof defaultCommandPopoverText
> &
  Partial<
    Pick<
      ComponentProps<typeof CommandPopover>,
      keyof typeof defaultCommandPopoverText
    >
  >) {
  return (
    <CommandPopover
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      {...props}
    />
  );
}

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
    expect(
      screen.getByRole("combobox", { name: "Contract type" })
    ).toHaveTextContent("Full time");
  });

  it("preserves disabled states and keyboard focus order", async () => {
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

  it("uses Radix radio semantics and keyboard behavior for single-choice fields", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <RadioGroup
        aria-label="Upload identity document now?"
        defaultValue="yes"
        name="upload-now"
        onValueChange={handleValueChange}
      >
        <FieldLabel
          htmlFor="upload-now-yes"
          className="flex items-center gap-2"
        >
          <RadioGroupItem id="upload-now-yes" value="yes" /> Yes
        </FieldLabel>
        <FieldLabel htmlFor="upload-now-no" className="flex items-center gap-2">
          <RadioGroupItem id="upload-now-no" value="no" /> No
        </FieldLabel>
      </RadioGroup>
    );

    const yes = screen.getByRole("radio", { name: "Yes" });
    const no = screen.getByRole("radio", { name: "No" });

    expect(
      screen.getByRole("radiogroup", {
        name: "Upload identity document now?",
      })
    ).toBeInTheDocument();
    expect(yes).toHaveAttribute("data-state", "checked");
    expect(yes).toBeChecked();

    yes.focus();
    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(no).toHaveFocus());
    await user.keyboard(" ");

    expect(no).toBeChecked();
    expect(handleValueChange).toHaveBeenCalledWith("no");
  });

  it("uses Radix select semantics while preserving option-shaped API", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Field>
        <FieldLabel htmlFor="contract-type">Contract type</FieldLabel>
        <Select
          id="contract-type"
          aria-invalid
          required
          defaultValue=""
          onChange={handleChange}
        >
          <option value="">Select an option</option>
          <option value="full_time">Full time</option>
          <option value="contractor">Contractor</option>
        </Select>
      </Field>
    );

    const trigger = screen.getByRole("combobox", { name: "Contract type" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-required", "true");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Contractor" }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "contractor" }),
      })
    );
  });

  it("passes the CSP nonce through to the onboarding Radix select viewport style", async () => {
    const user = userEvent.setup();
    const nonceCarrier = document.createElement("script");
    nonceCarrier.setAttribute("nonce", "nonce-onboarding");
    document.head.appendChild(nonceCarrier);

    render(
      <>
        <RuntimeStyleCspSupport />
        <Field>
          <FieldLabel htmlFor="contract-type-csp">Contract type</FieldLabel>
          <Select id="contract-type-csp" defaultValue="">
            <option value="">Select an option</option>
            <option value="contractor">Contractor</option>
          </Select>
        </Field>
      </>
    );

    await user.click(screen.getByRole("combobox", { name: "Contract type" }));

    const style = Array.from(document.querySelectorAll("style")).find((node) =>
      node.textContent?.includes("data-radix-select-viewport")
    );

    expect(style).toHaveAttribute("nonce", "nonce-onboarding");
    nonceCarrier.remove();
  });

  it("hands the Select onChange callback a React-style synthetic event whose preventDefault and stopPropagation flags stay consistent after they are called", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Field>
        <FieldLabel htmlFor="contract-type-event">Contract type</FieldLabel>
        <Select
          id="contract-type-event"
          defaultValue=""
          onChange={handleChange}
        >
          <option value="">Select an option</option>
          <option value="contractor">Contractor</option>
        </Select>
      </Field>
    );

    await user.click(screen.getByRole("combobox", { name: "Contract type" }));
    await user.click(screen.getByRole("option", { name: "Contractor" }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const syntheticEvent = handleChange.mock.calls[0]?.[0];
    expect(syntheticEvent).toBeDefined();

    expect(syntheticEvent.defaultPrevented).toBe(false);
    expect(syntheticEvent.isDefaultPrevented()).toBe(false);
    expect(syntheticEvent.isPropagationStopped()).toBe(false);

    syntheticEvent.preventDefault();
    expect(syntheticEvent.defaultPrevented).toBe(true);
    expect(syntheticEvent.isDefaultPrevented()).toBe(true);

    syntheticEvent.stopPropagation();
    expect(syntheticEvent.isPropagationStopped()).toBe(true);

    // stopImmediatePropagation must also flip the same flag so consumers that
    // prefer the immediate variant still observe a stopped event.
    syntheticEvent.stopImmediatePropagation();
    expect(syntheticEvent.isPropagationStopped()).toBe(true);
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

  it("provides auth shell primitives with stable light and dark mode classes", () => {
    render(
      <OnboardingAuthShell>
        <OnboardingAuthCard aria-label="Complete account setup">
          <OnboardingAuthHeader>
            <span>SecPal</span>
            <button type="button">Language</button>
          </OnboardingAuthHeader>
          Account setup
        </OnboardingAuthCard>
      </OnboardingAuthShell>
    );

    const shell = document.querySelector('[data-slot="onboarding-auth-shell"]');
    const card = screen.getByRole("region", {
      name: "Complete account setup",
    });
    const header = document.querySelector(
      '[data-slot="onboarding-auth-header"]'
    );

    expect(shell).toHaveClass(
      "min-h-[var(--app-shell-min-height)]",
      "bg-white",
      "pt-[calc(1.5rem+var(--app-safe-area-inset-top))]",
      "text-zinc-950",
      "dark:bg-zinc-950",
      "dark:text-zinc-50"
    );
    expect(card).toHaveAttribute("data-slot", "onboarding-auth-card");
    expect(card).toHaveClass(
      "min-h-[var(--app-auth-card-min-height)]",
      "rounded-md",
      "border-zinc-200",
      "bg-white",
      "dark:border-zinc-800",
      "dark:bg-zinc-900"
    );
    expect(header).toHaveClass("flex", "items-center", "justify-between");
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

  it("renders editable autocomplete suggestions in a Radix-backed listbox", () => {
    render(
      <AutocompleteListbox
        open
        listboxId="street-suggestions"
        anchor={
          <Input
            aria-label="Street"
            role="combobox"
            aria-controls="street-suggestions"
            aria-expanded="true"
          />
        }
      >
        <AutocompleteOption id="street-option-0" highlighted>
          Main Street
        </AutocompleteOption>
        <AutocompleteOption id="street-option-1">
          Market Street
        </AutocompleteOption>
      </AutocompleteListbox>
    );

    expect(screen.getByRole("combobox", { name: "Street" })).toHaveAttribute(
      "aria-controls",
      "street-suggestions"
    );
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("id", "street-suggestions");
    expect(listbox).toHaveAttribute(
      "data-slot",
      "onboarding-autocomplete-listbox"
    );
    expect(screen.getByRole("option", { name: "Main Street" })).toHaveAttribute(
      "data-highlighted",
      ""
    );
  });

  it("supports a keyboard-searchable command popover select", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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

  it("keeps committed selection separate from keyboard highlight", async () => {
    const user = userEvent.setup();

    render(
      <TestCommandPopover
        label="Country"
        value="de"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany" },
          { value: "fr", label: "France" },
          { value: "es", label: "Spain" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));

    const searchbox = screen.getByRole("searchbox");
    const germany = screen.getByRole("option", { name: "Germany" });
    const france = screen.getByRole("option", { name: "France" });

    expect(germany).toHaveAttribute("aria-selected", "true");
    expect(france).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowDown}");

    expect(searchbox).toHaveAttribute("aria-activedescendant", france.id);
    expect(germany).toHaveAttribute("aria-selected", "true");
    expect(france).toHaveAttribute("aria-selected", "false");
  });

  it("closes the popover when Escape is pressed and clears stale query/active index for the next open", async () => {
    const user = userEvent.setup();

    render(
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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

  it("closes the Radix popover content on outside interaction", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <TestCommandPopover
          label="Country"
          onValueChange={vi.fn()}
          options={[
            { value: "de", label: "Germany" },
            { value: "fr", label: "France" },
          ]}
        />
        <button type="button">After country</button>
      </div>
    );

    const trigger = screen.getByRole("combobox", { name: "Country" });
    await user.click(trigger);

    expect(
      screen.getByRole("searchbox", { name: "Search options" })
    ).toHaveFocus();
    expect(
      document.querySelector('[data-slot="onboarding-command-popover-content"]')
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "After country" }));

    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps command popover tab flow predictable before focus leaves", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <TestCommandPopover
          label="Country"
          onValueChange={vi.fn()}
          options={[
            { value: "de", label: "Germany" },
            { value: "fr", label: "France" },
          ]}
        />
        <button type="button">After country</button>
      </div>
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));

    const searchbox = screen.getByRole("searchbox", {
      name: "Search options",
    });
    const options = screen.getAllByRole("option");

    expect(searchbox).toHaveFocus();

    await user.tab();
    expect(options[0]).toHaveFocus();

    await user.tab();
    expect(options[1]).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "After country" })).toHaveFocus();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("skips disabled options when navigating with the keyboard", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <TestCommandPopover
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
      <TestCommandPopover
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

  it("keeps the focused searchbox associated with the error while open", async () => {
    const user = userEvent.setup();

    render(
      <TestCommandPopover
        label="Country"
        errorMessage="Country is required"
        onValueChange={vi.fn()}
        options={[{ value: "de", label: "Germany" }]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));

    const searchbox = screen.getByRole("searchbox");
    expect(searchbox).toBeInvalid();
    expect(searchbox).toHaveAccessibleDescription("Country is required");
  });

  it("ignores Enter on a disabled active option", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
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
      <TestCommandPopover
        label="Country"
        disabled
        onValueChange={vi.fn()}
        options={[{ value: "de", label: "Germany" }]}
      />
    );

    expect(screen.getByRole("combobox", { name: "Country" })).toBeDisabled();
  });
});
