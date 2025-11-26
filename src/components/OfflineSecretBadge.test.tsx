// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OfflineSecretBadge } from "./OfflineSecretBadge";

// Initialize i18n for tests
i18n.loadAndActivate({ locale: "en", messages: {} });

// Helper to wrap components with I18nProvider
const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
};

describe("OfflineSecretBadge", () => {
  it("should render offline-only badge", () => {
    renderWithI18n(<OfflineSecretBadge isOfflineOnly />);
    expect(screen.getByText("Offline only")).toBeInTheDocument();
  });

  it("should render pending changes badge", () => {
    renderWithI18n(<OfflineSecretBadge hasPendingChanges />);
    expect(screen.getByText("Pending sync")).toBeInTheDocument();
  });

  it("should render nothing when no flags set", () => {
    const { container } = renderWithI18n(<OfflineSecretBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("should prioritize offline-only over pending changes", () => {
    renderWithI18n(<OfflineSecretBadge isOfflineOnly hasPendingChanges />);
    expect(screen.getByText("Offline only")).toBeInTheDocument();
    expect(screen.queryByText("Pending sync")).not.toBeInTheDocument();
  });
});
