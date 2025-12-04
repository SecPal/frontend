// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ConflictResolutionDialog } from "./ConflictResolutionDialog";
import type { ConflictInfo } from "../lib/conflictResolution";
import { renderWithTransitions } from "../../tests/utils/renderWithDialog";

// Initialize i18n for tests
i18n.loadAndActivate({ locale: "en", messages: {} });

// Helper to wrap components with I18nProvider and handle transitions
const renderWithI18n = async (component: React.ReactElement) => {
  return renderWithTransitions(
    <I18nProvider i18n={i18n}>{component}</I18nProvider>
  );
};

describe("ConflictResolutionDialog", () => {
  const mockConflict: ConflictInfo = {
    conflictFields: ["title", "notes"],
    localVersion: {
      id: "secret-1",
      title: "Local Title",
      notes: "Local notes",
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-01-01T12:00:00Z",
    },
    serverVersion: {
      id: "secret-1",
      title: "Server Title",
      notes: "Server notes",
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-01-01T11:00:00Z",
    },
  };

  it("should render conflict information", async () => {
    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    expect(screen.getByText(/Sync Conflict Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/2 field\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("notes")).toBeInTheDocument();
  });

  it("should display local and server versions", async () => {
    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    expect(screen.getByText("Local Title")).toBeInTheDocument();
    expect(screen.getByText("Local notes")).toBeInTheDocument();
    expect(screen.getByText("Server Title")).toBeInTheDocument();
    expect(screen.getByText("Server notes")).toBeInTheDocument();
  });

  it("should allow selecting local version", async () => {
    const user = userEvent.setup();
    const onKeepLocal = vi.fn();

    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={onKeepLocal}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    // Click local version
    await user.click(
      screen.getByRole("button", { name: /Your Local Version/i })
    );

    // Confirm selection
    await user.click(screen.getByRole("button", { name: /Apply Selection/i }));

    expect(onKeepLocal).toHaveBeenCalledOnce();
  });

  it("should allow selecting server version", async () => {
    const user = userEvent.setup();
    const onKeepServer = vi.fn();

    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepServer={onKeepServer}
        onCancel={vi.fn()}
        isOpen
      />
    );

    // Click server version
    await user.click(screen.getByRole("button", { name: /Server Version/i }));

    // Confirm selection
    await user.click(screen.getByRole("button", { name: /Apply Selection/i }));

    expect(onKeepServer).toHaveBeenCalledOnce();
  });

  it("should call onCancel when cancel button clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={onCancel}
        isOpen
      />
    );

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("should disable confirm button when no selection made", async () => {
    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    const confirmButton = screen.getByRole("button", {
      name: /Apply Selection/i,
    });
    expect(confirmButton).toBeDisabled();
  });

  it("should format empty field values", async () => {
    const conflictWithEmpty: ConflictInfo = {
      conflictFields: ["notes"],
      localVersion: {
        id: "secret-1",
        title: "Title",
        notes: undefined,
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-01-01T12:00:00Z",
      },
      serverVersion: {
        id: "secret-1",
        title: "Title",
        notes: undefined,
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-01-01T11:00:00Z",
      },
    };

    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={conflictWithEmpty}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    const emptyValues = screen.getAllByText("(empty)");
    expect(emptyValues).toHaveLength(2); // Both local and server have empty notes
  });

  it("should format array field values", async () => {
    const conflictWithTags: ConflictInfo = {
      conflictFields: ["tags"],
      localVersion: {
        id: "secret-1",
        title: "Title",
        tags: ["work", "email"],
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-01-01T12:00:00Z",
      },
      serverVersion: {
        id: "secret-1",
        title: "Title",
        tags: ["personal"],
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-01-01T11:00:00Z",
      },
    };

    await renderWithI18n(
      <ConflictResolutionDialog
        conflict={conflictWithTags}
        onKeepLocal={vi.fn()}
        onKeepServer={vi.fn()}
        onCancel={vi.fn()}
        isOpen
      />
    );

    expect(screen.getByText("work, email")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
  });
});
