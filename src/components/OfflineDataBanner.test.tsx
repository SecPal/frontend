// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OfflineDataBanner } from "./OfflineDataBanner";

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

/**
 * Test suite for OfflineDataBanner
 *
 * Tests:
 * - Renders nothing when not offline/stale
 * - Shows offline message when offline
 * - Shows stale data warning with timestamp
 * - Formats timestamp correctly
 */
describe("OfflineDataBanner", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  );

  it("should render nothing when online and data is fresh", () => {
    const { container } = render(
      <OfflineDataBanner isOffline={false} isStale={false} lastSynced={null} />,
      { wrapper }
    );

    expect(container.firstChild).toBeNull();
  });

  it("should show offline banner when offline", () => {
    render(
      <OfflineDataBanner isOffline={true} isStale={true} lastSynced={null} />,
      { wrapper }
    );

    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(screen.getByText(/cached data/i)).toBeInTheDocument();
  });

  it("should show stale data warning when online but data is stale", () => {
    const lastSynced = new Date("2025-01-15T12:00:00Z");

    render(
      <OfflineDataBanner
        isOffline={false}
        isStale={true}
        lastSynced={lastSynced}
      />,
      { wrapper }
    );

    expect(screen.getByText(/cached data/i)).toBeInTheDocument();
    // Should show timestamp
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });

  it("should show refresh button when onRefresh is provided", () => {
    const mockRefresh = vi.fn();

    render(
      <OfflineDataBanner
        isOffline={false}
        isStale={true}
        lastSynced={new Date()}
        onRefresh={mockRefresh}
      />,
      { wrapper }
    );

    const refreshButton = screen.getByRole("button", { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();

    refreshButton.click();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("should hide refresh button when offline", () => {
    const mockRefresh = vi.fn();

    render(
      <OfflineDataBanner
        isOffline={true}
        isStale={true}
        lastSynced={new Date()}
        onRefresh={mockRefresh}
      />,
      { wrapper }
    );

    // Refresh should not be available offline
    expect(
      screen.queryByRole("button", { name: /refresh/i })
    ).not.toBeInTheDocument();
  });

  it("should have accessible role and attributes", () => {
    render(
      <OfflineDataBanner isOffline={true} isStale={true} lastSynced={null} />,
      { wrapper }
    );

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
