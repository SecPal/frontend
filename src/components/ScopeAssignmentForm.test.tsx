// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ScopeAssignmentForm } from "./ScopeAssignmentForm";
import type { User } from "../contexts/auth-context";

vi.mock("./dialog", () => ({
  Dialog: vi.fn(({ open, children }) =>
    open ? <div data-testid="mock-dialog">{children}</div> : null
  ),
  DialogTitle: vi.fn(({ children }) => <div>{children}</div>),
  DialogDescription: vi.fn(({ children }) => <div>{children}</div>),
  DialogBody: vi.fn(({ children, className }) => (
    <div className={className}>{children}</div>
  )),
  DialogActions: vi.fn(({ children }) => <div>{children}</div>),
}));

vi.mock("../services/organizationalScopeApi", () => ({
  createOrganizationalScope: vi.fn(),
  updateOrganizationalScope: vi.fn(),
}));

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("ScopeAssignmentForm", () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockUser = {
    id: "user-1",
    name: "Jane Doe",
    email: "jane@secpal.dev",
    emailVerified: true,
    employeeStatus: "active",
    employee: {
      management_level: 10,
    },
  } as unknown as User;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps warnings, validation alerts, section copy, and self-access surfaces on canonical theme tokens", () => {
    renderWithI18n(
      <ScopeAssignmentForm
        open={true}
        onClose={mockOnClose}
        mode="create"
        organizationalUnitId="unit-1"
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const viewingHeading = screen.getByText(/who can this user view\?/i);
    const viewingCopy = screen.getByText(
      /configure which rank range this user can view/i
    );
    expect(viewingHeading).toHaveClass("text-foreground");
    expect(viewingCopy).toHaveClass("text-muted-foreground");

    fireEvent.change(screen.getByLabelText(/minimum viewable rank/i), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/maximum viewable rank/i), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    fireEvent.change(screen.getByLabelText(/maximum assignable rank/i), {
      target: { value: "0" },
    });

    const assignmentWarning = screen.getByText(
      /cannot assign or remove any rank/i
    );
    expect(assignmentWarning.closest('[data-slot="alert"]')).toHaveClass(
      "border-amber-500/30",
      "bg-amber-500/10"
    );
    expect(assignmentWarning).toHaveClass("text-foreground");
    expect(assignmentWarning.className).not.toContain("text-amber-700");

    fireEvent.change(screen.getByLabelText(/minimum assignable rank/i), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText(/maximum assignable rank/i), {
      target: { value: "20" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    const selfAccessAlert = screen.getByText(/self-access control required/i);
    const selfAccessCard = screen
      .getByText(/allow user to view\/edit their own hr data/i)
      .closest('[data-slot="field"]');

    expect(selfAccessAlert.closest('[data-slot="alert"]')).toHaveClass(
      "border-amber-500/30",
      "bg-amber-500/10"
    );
    expect(selfAccessAlert).toHaveAttribute("data-slot", "alert-title");
    expect(selfAccessAlert).toHaveClass("text-foreground");
    expect(selfAccessAlert.className).not.toContain("text-amber-700");
    expect(selfAccessCard).toHaveClass("border-border", "bg-background");

    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));

    fireEvent.change(screen.getByLabelText(/minimum viewable rank/i), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText(/maximum viewable rank/i), {
      target: { value: "0" },
    });

    const viewingWarning = screen.getByText(/results in no visible employees/i);
    expect(viewingWarning.closest('[data-slot="alert"]')).toHaveClass(
      "border-amber-500/30",
      "bg-amber-500/10"
    );
    expect(viewingWarning).toHaveClass("text-foreground");
    expect(viewingWarning.className).not.toContain("text-amber-700");
  });
});
