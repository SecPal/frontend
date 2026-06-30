// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
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
  FormSkeleton,
  Input,
  LoadingRegion,
  PageSkeleton,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SectionSkeleton,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  Textarea,
} from ".";

describe("shared shadcn/radix UI basis", () => {
  it("uses canonical shadcn slots and theme-token classes across core primitives", () => {
    const { container } = render(
      <div>
        <Button>Save</Button>
        <Input aria-label="Name" />
        <Textarea aria-label="Notes" />
        <FieldLabel htmlFor="switch">Enabled</FieldLabel>
        <Switch id="switch" />
        <Checkbox aria-label="Accept" />
        <RadioGroup aria-label="Choice">
          <RadioGroupItem value="one" />
        </RadioGroup>
        <Select defaultValue="de">
          <SelectTrigger aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">German</SelectItem>
          </SelectContent>
        </Select>
        <Alert>
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>Check this before continuing.</AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>Active</Badge>
            <Progress value={40} />
            <Avatar initials="SP" />
            <Skeleton className="h-4 w-16" />
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Name</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>SecPal</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-slot",
      "button"
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground"
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute(
      "data-slot",
      "input"
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass(
      "border-input",
      "bg-background"
    );
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAttribute(
      "data-slot",
      "textarea"
    );
    expect(screen.getByText("Enabled")).toHaveAttribute(
      "data-slot",
      "field-label"
    );
    expect(screen.getByRole("switch", { name: "Enabled" })).toHaveAttribute(
      "data-slot",
      "switch"
    );
    expect(screen.getByRole("checkbox", { name: "Accept" })).toHaveAttribute(
      "data-slot",
      "checkbox"
    );
    expect(screen.getByRole("radio")).toHaveAttribute(
      "data-slot",
      "radio-group-item"
    );
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveAttribute(
      "data-slot",
      "select-trigger"
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "bg-card",
      "text-card-foreground"
    );
    expect(screen.getByText("Active")).toHaveAttribute("data-slot", "badge");
    expect(container.querySelector('[data-slot="progress"]')).toHaveClass(
      "bg-primary/20"
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass(
      "rounded-full"
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass(
      "bg-accent"
    );
    expect(container.querySelector('[data-slot="table"]')).toHaveClass(
      "caption-bottom"
    );
  });

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
      "border-input",
      "focus-visible:ring-ring/50",
      "bg-background"
    );
    expect(notes).toHaveClass("min-h-24", "resize-y");
    expect(button).toHaveClass(
      "rounded-md",
      "border",
      "bg-background",
      "focus-visible:ring-ring/50"
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
    expect(englishOption).toHaveAttribute("data-slot", "select-item");
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
      "bg-background"
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
    ).toHaveAttribute("data-slot", "card");
    expect(screen.getByText("Optional")).toHaveAttribute("data-slot", "badge");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Missing fieldsComplete every required field."
    );
  });

  it("exports decorative skeleton primitives and labeled placeholders", () => {
    const { container } = render(
      <div>
        <Skeleton className="h-5 w-20" />
        <PageSkeleton loadingLabel="Loading dashboard" sections={2} />
        <SectionSkeleton loadingLabel="Loading profile section" rows={3} />
        <TableSkeleton
          loadingLabel="Loading sites table"
          columns={3}
          rows={2}
        />
        <FormSkeleton loadingLabel="Loading employee form" fields={2} />
      </div>
    );

    const decorativeSkeleton = container.querySelector(
      '[data-slot="skeleton"]'
    );
    expect(decorativeSkeleton).toHaveAttribute("aria-hidden", "true");
    expect(decorativeSkeleton).toHaveClass(
      "animate-pulse",
      "rounded-md",
      "bg-accent"
    );

    expect(
      screen.getByRole("status", { name: "Loading dashboard" })
    ).toHaveAttribute("data-slot", "page-skeleton");
    expect(
      screen.getByRole("status", { name: "Loading profile section" })
    ).toHaveAttribute("data-slot", "section-skeleton");
    expect(
      screen.getByRole("status", { name: "Loading sites table" })
    ).toHaveAttribute("data-slot", "table-skeleton");
    expect(
      screen.getByRole("status", { name: "Loading employee form" })
    ).toHaveAttribute("data-slot", "form-skeleton");
    expect(
      container.querySelectorAll('[data-slot="table-skeleton"] tbody tr')
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('[data-slot="table-skeleton"] thead th')
    ).toHaveLength(3);
  });

  it("omits the live region and announcement when SectionSkeleton is decorative", () => {
    const { container } = render(
      <div>
        <SectionSkeleton loadingLabel="Loading shared region" rows={2} />
        <SectionSkeleton
          loadingLabel="Loading shared region"
          rows={2}
          decorative
        />
        <SectionSkeleton
          loadingLabel="Loading shared region"
          rows={2}
          decorative
        />
      </div>
    );

    // Exactly one announcing live region survives so assistive tech does
    // not stack three identical "Loading shared region" announcements.
    expect(
      screen.getAllByRole("status", { name: "Loading shared region" })
    ).toHaveLength(1);

    const sectionSkeletons = container.querySelectorAll(
      '[data-slot="section-skeleton"]'
    );
    expect(sectionSkeletons).toHaveLength(3);

    const decorativeOnes = container.querySelectorAll(
      '[data-slot="section-skeleton"][aria-hidden="true"]'
    );
    expect(decorativeOnes).toHaveLength(2);
  });

  it("keeps loaded content visible for non-blocking refreshes", () => {
    render(
      <LoadingRegion loading loadingLabel="Refreshing sites">
        <ul aria-label="Sites">
          <li>North gate</li>
          <li>West patrol</li>
        </ul>
      </LoadingRegion>
    );

    const region = screen.getByText("North gate").closest("div");
    expect(region).toHaveAttribute("data-slot", "loading-region");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("list", { name: "Sites" })).toHaveTextContent(
      "North gate"
    );
    expect(screen.getByRole("list", { name: "Sites" })).toHaveTextContent(
      "West patrol"
    );
    expect(
      screen.getByRole("status", { name: "Refreshing sites" })
    ).toHaveClass("sr-only");
  });
});
