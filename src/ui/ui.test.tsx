// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
  CustomerSitePageLink,
  CustomerSitePageText,
  CustomerSitePageTitle,
  CustomerSiteStatusBadge,
  EmployeeDataTable,
  EmployeePageLink,
  EmployeePageText,
  EmployeePageTitle,
  EmployeeStatusBadge,
  OrganizationalUnitTypeBadge,
  EmployeeTable,
  EmployeeTableBody,
  EmployeeTableCell,
  EmployeeTableHeader,
  EmployeeTableRow,
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
        <Alert role="alert">
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
      "text-primary-foreground",
      "h-9",
      "px-4",
      "py-2"
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
      "text-card-foreground",
      "border-border"
    );
    expect(screen.getByText("Active")).toHaveAttribute("data-slot", "badge");
    expect(container.querySelector('[data-slot="progress"]')).toHaveClass(
      "bg-primary/20"
    );
    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass(
      "rounded-full"
    );
    expect(
      container.querySelector('[data-slot="avatar-fallback"]')
    ).toHaveClass("bg-inherit", "text-inherit");
    expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass(
      "bg-accent"
    );
    expect(container.querySelector('[data-slot="table"]')).toHaveClass(
      "caption-bottom"
    );
    expect(container.querySelector('[data-slot="table-header"]')).toHaveClass(
      "[&_tr]:border-border"
    );
    expect(
      container.querySelectorAll('[data-slot="table-row"]')[0]
    ).toHaveClass("border-border");
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
      "h-9",
      "px-4",
      "py-2",
      "rounded-md",
      "border",
      "bg-background",
      "focus-visible:ring-ring/50"
    );
  });

  it("keeps icon-enabled switches in a group state context so checked icons can toggle", () => {
    render(<Switch aria-label="Leadership" showIcons checked />);

    expect(screen.getByRole("switch", { name: "Leadership" })).toHaveClass(
      "group"
    );
  });

  it("keeps shared shell primitives on canonical theme tokens instead of bespoke sidebar tokens", () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton href="/settings" current>
                  Settings
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
        </Sidebar>
      </MemoryRouter>
    );

    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const sidebarHeader = container.querySelector(
      '[data-slot="sidebar-header"]'
    );
    const sidebarMenu = container.querySelector('[data-slot="sidebar-menu"]');
    const sidebarButton = container.querySelector(
      '[data-slot="sidebar-menu-button"]'
    );

    expect(sidebar).toHaveClass("bg-background", "text-foreground");
    expect(sidebarHeader).toHaveClass("border-border");
    expect(sidebarMenu).toHaveClass("list-none", "m-0", "p-0");
    expect(sidebarButton).toHaveClass(
      "text-foreground",
      "hover:bg-accent",
      "data-[active=true]:bg-accent"
    );

    expect(sidebar?.className).not.toContain("bg-sidebar");
    expect(sidebar?.className).not.toContain("text-sidebar-foreground");
    expect(sidebarHeader?.className).not.toContain("border-sidebar-border");
    expect(sidebarButton?.className).not.toContain("text-sidebar-foreground");
    expect(sidebarButton?.className).not.toContain("bg-sidebar-accent");
  });

  it("keeps app-specific page typography, links, and tables on canonical tokens", () => {
    const { container } = render(
      <MemoryRouter>
        <div>
          <CustomerSitePageTitle>Customers</CustomerSitePageTitle>
          <CustomerSitePageText>Managed customers.</CustomerSitePageText>
          <CustomerSitePageLink to="/customers">
            Open customers
          </CustomerSitePageLink>
          <CustomerSiteStatusBadge color="zinc">
            Neutral customer
          </CustomerSiteStatusBadge>

          <EmployeePageTitle>Employees</EmployeePageTitle>
          <EmployeePageText>Managed employees.</EmployeePageText>
          <EmployeePageLink to="/employees">Open employees</EmployeePageLink>
          <EmployeeStatusBadge color="zinc">
            Neutral employee
          </EmployeeStatusBadge>

          <EmployeeDataTable>
            <EmployeeTable>
              <thead data-slot="employee-table-head">
                <tr>
                  <EmployeeTableHeader>Name</EmployeeTableHeader>
                </tr>
              </thead>
              <EmployeeTableBody>
                <EmployeeTableRow to="/employees/1" title="Open Jane Doe">
                  <EmployeeTableCell>Jane Doe</EmployeeTableCell>
                </EmployeeTableRow>
              </EmployeeTableBody>
            </EmployeeTable>
          </EmployeeDataTable>
        </div>
      </MemoryRouter>
    );

    const customerHeading = screen.getByRole("heading", { name: "Customers" });
    const customerText = screen.getByText("Managed customers.");
    const customerLink = screen.getByRole("link", { name: "Open customers" });
    const employeeHeading = screen.getByRole("heading", { name: "Employees" });
    const employeeText = screen.getByText("Managed employees.");
    const employeeLink = screen.getByRole("link", { name: "Open employees" });
    const employeeTableShell = container.querySelector(
      '[data-slot="employee-table-shell"]'
    );
    const employeeTable = container.querySelector(
      '[data-slot="employee-table"]'
    );
    const employeeTableBody = container.querySelector(
      '[data-slot="employee-table-body"]'
    );
    const employeeTableHeader = container.querySelector(
      '[data-slot="employee-table-header"]'
    );
    const employeeTableRow = container.querySelector(
      '[data-slot="employee-table-row"]'
    );
    const customerNeutralBadge = screen.getByText("Neutral customer");
    const employeeNeutralBadge = screen.getByText("Neutral employee");

    expect(customerHeading).toHaveClass("text-foreground");
    expect(customerText).toHaveClass("text-muted-foreground");
    expect(customerLink).toHaveClass("text-primary");

    expect(employeeHeading).toHaveClass("text-foreground");
    expect(employeeText).toHaveClass("text-muted-foreground");
    expect(employeeLink).toHaveClass("text-primary");
    expect(customerNeutralBadge).toHaveClass(
      "bg-muted",
      "text-muted-foreground"
    );
    expect(employeeNeutralBadge).toHaveClass(
      "bg-muted",
      "text-muted-foreground"
    );

    expect(employeeTableShell).toHaveClass("border-border");
    expect(employeeTable).toHaveClass("divide-border", "text-foreground");
    expect(employeeTableBody).toHaveClass("divide-border");
    expect(employeeTableHeader).toHaveClass("text-muted-foreground");
    expect(employeeTableRow).toHaveClass("bg-background", "hover:bg-muted/50");

    expect(customerHeading.className).not.toContain("text-zinc-950");
    expect(customerText.className).not.toContain("text-zinc-600");
    expect(customerLink.className).not.toContain("text-blue-600");
    expect(employeeHeading.className).not.toContain("text-zinc-950");
    expect(employeeText.className).not.toContain("text-zinc-600");
    expect(employeeLink.className).not.toContain("text-blue-600");
    expect(customerNeutralBadge.className).not.toContain("bg-zinc-600/10");
    expect(employeeNeutralBadge.className).not.toContain("bg-zinc-600/10");
    expect(employeeTableShell?.className).not.toContain("border-zinc-200");
    expect(employeeTable?.className).not.toContain("divide-zinc-200");
    expect(employeeTableHeader?.className).not.toContain("text-zinc-500");
    expect(employeeTableRow?.className).not.toContain("bg-white");
  });

  it("keeps shared status badge variants on canonical text tokens", () => {
    render(
      <div>
        <CustomerSiteStatusBadge color="amber">
          Customer warning
        </CustomerSiteStatusBadge>
        <CustomerSiteStatusBadge color="blue">
          Customer info
        </CustomerSiteStatusBadge>
        <EmployeeStatusBadge color="amber">Employee warning</EmployeeStatusBadge>
        <EmployeeStatusBadge color="green">Employee active</EmployeeStatusBadge>
      </div>
    );

    const customerWarning = screen.getByText("Customer warning");
    const customerInfo = screen.getByText("Customer info");
    const employeeWarning = screen.getByText("Employee warning");
    const employeeActive = screen.getByText("Employee active");

    expect(customerWarning).toHaveClass("bg-amber-400/20", "text-foreground");
    expect(customerInfo).toHaveClass("bg-blue-500/15", "text-foreground");
    expect(employeeWarning).toHaveClass("bg-amber-400/20", "text-foreground");
    expect(employeeActive).toHaveClass("bg-green-500/15", "text-foreground");

    expect(customerWarning.className).not.toContain("text-amber-700");
    expect(customerInfo.className).not.toContain("text-blue-700");
    expect(employeeWarning.className).not.toContain("text-amber-700");
    expect(employeeActive.className).not.toContain("text-green-700");
  });

  it("keeps organizational unit type badges on shared canonical badge tokens", () => {
    render(
      <div>
        <OrganizationalUnitTypeBadge type="holding" />
        <OrganizationalUnitTypeBadge type="department" />
        <OrganizationalUnitTypeBadge type="branch" />
        <OrganizationalUnitTypeBadge type="custom" />
      </div>
    );

    const holding = screen.getByText("Holding");
    const department = screen.getByText("Department");
    const branch = screen.getByText("Branch");
    const custom = screen.getByText("Custom");

    expect(holding).toHaveAttribute("data-slot", "badge");
    expect(holding).toHaveClass("bg-primary/10", "text-primary");
    expect(department).toHaveClass(
      "bg-emerald-500/10",
      "text-foreground"
    );
    expect(branch).toHaveClass("bg-purple-500/10", "text-foreground");
    expect(custom).toHaveClass("bg-muted", "text-muted-foreground");

    expect(department.className).not.toContain("text-emerald-700");
    expect(branch.className).not.toContain("text-purple-700");
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
          <Alert role="alert">
            <AlertTitle>Missing fields</AlertTitle>
            <AlertDescription>Complete every required field.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );

    expect(
      screen.getByRole("region", { name: "Required information" })
    ).toHaveAttribute("data-slot", "card");
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
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
