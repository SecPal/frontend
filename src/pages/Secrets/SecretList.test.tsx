// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { SecretList } from "./SecretList";
import * as secretApi from "../../services/secretApi";
import type { Secret } from "../../services/secretApi";

// Mock secret API (keep ApiError real)
vi.mock("../../services/secretApi", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("../../services/secretApi");
  return {
    ...actual,
    fetchSecrets: vi.fn(),
  };
});

describe("SecretList", () => {
  const mockSecrets: Secret[] = [
    {
      id: "secret-1",
      title: "Gmail Account",
      username: "user@example.com",
      tags: ["work", "email"],
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
      attachment_count: 2,
      is_shared: true,
    },
    {
      id: "secret-2",
      title: "GitHub",
      username: "@username",
      tags: ["dev"],
      created_at: "2025-01-02T10:00:00Z",
      updated_at: "2025-11-14T12:00:00Z",
      attachment_count: 0,
      is_shared: false,
    },
    {
      id: "secret-3",
      title: "AWS Root",
      username: "root",
      tags: ["cloud", "work"],
      expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      created_at: "2025-01-03T10:00:00Z",
      updated_at: "2025-11-13T08:00:00Z",
      attachment_count: 5,
      is_shared: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should display loading state initially", () => {
    vi.mocked(secretApi.fetchSecrets).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves (loading state)
        })
    );

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    expect(screen.getByText("Loading secrets...")).toBeInTheDocument();
  });

  it("should load and display secrets", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    expect(screen.getByText(/GitHub/)).toBeInTheDocument();
    expect(screen.getByText(/AWS Root/)).toBeInTheDocument();
  });

  it("should display error state on API failure", async () => {
    vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
      new secretApi.ApiError("Unauthorized", 401)
    );

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Error Loading Secrets")).toBeInTheDocument();
    });

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
  });

  it("should show empty state when no secrets", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument();
    });
  });

  it("should filter secrets by search query", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Search for "gmail"
    const searchInput = screen.getByPlaceholderText("🔍 Search...");
    await user.clear(searchInput);
    await user.type(searchInput, "gmail");

    // Should show Gmail Account
    expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();

    // Should NOT show GitHub or AWS
    expect(screen.queryByText(/^GitHub$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AWS Root/)).not.toBeInTheDocument();
  });

  it("should filter secrets by tag", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Select "work" tag
    const tagFilter = screen.getByRole("combobox", { name: /Filter by tag/ });
    await user.selectOptions(tagFilter, "work");

    // Should show Gmail and AWS (both have "work" tag)
    expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    expect(screen.getByText(/AWS Root/)).toBeInTheDocument();

    // Should NOT show GitHub (no "work" tag)
    expect(screen.queryByText(/^GitHub$/)).not.toBeInTheDocument();
  });

  it("should filter secrets by expiration", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Filter by "expiring_soon"
    const expirationFilter = screen.getByRole("combobox", {
      name: /Filter by expiration/,
    });
    await user.selectOptions(expirationFilter, "expiring_soon");

    // Should show only AWS (expires in 2 days)
    expect(screen.getByText(/AWS Root/)).toBeInTheDocument();

    // Should NOT show others (no expiration)
    expect(screen.queryByText(/Gmail Account/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^GitHub$/)).not.toBeInTheDocument();
  });

  it("should toggle between grid and list view", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Default is grid view
    const listButton = screen.getByRole("button", { name: "List view" });
    expect(listButton).not.toHaveClass("bg-zinc-900");

    // Click List view button
    await user.click(listButton);

    // List button should now be active
    expect(listButton).toHaveClass("bg-zinc-900");

    // Preference should be saved
    expect(localStorage.getItem("secretViewMode")).toBe("list");
  });

  it("should paginate secrets (20 per page)", async () => {
    // Create 25 secrets (more than 1 page)
    const manySecrets: Secret[] = Array.from({ length: 25 }, (_, i) => ({
      id: `secret-${i}`,
      title: `Secret ${i}`,
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
    }));

    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(manySecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Secret 0/)).toBeInTheDocument();
    });

    // Should show first 20 secrets
    expect(screen.getByText(/Secret 19/)).toBeInTheDocument();

    // Should NOT show 21st secret yet
    expect(screen.queryByText(/Secret 20/)).not.toBeInTheDocument();

    // Click page 2
    const page2Button = screen.getByRole("button", { name: "Page 2" });
    await user.click(page2Button);

    // Should show secrets 21-25
    await waitFor(() => {
      expect(screen.getByText(/Secret 20/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Secret 24/)).toBeInTheDocument();

    // Should NOT show first secrets
    expect(screen.queryByText(/Secret 0/)).not.toBeInTheDocument();
  });

  it("should reset to page 1 when filtering", async () => {
    // Create 25 secrets
    const manySecrets: Secret[] = Array.from({ length: 25 }, (_, i) => ({
      id: `secret-${i}`,
      title: `Secret ${i}`,
      tags: i % 2 === 0 ? ["work"] : ["personal"],
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
    }));

    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(manySecrets);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <SecretList />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Secret 0/)).toBeInTheDocument();
    });

    // Go to page 2
    const page2Button = screen.getByRole("button", { name: "Page 2" });
    await user.click(page2Button);

    await waitFor(() => {
      expect(screen.getByText(/Secret 20/)).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByPlaceholderText("🔍 Search...");
    await user.type(searchInput, "Secret 0");

    // Should reset to page 1 and show filtered results
    expect(screen.getByText(/Secret 0/)).toBeInTheDocument();
    expect(screen.queryByText(/Secret 20/)).not.toBeInTheDocument();
  });
});
