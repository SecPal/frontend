// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SyncStatusIndicator } from "./SyncStatusIndicator";
import { db } from "../lib/db";
import * as apiCache from "../lib/apiCache";
import * as useOnlineStatusModule from "../hooks/useOnlineStatus";

// Mock the useOnlineStatus hook
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

describe("SyncStatusIndicator", () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    vi.clearAllMocks();

    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithI18n(component: React.ReactElement) {
    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  }

  it("should not render when no pending or error operations", async () => {
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    const { container } = renderWithI18n(
      <SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />
    );

    // Wait for live query to update
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("should show pending operations count", async () => {
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    // Add pending operations
    await db.syncQueue.bulkAdd([
      {
        id: "1",
        type: "create",
        entity: "guards",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      },
      {
        id: "2",
        type: "update",
        entity: "shifts",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      },
    ]);

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(screen.getByText(/2 operation\(s\) pending/i)).toBeInTheDocument();
    });
  });

  it("should show error operations count", async () => {
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    // Add error operations
    await db.syncQueue.bulkAdd([
      {
        id: "1",
        type: "create",
        entity: "guards",
        data: {},
        status: "error",
        createdAt: new Date(),
        attempts: 5,
        error: "Max retries reached",
      },
    ]);

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(screen.getByText(/1 operation\(s\) failed/i)).toBeInTheDocument();
    });
  });

  it("should trigger manual sync on button click", async () => {
    const user = userEvent.setup();
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    const mockProcessSyncQueue = vi.spyOn(apiCache, "processSyncQueue");
    mockProcessSyncQueue.mockResolvedValue({
      total: 2,
      synced: 2,
      failed: 0,
      pending: 0,
    });

    // Add pending operations
    await db.syncQueue.bulkAdd([
      {
        id: "1",
        type: "create",
        entity: "guards",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      },
      {
        id: "2",
        type: "update",
        entity: "shifts",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      },
    ]);

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    // Wait for component to render with pending count
    await waitFor(() => {
      expect(screen.getByText(/2 operation\(s\) pending/i)).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByRole("button", { name: /sync now/i });
    await user.click(syncButton);

    // Verify processSyncQueue was called
    await waitFor(() => {
      expect(mockProcessSyncQueue).toHaveBeenCalledWith(
        "https://api.secpal.dev"
      );
    });

    // Verify last sync time is shown after sync completes
    await waitFor(() => {
      expect(screen.getByText(/last sync:/i)).toBeInTheDocument();
    });
  });

  it("should show offline notice when offline", async () => {
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(false);

    // Add pending operations
    await db.syncQueue.add({
      id: "1",
      type: "create",
      entity: "guards",
      data: {},
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(
        screen.getByText(/offline - will sync when online/i)
      ).toBeInTheDocument();
    });

    // Sync button should not be visible when offline
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
  });

  it("should auto-sync when coming online", async () => {
    const mockProcessSyncQueue = vi.spyOn(apiCache, "processSyncQueue");
    mockProcessSyncQueue.mockResolvedValue({
      total: 1,
      synced: 1,
      failed: 0,
      pending: 0,
    });

    // Add pending operation
    await db.syncQueue.add({
      id: "1",
      type: "create",
      entity: "guards",
      data: {},
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });

    // Start offline
    const mockUseOnlineStatus = vi.mocked(
      useOnlineStatusModule.useOnlineStatus
    );
    mockUseOnlineStatus.mockReturnValue(false);

    const { rerender } = renderWithI18n(
      <SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/offline - will sync when online/i)
      ).toBeInTheDocument();
    });

    // Go online
    mockUseOnlineStatus.mockReturnValue(true);
    rerender(
      <I18nProvider i18n={i18n}>
        <SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />
      </I18nProvider>
    );

    // Should trigger auto-sync
    await waitFor(() => {
      expect(mockProcessSyncQueue).toHaveBeenCalled();
    });
  });

  it("should display sync error message", async () => {
    const user = userEvent.setup();
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    const mockProcessSyncQueue = vi.spyOn(apiCache, "processSyncQueue");
    mockProcessSyncQueue.mockResolvedValue({
      total: 2,
      synced: 1,
      failed: 1,
      pending: 0,
    });

    // Add pending operations
    await db.syncQueue.bulkAdd([
      {
        id: "1",
        type: "create",
        entity: "guards",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      },
    ]);

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(screen.getByText(/1 operation\(s\) pending/i)).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByRole("button", { name: /sync now/i });
    await user.click(syncButton);

    // Wait for error message
    await waitFor(() => {
      expect(
        screen.getByText(/failed to sync 1 operation\(s\)/i)
      ).toBeInTheDocument();
    });
  });

  it("should show last sync time after successful sync", async () => {
    const user = userEvent.setup();
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    const mockProcessSyncQueue = vi.spyOn(apiCache, "processSyncQueue");
    mockProcessSyncQueue.mockResolvedValue({
      total: 1,
      synced: 1,
      failed: 0,
      pending: 0,
    });

    // Add pending operation
    await db.syncQueue.add({
      id: "1",
      type: "create",
      entity: "guards",
      data: {},
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(screen.getByText(/1 operation\(s\) pending/i)).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByRole("button", { name: /sync now/i });
    await user.click(syncButton);

    // Wait for last sync time to appear
    await waitFor(() => {
      expect(screen.getByText(/last sync:/i)).toBeInTheDocument();
    });
  });

  it("should disable sync button while syncing", async () => {
    const user = userEvent.setup();
    vi.mocked(useOnlineStatusModule.useOnlineStatus).mockReturnValue(true);

    // Create a promise that we can control
    let resolveSyncPromise: (value: {
      total: number;
      synced: number;
      failed: number;
      pending: number;
    }) => void;
    const syncPromise = new Promise<{
      total: number;
      synced: number;
      failed: number;
      pending: number;
    }>((resolve) => {
      resolveSyncPromise = resolve;
    });

    const mockProcessSyncQueue = vi.spyOn(apiCache, "processSyncQueue");
    mockProcessSyncQueue.mockReturnValue(syncPromise);

    // Add pending operation
    await db.syncQueue.add({
      id: "1",
      type: "create",
      entity: "guards",
      data: {},
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });

    renderWithI18n(<SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />);

    await waitFor(() => {
      expect(screen.getByText(/1 operation\(s\) pending/i)).toBeInTheDocument();
    });

    // Click sync button
    const syncButton = screen.getByRole("button", { name: /sync now/i });
    await user.click(syncButton);

    // Button should disappear while syncing
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
    });

    // Show syncing indicator
    expect(screen.getByText(/syncing.../i)).toBeInTheDocument();

    // Resolve the sync
    resolveSyncPromise!({
      total: 1,
      synced: 1,
      failed: 0,
      pending: 0,
    });

    // Wait for sync to complete
    await waitFor(() => {
      expect(screen.queryByText(/syncing.../i)).toBeNull();
    });
  });
});
