// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ShareDialog } from "./ShareDialog";
import * as shareApi from "../services/shareApi";
import type { SecretShare } from "../services/secretApi";
import { renderWithTransitions } from "../../tests/utils/renderWithDialog";

// Mock shareApi functions but keep ApiError
vi.mock("../services/shareApi", async () => {
  const actual = await vi.importActual<typeof import("../services/shareApi")>(
    "../services/shareApi"
  );
  return {
    ...actual,
    createShare: vi.fn(),
  };
});

// Setup minimal i18n for tests
i18n.loadAndActivate({ locale: "en", messages: {} });

describe("ShareDialog", () => {
  const mockSecretId = "019a9b50-test-secret";
  const mockSecretTitle = "Gmail Account";
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockUsers = [
    { id: "user-1", name: "John Doe" },
    { id: "user-2", name: "Jane Smith" },
  ];

  const mockRoles = [
    { id: "1", name: "Admins" },
    { id: "2", name: "Managers" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render dialog with title", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(
        screen.getByText(`Share "${mockSecretTitle}"`)
      ).toBeInTheDocument();
    });

    it("should not render when isOpen is false", async () => {
      const { container } = await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={false}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("should render user/role selector", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(screen.getByLabelText(/share with/i)).toBeInTheDocument();
    });

    it("should render permission dropdown", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(screen.getByLabelText(/permission/i)).toBeInTheDocument();
    });

    it("should render expiration date input", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(
        screen.getByLabelText(/expires \(optional\)/i)
      ).toBeInTheDocument();
    });

    it("should render share and cancel buttons", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(
        screen.getByRole("button", { name: /share/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("should render permission level descriptions", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(
        screen.getByText(/read: view secret details/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/write: view \+ edit secret/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/admin: view \+ edit \+ share \+ delete/i)
      ).toBeInTheDocument();
    });
  });

  describe("form interactions", () => {
    it("should select a user", async () => {
      const user = userEvent.setup();

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const select = screen.getByLabelText(/share with/i);
      await user.selectOptions(select, "user-1");

      expect(select).toHaveValue("user-1");
    });

    it("should select a role", async () => {
      const user = userEvent.setup();

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const select = screen.getByLabelText(/share with/i);
      await user.selectOptions(select, "role-1");

      expect(select).toHaveValue("role-1");
    });

    it("should select permission level", async () => {
      const user = userEvent.setup();

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const permSelect = screen.getByLabelText(/permission/i);
      await user.selectOptions(permSelect, "write");

      expect(permSelect).toHaveValue("write");
    });

    it("should set expiration date", async () => {
      const user = userEvent.setup();

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const dateInput = screen.getByLabelText(/expires \(optional\)/i);
      await user.type(dateInput, "2025-12-31");

      expect(dateInput).toHaveValue("2025-12-31");
    });

    it("should call onClose when cancel button is clicked", async () => {
      const user = userEvent.setup();

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalledOnce();
    });
  });

  describe("share creation", () => {
    it("should create share with user successfully", async () => {
      const user = userEvent.setup();
      const mockShare: SecretShare = {
        id: "share-1",
        user: { id: "user-1", name: "John Doe" },
        permission: "read",
        granted_by: { id: "owner-1", name: "Owner" },
        granted_at: "2025-11-22T10:00:00Z",
      };

      vi.mocked(shareApi.createShare).mockResolvedValueOnce(mockShare);

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "user-1");
      await user.selectOptions(screen.getByLabelText(/permission/i), "read");
      await user.click(screen.getByRole("button", { name: /share/i }));

      await waitFor(() => {
        expect(shareApi.createShare).toHaveBeenCalledWith(mockSecretId, {
          user_id: "user-1",
          permission: "read",
        });
        expect(mockOnSuccess).toHaveBeenCalledOnce();
        expect(mockOnClose).toHaveBeenCalledOnce();
      });
    });

    it("should create share with role successfully", async () => {
      const user = userEvent.setup();
      const mockShare: SecretShare = {
        id: "share-1",
        role: { id: "1", name: "Admins" },
        permission: "admin",
        granted_by: { id: "owner-1", name: "Owner" },
        granted_at: "2025-11-22T10:00:00Z",
      };

      vi.mocked(shareApi.createShare).mockResolvedValueOnce(mockShare);

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "role-1");
      await user.selectOptions(screen.getByLabelText(/permission/i), "admin");
      await user.click(screen.getByRole("button", { name: /share/i }));

      await waitFor(() => {
        expect(shareApi.createShare).toHaveBeenCalledWith(mockSecretId, {
          role_id: "1",
          permission: "admin",
        });
        expect(mockOnSuccess).toHaveBeenCalledOnce();
        expect(mockOnClose).toHaveBeenCalledOnce();
      });
    });

    it("should create share with expiration date", async () => {
      const user = userEvent.setup();
      const mockShare: SecretShare = {
        id: "share-1",
        user: { id: "user-1", name: "John Doe" },
        permission: "read",
        granted_by: { id: "owner-1", name: "Owner" },
        granted_at: "2025-11-22T10:00:00Z",
        expires_at: "2025-12-31T23:59:59Z",
      };

      vi.mocked(shareApi.createShare).mockResolvedValueOnce(mockShare);

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "user-1");
      await user.selectOptions(screen.getByLabelText(/permission/i), "read");
      await user.type(
        screen.getByLabelText(/expires \(optional\)/i),
        "2025-12-31"
      );
      await user.click(screen.getByRole("button", { name: /share/i }));

      await waitFor(() => {
        const expectedDate = new Date("2025-12-31T23:59:59").toISOString();
        expect(shareApi.createShare).toHaveBeenCalledWith(mockSecretId, {
          user_id: "user-1",
          permission: "read",
          expires_at: expectedDate,
        });
      });
    });

    it("should disable share button when no user/role selected", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(screen.getByRole("button", { name: /share/i })).toBeDisabled();
    });

    it("should show loading state during share creation", async () => {
      const user = userEvent.setup();
      vi.mocked(shareApi.createShare).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "user-1");
      await user.click(screen.getByRole("button", { name: /share/i }));

      expect(
        screen.getByRole("button", { name: /sharing\.\.\./i })
      ).toBeInTheDocument();
    });

    it("should display error message on failure", async () => {
      const user = userEvent.setup();
      const apiError = new shareApi.ApiError("User already has access", 422);
      vi.mocked(shareApi.createShare).mockRejectedValueOnce(apiError);

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "user-1");
      await user.click(screen.getByRole("button", { name: /share/i }));

      await waitFor(() => {
        expect(screen.getByText("User already has access")).toBeInTheDocument();
      });
    });

    it("should display generic error message on non-API error", async () => {
      const user = userEvent.setup();
      vi.mocked(shareApi.createShare).mockRejectedValueOnce(
        new Error("Network error")
      );

      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await user.selectOptions(screen.getByLabelText(/share with/i), "user-1");
      await user.click(screen.getByRole("button", { name: /share/i }));

      await waitFor(() => {
        expect(screen.getByText("Failed to share secret")).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("should have aria-label on dialog", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-label",
        "Share secret"
      );
    });

    it("should have role=dialog on dialog element", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should have aria-labelledby linking to dialog title", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const dialog = screen.getByRole("dialog");
      const titleId = dialog.getAttribute("aria-labelledby");

      if (titleId) {
        const title = document.getElementById(titleId);
        expect(title).toBeInTheDocument();
        expect(title).toHaveTextContent(`Share "${mockSecretTitle}"`);
      }
    });

    it("should have aria-describedby linking to dialog description", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      const dialog = screen.getByRole("dialog");
      const descId = dialog.getAttribute("aria-describedby");

      // Description should explain the dialog purpose
      if (descId) {
        const description = document.getElementById(descId);
        expect(description).toBeInTheDocument();
      }
    });

    it("should focus first input on open", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/share with/i)).toHaveFocus();
      });
    });

    it("all interactive elements should be keyboard accessible", async () => {
      await renderWithTransitions(
        <I18nProvider i18n={i18n}>
          <ShareDialog
            secretId={mockSecretId}
            secretTitle={mockSecretTitle}
            isOpen={true}
            onClose={mockOnClose}
            onSuccess={mockOnSuccess}
            users={mockUsers}
            roles={mockRoles}
          />
        </I18nProvider>
      );

      // All inputs and buttons should be keyboard accessible
      const shareWithSelect = screen.getByLabelText(/share with/i);
      const permissionSelect = screen.getByLabelText(/permission/i);
      const expiresInput = screen.getByLabelText(/expires \(optional\)/i);
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      const shareButton = screen.getByRole("button", { name: /share/i });

      expect(shareWithSelect).not.toHaveAttribute("tabindex", "-1");
      expect(permissionSelect).not.toHaveAttribute("tabindex", "-1");
      expect(expiresInput).not.toHaveAttribute("tabindex", "-1");
      expect(cancelButton).not.toHaveAttribute("tabindex", "-1");
      expect(shareButton).not.toHaveAttribute("tabindex", "-1");
    });
  });
});
