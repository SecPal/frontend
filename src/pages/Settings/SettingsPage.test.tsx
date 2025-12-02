// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SettingsPage } from "./SettingsPage";
import * as i18nModule from "../../i18n";

// Mock the i18n module
vi.mock("../../i18n", async () => {
  const actual = await vi.importActual("../../i18n");
  return {
    ...actual,
    activateLocale: vi.fn(),
    setLocalePreference: vi.fn(),
    locales: { en: "English", de: "Deutsch" },
  };
});

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the settings page with heading", () => {
    renderWithProviders(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("displays language selection section", () => {
    renderWithProviders(<SettingsPage />);

    // Language heading should exist
    expect(
      screen.getByRole("heading", { name: /language/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /select language/i })
    ).toBeInTheDocument();
  });

  it("shows current language as selected", () => {
    renderWithProviders(<SettingsPage />);

    const select = screen.getByRole("combobox", { name: /select language/i });
    expect(select).toHaveValue("en");
  });

  it("changes language when selection changes", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);
    mockActivateLocale.mockResolvedValueOnce(undefined);

    renderWithProviders(<SettingsPage />);

    const select = screen.getByRole("combobox", { name: /select language/i });
    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      expect(mockActivateLocale).toHaveBeenCalledWith("de");
      expect(mockSetLocalePreference).toHaveBeenCalledWith("de");
    });
  });

  it("displays description text for language setting", () => {
    renderWithProviders(<SettingsPage />);

    expect(
      screen.getByText(/choose.*preferred.*language/i)
    ).toBeInTheDocument();
  });

  it("has proper heading hierarchy", () => {
    renderWithProviders(<SettingsPage />);

    // Main heading should be h1 (via Heading component)
    const mainHeading = screen.getByRole("heading", { name: /settings/i });
    expect(mainHeading.tagName).toBe("H1");

    // Language section heading should be h2
    const languageHeading = screen.getByRole("heading", { name: /language/i });
    expect(languageHeading.tagName).toBe("H2");
  });
});
