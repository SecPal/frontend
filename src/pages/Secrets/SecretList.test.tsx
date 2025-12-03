// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretList } from "./SecretList";
import * as secretApi from "../../services/secretApi";
import * as secretStore from "../../lib/secretStore";
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

// Mock secretStore for offline support
vi.mock("../../lib/secretStore", () => ({
  saveSecret: vi.fn(),
  listSecrets: vi.fn().mockResolvedValue([]),
}));

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

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

  // Store original navigator.onLine
  let originalOnLine: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Store and set online status
    originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    // Reset secretStore mock
    vi.mocked(secretStore.listSecrets).mockResolvedValue([]);
    vi.mocked(secretStore.saveSecret).mockResolvedValue();
  });

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it("should display loading state initially", () => {
    vi.mocked(secretApi.fetchSecrets).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves (loading state)
        })
    );

    renderWithProviders(<SecretList />);

    expect(screen.getByText("Loading secrets...")).toBeInTheDocument();
  });

  it("should load and display secrets", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);

    renderWithProviders(<SecretList />);

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

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText("Error Loading Secrets")).toBeInTheDocument();
    });

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
  });

  it("should show empty state when no secrets", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue([]);

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText("No secrets yet")).toBeInTheDocument();
    });
  });

  it("should filter secrets by search query", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Search for "gmail"
    const searchInput = screen.getByPlaceholderText("Search secrets...");
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

    renderWithProviders(<SecretList />);

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

  it("should filter secrets by expiring_soon", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

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

  it("should filter secrets by expired", async () => {
    const expiredSecret: Secret = {
      id: "secret-expired",
      title: "Expired Secret",
      username: "expired@example.com",
      tags: ["old"],
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
      attachment_count: 0,
      is_shared: false,
    };

    vi.mocked(secretApi.fetchSecrets).mockResolvedValue([
      ...mockSecrets,
      expiredSecret,
    ]);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Filter by "expired"
    const expirationFilter = screen.getByRole("combobox", {
      name: /Filter by expiration/,
    });
    await user.selectOptions(expirationFilter, "expired");

    // Should show only expired secret
    expect(screen.getByText(/Expired Secret/)).toBeInTheDocument();

    // Should NOT show non-expired secrets
    expect(screen.queryByText(/Gmail Account/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AWS Root/)).not.toBeInTheDocument();
  });

  it("should filter secrets by no_expiration", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    });

    // Filter by "no_expiration"
    const expirationFilter = screen.getByRole("combobox", {
      name: /Filter by expiration/,
    });
    await user.selectOptions(expirationFilter, "no_expiration");

    // Should show Gmail and GitHub (no expiration)
    expect(screen.getByText(/Gmail Account/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub/)).toBeInTheDocument();

    // Should NOT show AWS (has expiration)
    expect(screen.queryByText(/AWS Root/)).not.toBeInTheDocument();
  });

  it("should toggle between grid and list view", async () => {
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

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

    renderWithProviders(<SecretList />);

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

    renderWithProviders(<SecretList />);

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
    const searchInput = screen.getByPlaceholderText("Search secrets...");
    await user.type(searchInput, "Secret 0");

    // Should reset to page 1 and show filtered results
    expect(screen.getByText(/Secret 0/)).toBeInTheDocument();
    expect(screen.queryByText(/Secret 20/)).not.toBeInTheDocument();
  });

  it("should show ellipsis pagination for large datasets", async () => {
    // Create 200 secrets (10 pages)
    const manySecrets: Secret[] = Array.from({ length: 200 }, (_, i) => ({
      id: `secret-${i}`,
      title: `Secret ${i}`,
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
    }));

    vi.mocked(secretApi.fetchSecrets).mockResolvedValue(manySecrets);
    const user = userEvent.setup();

    renderWithProviders(<SecretList />);

    await waitFor(() => {
      expect(screen.getByText(/Secret 0/)).toBeInTheDocument();
    });

    // Should show ellipsis pagination (1 ... current ... 10)
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 10" })).toBeInTheDocument();

    // Should show ellipsis for pages 3-9
    expect(screen.getByText("...")).toBeInTheDocument();

    // Navigate to middle page (5)
    const page5Button = screen.getByRole("button", { name: "Page 2" });
    await user.click(page5Button);
    const page3Button = screen.getByRole("button", { name: "Page 3" });
    await user.click(page3Button);
    const page4Button = screen.getByRole("button", { name: "Page 4" });
    await user.click(page4Button);
    const page5ButtonFinal = screen.getByRole("button", { name: "Page 5" });
    await user.click(page5ButtonFinal);

    await waitFor(() => {
      expect(screen.getByText(/Secret 80/)).toBeInTheDocument();
    });

    // Should show ellipsis on both sides: 1 ... 4 5 6 ... 10
    const ellipses = screen.getAllByText("...");
    expect(ellipses).toHaveLength(2); // Left and right ellipsis
  });

  describe("offline support", () => {
    const cachedSecrets = [
      {
        id: "cached-1",
        title: "Cached Secret 1",
        username: "cached@example.com",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-10T00:00:00Z",
        tags: ["cached"],
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      },
    ];

    it("should show cached data when offline", async () => {
      // Set offline
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      vi.mocked(secretStore.listSecrets).mockResolvedValue(cachedSecrets);

      renderWithProviders(<SecretList />);

      await waitFor(() => {
        expect(screen.getByText(/Cached Secret 1/)).toBeInTheDocument();
      });

      // Should show offline indicator
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
      expect(screen.getByText(/cached data/i)).toBeInTheDocument();

      // Should NOT have called the API
      expect(secretApi.fetchSecrets).not.toHaveBeenCalled();
    });

    it("should show stale data banner when API fails but cache exists", async () => {
      vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
        new Error("Network error")
      );
      vi.mocked(secretStore.listSecrets).mockResolvedValue(cachedSecrets);

      renderWithProviders(<SecretList />);

      await waitFor(() => {
        expect(screen.getByText(/Cached Secret 1/)).toBeInTheDocument();
      });

      // Should show stale data banner (not error)
      expect(screen.getByText(/cached data/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/Error Loading Secrets/i)
      ).not.toBeInTheDocument();
    });

    it("should show refresh button in stale data banner when online", async () => {
      vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
        new Error("Network error")
      );
      vi.mocked(secretStore.listSecrets).mockResolvedValue(cachedSecrets);

      renderWithProviders(<SecretList />);

      await waitFor(() => {
        expect(screen.getByText(/Cached Secret 1/)).toBeInTheDocument();
      });

      // Refresh button should be present when online (stale but not offline)
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it("should NOT show refresh button when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });

      vi.mocked(secretStore.listSecrets).mockResolvedValue(cachedSecrets);

      renderWithProviders(<SecretList />);

      await waitFor(() => {
        expect(screen.getByText(/Cached Secret 1/)).toBeInTheDocument();
      });

      // Refresh button should NOT be present when offline
      expect(
        screen.queryByRole("button", { name: /refresh/i })
      ).not.toBeInTheDocument();
    });
  });
});
