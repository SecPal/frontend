// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CSPProvider } from "@base-ui/react/csp-provider";
import type { ComponentProps } from "react";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  OnboardingAutocompleteListbox as AutocompleteListbox,
  OnboardingAutocompleteOption as AutocompleteOption,
  OnboardingAuthCard,
  OnboardingAuthHeader,
  OnboardingAuthShell,
  OnboardingCheckbox as Checkbox,
  OnboardingCommandPopover as CommandPopover,
  OnboardingProgress as Progress,
  OnboardingRadioGroup as RadioGroup,
  OnboardingRadioGroupItem as RadioGroupItem,
  OnboardingSelect as Select,
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

  it("uses Base UI radio semantics and keyboard behavior for single-choice fields", async () => {
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
    expect(yes).toHaveAttribute("data-checked", "");
    expect(yes).toBeChecked();

    yes.focus();
    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(no).toHaveFocus());
    await user.keyboard(" ");

    expect(no).toBeChecked();
    expect(handleValueChange).toHaveBeenCalledWith("no");
  });

  it("uses Base UI select semantics while preserving option-shaped API", async () => {
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

  it("opens the onboarding Base UI select without injecting a style element", async () => {
    const user = userEvent.setup();
    const styleElementCount = document.querySelectorAll("style").length;

    render(
      <CSPProvider disableStyleElements>
        <Field>
          <FieldLabel htmlFor="contract-type-csp">Contract type</FieldLabel>
          <Select id="contract-type-csp" defaultValue="">
            <option value="">Select an option</option>
            <option value="contractor">Contractor</option>
          </Select>
        </Field>
      </CSPProvider>
    );

    await user.click(screen.getByRole("combobox", { name: "Contract type" }));

    expect(document.querySelectorAll("style")).toHaveLength(styleElementCount);
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
          <Alert role="alert">
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
    const { container } = render(
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
    const card = document.querySelector('[data-slot="onboarding-auth-card"]');
    const header = document.querySelector(
      '[data-slot="onboarding-auth-header"]'
    );

    expect(shell).toHaveClass(
      "min-h-[var(--app-shell-min-height)]",
      "bg-background",
      "pt-[calc(1.5rem+var(--app-safe-area-inset-top))]",
      "text-foreground"
    );
    expect(card).toHaveAttribute("data-slot", "onboarding-auth-card");
    expect(card).toHaveClass(
      "min-h-[var(--app-auth-card-min-height)]",
      "rounded-md",
      "border-border",
      "bg-card",
      "text-card-foreground"
    );
    expect(header).toHaveClass("flex", "items-center", "justify-between");
    expect(shell?.className).not.toContain("bg-white");
    expect(shell?.className).not.toContain("text-zinc-950");
    expect(card?.className).not.toContain("border-zinc-200");
    expect(card?.className).not.toContain("bg-white");
    expect(card?.className).not.toContain("dark:bg-zinc-900");

    const select = container.querySelector(
      '[data-slot="onboarding-select-content"]'
    );
    const option = container.querySelector(
      '[data-slot="onboarding-select-item"]'
    );
    expect(select).toBeNull();
    expect(option).toBeNull();
  });

  it("keeps onboarding shared shells and select surfaces on canonical theme tokens", async () => {
    const user = userEvent.setup();

    render(
      <>
        <OnboardingAuthShell>
          <OnboardingAuthCard aria-label="Complete account setup">
            <OnboardingAuthHeader>
              <span>SecPal</span>
              <button type="button">Language</button>
            </OnboardingAuthHeader>
            <Field>
              <FieldLabel htmlFor="contract-type-theme">
                Contract type
              </FieldLabel>
              <Select id="contract-type-theme" defaultValue="">
                <option value="">Select an option</option>
                <option value="contractor">Contractor</option>
              </Select>
            </Field>
          </OnboardingAuthCard>
        </OnboardingAuthShell>
      </>
    );

    await user.click(screen.getByRole("combobox", { name: "Contract type" }));

    const shell = document.querySelector('[data-slot="onboarding-auth-shell"]');
    const card = document.querySelector('[data-slot="onboarding-auth-card"]');
    const selectContent = document.querySelector(
      '[data-slot="onboarding-select-content"]'
    );
    const selectItem = document.querySelector(
      '[data-slot="onboarding-select-item"]'
    );

    expect(shell).toHaveClass("bg-background", "text-foreground");
    expect(card).toHaveClass(
      "border-border",
      "bg-card",
      "text-card-foreground"
    );
    expect(selectContent).toHaveClass(
      "border-border",
      "bg-popover",
      "text-popover-foreground"
    );
    expect(selectItem).toHaveClass(
      "data-highlighted:bg-accent",
      "data-highlighted:text-accent-foreground"
    );

    expect(shell?.className).not.toContain("bg-white");
    expect(shell?.className).not.toContain("text-zinc-950");
    expect(card?.className).not.toContain("border-zinc-200");
    expect(card?.className).not.toContain("dark:bg-zinc-900");
    expect(selectContent?.className).not.toContain("border-zinc-200");
    expect(selectContent?.className).not.toContain("bg-white");
    expect(selectItem?.className).not.toContain("text-zinc-950");
    expect(selectItem?.className).not.toContain("data-highlighted:bg-zinc-100");
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

  it("renders editable autocomplete suggestions in a Base UI-backed listbox", async () => {
    const user = userEvent.setup();
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
        <AutocompleteOption id="street-option-0" value="main-street">
          Main Street
        </AutocompleteOption>
        <AutocompleteOption id="street-option-1" value="market-street">
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
    await user.click(screen.getByRole("combobox", { name: "Street" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Main Street" })).toHaveAttribute(
      "data-highlighted"
    );
    expect(screen.getByRole("option", { name: "Main Street" })).toHaveAttribute(
      "id",
      "street-option-0"
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
    await user.type(await screen.findByPlaceholderText(/search/i), "fra");
    await user.keyboard("{Enter}");

    expect(handleValueChange).toHaveBeenCalledWith("fr");
  });

  it("renders searchable select content with canonical shadcn/Base UI slots", async () => {
    const user = userEvent.setup();

    render(
      <TestCommandPopover
        label="Nationality"
        value="de"
        onValueChange={vi.fn()}
        options={[
          { value: "de", label: "Germany", keywords: ["Deutschland"] },
          { value: "fr", label: "France" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Nationality" }));

    expect(
      await screen.findByPlaceholderText("Search options")
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="onboarding-command-popover-content"]')
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Search options" })
    ).toHaveAttribute("data-slot", "command-input");
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "data-slot",
      "command-list"
    );
    expect(screen.getByRole("option", { name: "Germany" })).toHaveAttribute(
      "data-slot",
      "command-item"
    );
  });

  it("opens the popover and focuses its search field when ArrowDown is pressed on the closed trigger", async () => {
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
    expect(await screen.findAllByRole("option")).toHaveLength(3);
    const searchbox = await screen.findByPlaceholderText(/search/i);
    await waitFor(() => expect(searchbox).toHaveFocus());
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

    const searchbox = await screen.findByPlaceholderText(/search/i);
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getAllByRole("option")[1]).toHaveAttribute(
        "data-highlighted",
        ""
      )
    );

    expect(searchbox).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "data-highlighted",
      ""
    );
    await user.keyboard("{ArrowDown}");
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

    const searchbox = await screen.findByPlaceholderText(/search/i);
    const germany = screen.getByRole("option", { name: "Germany" });
    const france = screen.getByRole("option", { name: "France" });

    expect(germany).toHaveAttribute("aria-selected", "true");
    expect(france).not.toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");

    expect(searchbox).toHaveFocus();
    expect(germany).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(france).toHaveAttribute("data-highlighted", ""));
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
    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();

    // Move the active index away from the first option and apply a query so
    // there is observable stale state to be cleared on Escape.
    await user.type(await screen.findByPlaceholderText(/search/i), "fra");
    expect(await screen.findByPlaceholderText(/search/i)).toHaveValue("fra");

    await user.keyboard("{Escape}");

    expect(screen.getByRole("combobox", { name: "Country" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    // Re-open: query and keyboard highlight must be reset.
    await user.click(screen.getByRole("combobox", { name: "Country" }));
    expect(await screen.findByPlaceholderText(/search/i)).toHaveValue("");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(
      options.every((option) => !option.hasAttribute("data-highlighted"))
    ).toBe(true);
  });

  it("clears stale query and highlight when Escape closes the popover", async () => {
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
    await user.type(await screen.findByPlaceholderText(/search/i), "fra");
    expect(await screen.findByPlaceholderText(/search/i)).toHaveValue("fra");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(await screen.findByPlaceholderText(/search/i)).toHaveValue("");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(
      options.every((option) => !option.hasAttribute("data-highlighted"))
    ).toBe(true);
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
    await user.type(await screen.findByPlaceholderText(/search/i), "zzzzzz");

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
    const options = await screen.findAllByRole("option");

    await user.hover(options[1]!);
    await waitFor(() =>
      expect(options[1]).toHaveAttribute("data-highlighted", "")
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
    const options = await screen.findAllByRole("option");

    await user.click(options[1]!);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it("closes the Base UI popover content on outside interaction", async () => {
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

    try {
      const searchbox = await screen.findByPlaceholderText("Search options");
      await waitFor(() => expect(searchbox).toHaveFocus());
      expect(
        document.querySelector(
          '[data-slot="onboarding-command-popover-content"]'
        )
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "After country" }));

      await waitFor(() =>
        expect(trigger).toHaveAttribute("aria-expanded", "false")
      );
    } finally {
      if (trigger.getAttribute("aria-expanded") === "true") {
        await user.keyboard("{Escape}");
        await waitFor(() =>
          expect(trigger).toHaveAttribute("aria-expanded", "false")
        );
      }
    }
  });

  it("closes the command popover when tab leaves the search field", async () => {
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

    const searchbox = await screen.findByPlaceholderText("Search options");

    await waitFor(() => expect(searchbox).toHaveFocus());

    await user.tab();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "After country" })
      ).toHaveFocus();
    });
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("does not select disabled options during keyboard navigation", async () => {
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
    const options = await screen.findAllByRole("option");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(options[1]).toHaveAttribute("data-highlighted", "")
    );

    await user.keyboard("{Enter}");
    expect(handleValueChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}");
    expect(options[2]).toHaveAttribute("data-highlighted", "");
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

    const searchbox = await screen.findByPlaceholderText(/search/i);
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
        options={[
          { value: "fr", label: "France" },
          { value: "de", label: "Germany", disabled: true },
        ]}
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Country" });
    await user.click(trigger);
    const searchbox = await screen.findByPlaceholderText(/search/i);
    const disabledOption = await screen.findByRole("option", {
      name: "Germany",
    });

    await waitFor(() => expect(searchbox).toHaveFocus());
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await waitFor(() =>
      expect(disabledOption).toHaveAttribute("data-highlighted", "")
    );

    await user.keyboard("{Enter}");

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(searchbox).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveTextContent("Select option");
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
    const searchbox = await screen.findByPlaceholderText(/search/i);
    await user.type(searchbox, "zzzzz");

    await user.keyboard("{ArrowDown}");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
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

  it("does not select when Enter is pressed with only disabled options", async () => {
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

    const trigger = screen.getByRole("combobox", { name: "Country" });
    await user.click(trigger);
    const searchbox = await screen.findByPlaceholderText(/search/i);
    const options = await screen.findAllByRole("option");

    await waitFor(() => expect(searchbox).toHaveFocus());
    expect(options).toHaveLength(2);
    options.forEach((option) => {
      expect(option).toHaveAttribute("aria-disabled", "true");
      expect(option).not.toHaveAttribute("data-highlighted");
    });

    await user.keyboard("{Enter}");

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent("Select option");
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
      await screen.findByPlaceholderText("Search or select country")
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

  it("selects an empty command value without leaking the internal sentinel", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <TestCommandPopover
        label="Country"
        value="de"
        onValueChange={handleValueChange}
        options={[
          { value: "", label: "No country selected" },
          { value: "de", label: "Germany" },
        ]}
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.click(
      await screen.findByRole("option", { name: "No country selected" })
    );

    expect(handleValueChange).toHaveBeenCalledWith("");
  });
});
