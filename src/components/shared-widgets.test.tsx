// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Alert, AlertActions, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Checkbox, CheckboxField } from "./checkbox";
import { Dialog, DialogActions, DialogTitle } from "./dialog";
import { Field, Label } from "./fieldset";
import { Heading } from "./heading";
import { Input } from "./input";
import { Link } from "./link";
import { Listbox, ListboxLabel, ListboxOption } from "./listbox";
import { Pagination, PaginationNext, PaginationPrevious } from "./pagination";
import { Select } from "./select";
import { Spinner } from "./spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Text } from "./text";
import { Textarea } from "./textarea";
import { Switch } from "./switch";

const migratedWidgetFiles = [
  "alert.tsx",
  "badge.tsx",
  "button.tsx",
  "checkbox.tsx",
  "combobox.tsx",
  "description-list.tsx",
  "dialog.tsx",
  "divider.tsx",
  "fieldset.tsx",
  "heading.tsx",
  "input.tsx",
  "link.tsx",
  "listbox.tsx",
  "pagination.tsx",
  "radio.tsx",
  "select.tsx",
  "spinner.tsx",
  "switch.tsx",
  "table.tsx",
  "text.tsx",
  "textarea.tsx",
];

const forbiddenHeadlessPackagePattern = new RegExp(
  ["@headlessui", "react"].join("\\/")
);
const forbiddenHeroiconsPackagePattern = new RegExp(
  ["@heroicons", "react"].join("\\/")
);
const forbiddenTailwindPlusLicenseMarkerPattern = new RegExp(
  ["LicenseRef", "TailwindPlus"].join("-")
);

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("shared widget migration boundary", () => {
  it("keeps legacy shared widgets off old UI packages and license source markers", () => {
    for (const fileName of migratedWidgetFiles) {
      const source = readFileSync(
        join(process.cwd(), "src/components", fileName),
        "utf8"
      );

      expect(source, fileName).not.toMatch(forbiddenHeadlessPackagePattern);
      expect(source, fileName).not.toMatch(forbiddenHeroiconsPackagePattern);
      expect(source, fileName).not.toMatch(
        forbiddenTailwindPlusLicenseMarkerPattern
      );
      expect(source, fileName).toMatch(/@\/ui|@radix-ui|lucide-react|<\w+/);
    }
  });
});

describe("shared widget compatibility layer", () => {
  it("renders button, link, text, heading, badge, spinner, and dark-mode classes", () => {
    renderInRouter(
      <div>
        <Heading>Dashboard</Heading>
        <Text>Operational summary</Text>
        <Badge color="blue">Active</Badge>
        <Button href="/profile" outline>
          Profile
        </Button>
        <Link href="/settings">Settings</Link>
        <Spinner aria-label="Loading shared widgets" />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toHaveClass(
      "dark:text-white"
    );
    expect(screen.getByText("Operational summary")).toHaveClass(
      "dark:text-zinc-400"
    );
    expect(screen.getByText("Active")).toHaveClass("dark:text-blue-400");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(
      screen.getByRole("status", { name: "Loading shared widgets" })
    ).toBeInTheDocument();
  });

  it("keeps native form controls accessible and invalid-state styled", async () => {
    const user = userEvent.setup();

    render(
      <form>
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input id="name" data-invalid />
        </Field>
        <Field>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" resizable={false} />
        </Field>
        <Field>
          <Label htmlFor="status">Status</Label>
          <Select id="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </form>
    );

    const name = screen.getByLabelText("Name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveClass("data-[invalid=true]:border-red-600");

    await user.type(name, "Alice");
    expect(name).toHaveValue("Alice");
    expect(screen.getByLabelText("Notes")).toHaveClass("resize-none");
    expect(screen.getByLabelText("Status")).toHaveValue("active");
  });

  it("adapts Radix checkbox and switch interactions to the old boolean onChange shape", async () => {
    const user = userEvent.setup();
    const onCheckboxChange = vi.fn();
    const onSwitchChange = vi.fn();

    render(
      <div>
        <CheckboxField>
          <Checkbox id="enabled" onChange={onCheckboxChange} />
          <Label htmlFor="enabled">Enabled</Label>
        </CheckboxField>
        <Switch
          aria-label="Leadership position"
          onChange={onSwitchChange}
          showIcons
        />
      </div>
    );

    await user.click(screen.getByRole("checkbox", { name: "Enabled" }));
    await user.click(
      screen.getByRole("switch", { name: "Leadership position" })
    );

    expect(onCheckboxChange).toHaveBeenCalledWith(true);
    expect(onSwitchChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveClass(
      "dark:data-[state=checked]:bg-zinc-50"
    );
  });

  it("uses Radix listbox semantics while preserving empty-string option values", async () => {
    const onChange = vi.fn();
    render(
      <Listbox value="" onChange={onChange} aria-label="Unit">
        <ListboxOption value="">
          <ListboxLabel>All Units</ListboxLabel>
        </ListboxOption>
        <ListboxOption value="unit-1">
          <ListboxLabel>Head Office</ListboxLabel>
        </ListboxOption>
      </Listbox>
    );

    const trigger = screen.getByRole("combobox", { name: "Unit" });
    fireEvent.pointerDown(trigger, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(trigger, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.click(trigger, { button: 0 });

    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox).getByRole("option", { name: "All Units" })
    ).toBeInTheDocument();
    const option = within(listbox).getByRole("option", { name: "Head Office" });
    fireEvent.pointerDown(option, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(option, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.click(option, { button: 0 });

    expect(onChange).toHaveBeenCalledWith("unit-1");
  });

  it("keeps Radix dialog and alert dismissal accessible", async () => {
    const user = userEvent.setup();
    const onDialogClose = vi.fn();
    const onAlertClose = vi.fn();

    const { rerender } = renderInRouter(
      <Dialog open onClose={onDialogClose}>
        <DialogTitle>Move unit</DialogTitle>
        <DialogActions>
          <Button onClick={() => onDialogClose(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );

    expect(screen.getByRole("dialog", { name: "Move unit" })).toHaveClass(
      "dark:bg-zinc-950"
    );
    await user.keyboard("{Escape}");
    expect(onDialogClose).toHaveBeenCalledWith(false);

    rerender(
      <MemoryRouter>
        <Alert open onClose={onAlertClose}>
          <AlertTitle>Delete unit</AlertTitle>
          <AlertActions>
            <Button onClick={() => onAlertClose(false)}>Cancel</Button>
          </AlertActions>
        </Alert>
      </MemoryRouter>
    );

    expect(screen.getByRole("dialog", { name: "Delete unit" })).toHaveClass(
      "dark:bg-zinc-950"
    );
    await user.keyboard("{Escape}");
    expect(onAlertClose).toHaveBeenCalledWith(false);
  });

  it("renders table row links and pagination navigation with accessible names", () => {
    renderInRouter(
      <div>
        <Table striped>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow href="/units/1" title="Open unit">
              <TableCell>Head Office</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Pagination aria-label="Units pages">
          <PaginationPrevious href="/units?page=1" />
          <PaginationNext href="/units?page=3" />
        </Pagination>
      </div>
    );

    expect(screen.getByRole("link", { name: "Open unit" })).toHaveAttribute(
      "href",
      "/units/1"
    );
    expect(
      screen.getByRole("navigation", { name: "Units pages" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/units?page=1"
    );
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "href",
      "/units?page=3"
    );
  });
});
