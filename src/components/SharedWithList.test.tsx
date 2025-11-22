// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SharedWithList } from "./SharedWithList";
import * as shareApi from "../services/shareApi";
import type { SecretShare } from "../services/secretApi";

// Setup i18n
i18n.loadAndActivate({ locale: "en", messages: {} });

// Mock shareApi functions but keep ApiError
vi.mock("../services/shareApi", async () => {
  const actual = await vi.importActual<typeof import("../services/shareApi")>(
    "../services/shareApi"
  );
  return {
    ...actual,
    revokeShare: vi.fn(),
  };
});

describe("SharedWithList", () => {
  const mockSecretId = "019a9b50-test-secret";
  const mockOnRevoke = vi.fn();

  const mockShares: SecretShare[] = [
    {
      id: "share-1",
      user: { id: "user-1", name: "John Doe" },
      permission: "read",
      granted_by: { id: "owner-1", name: "You" },
      granted_at: "2025-11-01T10:00:00Z",
    },
    {
      id: "share-2",
      user: { id: "user-2", name: "Jane Smith" },
      permission: "write",
      granted_by: { id: "admin-1", name: "Admin" },
      granted_at: "2025-11-15T10:00:00Z",
      expires_at: "2025-12-31T23:59:59Z",
    },
    {
      id: "share-3",
      role: { id: "role-1", name: "Admins" },
      permission: "admin",
      granted_by: { id: "owner-1", name: "You" },
      granted_at: "2025-10-20T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should render list of shares", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      expect(screen.getByText("Shared with (3)")).toBeInTheDocument();
      expect(screen.getByText("John Doe (read)")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith (write)")).toBeInTheDocument();
      expect(screen.getByText("Admins (admin)")).toBeInTheDocument();
    });

    it("should display granted information", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      expect(
        screen.getByText(/Granted by You on 11\/1\/2025/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Granted by Admin on 11\/15\/2025/)
      ).toBeInTheDocument();
    });

    it("should display expiration date when set", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      // Trans component may split text, so use more flexible matcher
      expect(screen.getByText(/Expires:/)).toBeInTheDocument();
      expect(screen.getByText(/1\/1\/2026/)).toBeInTheDocument();
    });

    it("should render empty state when no shares", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={[]}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      expect(screen.getByText(/Not shared with anyone/i)).toBeInTheDocument();
    });

    it("should show revoke button for each share", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      expect(revokeButtons).toHaveLength(3);
    });
  });

  describe("revoke functionality", () => {
    it("should show confirmation dialog on revoke click", async () => {
      const user = userEvent.setup();
      globalThis.confirm = vi.fn(() => false);

      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      await user.click(revokeButtons[0]!);

      expect(globalThis.confirm).toHaveBeenCalledWith(
        "Are you sure you want to revoke access for John Doe?"
      );
    });

    it("should revoke share when confirmed", async () => {
      const user = userEvent.setup();
      globalThis.confirm = vi.fn(() => true);
      vi.mocked(shareApi.revokeShare).mockResolvedValueOnce(undefined);

      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      await user.click(revokeButtons[0]!);

      await waitFor(() => {
        expect(shareApi.revokeShare).toHaveBeenCalledWith(
          mockSecretId,
          "share-1"
        );
        expect(mockOnRevoke).toHaveBeenCalledOnce();
      });
    });

    it("should not revoke if not confirmed", async () => {
      const user = userEvent.setup();
      globalThis.confirm = vi.fn(() => false);

      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      await user.click(revokeButtons[0]!);

      expect(shareApi.revokeShare).not.toHaveBeenCalled();
      expect(mockOnRevoke).not.toHaveBeenCalled();
    });

    it("should display error on revoke failure", async () => {
      const user = userEvent.setup();
      globalThis.confirm = vi.fn(() => true);
      const apiError = new shareApi.ApiError("Forbidden", 403);
      vi.mocked(shareApi.revokeShare).mockRejectedValueOnce(apiError);

      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={mockShares}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      await user.click(revokeButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText("Forbidden")).toBeInTheDocument();
      });
    });
  });

  describe("user vs role display", () => {
    it("should show user icon for user shares", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={[mockShares[0]!]}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      // Check for user icon (👤)
      expect(screen.getByText("👤")).toBeInTheDocument();
    });

    it("should show role icon for role shares", () => {
      render(
        <I18nProvider i18n={i18n}>
          <SharedWithList
            secretId={mockSecretId}
            shares={[mockShares[2]!]}
            onRevoke={mockOnRevoke}
          />
        </I18nProvider>
      );

      // Check for role icon (👥)
      expect(screen.getByText("👥")).toBeInTheDocument();
    });
  });
});
