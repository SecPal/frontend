// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretCard } from "./SecretCard";
import type { Secret } from "../../services/secretApi";

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <BrowserRouter>{component}</BrowserRouter>
    </I18nProvider>
  );
};

describe("SecretCard", () => {
  const mockSecret: Secret = {
    id: "secret-1",
    title: "Gmail Account",
    username: "user@example.com",
    tags: ["work", "email"],
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-11-15T14:30:00Z",
    attachment_count: 2,
    is_shared: true,
  };

  it("should render secret title", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
  });

  it("should render username", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("should render tags", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    expect(screen.getByText("#work")).toBeInTheDocument();
    expect(screen.getByText("#email")).toBeInTheDocument();
  });

  it("should render attachment count", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should show shared indicator", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    expect(screen.getByText("Shared")).toBeInTheDocument();
  });

  it("should show expired badge for expired secrets", () => {
    const expiredSecret: Secret = {
      ...mockSecret,
      expires_at: "2020-01-01T00:00:00Z", // Past date
    };

    renderWithProviders(<SecretCard secret={expiredSecret} />);

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("should show expiring soon badge for secrets expiring in <7 days", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expiringSoonSecret: Secret = {
      ...mockSecret,
      expires_at: tomorrow.toISOString(),
    };

    renderWithProviders(<SecretCard secret={expiringSoonSecret} />);

    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
  });

  it("should link to secret detail page", () => {
    renderWithProviders(<SecretCard secret={mockSecret} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/secrets/secret-1");
  });

  it("should not render username if not provided", () => {
    const secretWithoutUsername: Secret = {
      ...mockSecret,
      username: undefined,
    };

    renderWithProviders(<SecretCard secret={secretWithoutUsername} />);

    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });

  it("should not render tags if empty", () => {
    const secretWithoutTags: Secret = {
      ...mockSecret,
      tags: [],
    };

    renderWithProviders(<SecretCard secret={secretWithoutTags} />);

    expect(screen.queryByText(/#work/)).not.toBeInTheDocument();
  });
});
