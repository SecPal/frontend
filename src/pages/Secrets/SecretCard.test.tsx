// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SecretCard } from "./SecretCard";
import type { Secret } from "../../services/secretApi";

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
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
  });

  it("should render username", () => {
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("should render tags", () => {
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("#work")).toBeInTheDocument();
    expect(screen.getByText("#email")).toBeInTheDocument();
  });

  it("should render attachment count", () => {
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("should show shared indicator", () => {
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("Shared")).toBeInTheDocument();
  });

  it("should show expired badge for expired secrets", () => {
    const expiredSecret: Secret = {
      ...mockSecret,
      expires_at: "2020-01-01T00:00:00Z", // Past date
    };

    render(
      <BrowserRouter>
        <SecretCard secret={expiredSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("should show expiring soon badge for secrets expiring in <7 days", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expiringSoonSecret: Secret = {
      ...mockSecret,
      expires_at: tomorrow.toISOString(),
    };

    render(
      <BrowserRouter>
        <SecretCard secret={expiringSoonSecret} />
      </BrowserRouter>
    );

    expect(screen.getByText("Expiring Soon")).toBeInTheDocument();
  });

  it("should link to secret detail page", () => {
    render(
      <BrowserRouter>
        <SecretCard secret={mockSecret} />
      </BrowserRouter>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/secrets/secret-1");
  });

  it("should not render username if not provided", () => {
    const secretWithoutUsername: Secret = {
      ...mockSecret,
      username: undefined,
    };

    render(
      <BrowserRouter>
        <SecretCard secret={secretWithoutUsername} />
      </BrowserRouter>
    );

    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });

  it("should not render tags if empty", () => {
    const secretWithoutTags: Secret = {
      ...mockSecret,
      tags: [],
    };

    render(
      <BrowserRouter>
        <SecretCard secret={secretWithoutTags} />
      </BrowserRouter>
    );

    expect(screen.queryByText(/#work/)).not.toBeInTheDocument();
  });
});
