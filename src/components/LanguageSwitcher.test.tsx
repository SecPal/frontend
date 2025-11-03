// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { LanguageSwitcher } from "./LanguageSwitcher";
import * as i18nModule from "../i18n";

// Mock the i18n module
vi.mock("../i18n", async () => {
  const actual = await vi.importActual("../i18n");
  return {
    ...actual,
    activateLocale: vi.fn(),
    setLocalePreference: vi.fn(),
  };
});

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
  });

  const renderComponent = () => {
    return render(
      <I18nProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nProvider>
    );
  };

  it("renders language selector with current locale", () => {
    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("en");
  });

  it("changes locale when selection changes", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);

    mockActivateLocale.mockResolvedValueOnce(undefined);

    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });

    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      expect(mockActivateLocale).toHaveBeenCalledWith("de");
      expect(mockSetLocalePreference).toHaveBeenCalledWith("de");
    });
  });

  it("displays error message when locale activation fails", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);

    mockActivateLocale.mockRejectedValueOnce(
      new Error("Failed to load locale")
    );

    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });

    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      expect(mockActivateLocale).toHaveBeenCalledWith("de");
      expect(mockSetLocalePreference).not.toHaveBeenCalled();
    });

    // Check for error message
    const errorMessage = await screen.findByRole("alert");
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(/failed to load locale/i);
  });

  it("displays generic error message for unknown errors", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);

    mockActivateLocale.mockRejectedValueOnce("Unknown error");

    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });

    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      const errorMessage = screen.getByRole("alert");
      expect(errorMessage).toHaveTextContent(
        /failed to change language.*please try again/i
      );
    });
  });

  it("clears error message when changing language successfully after a failed attempt", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);

    // First attempt fails
    mockActivateLocale.mockRejectedValueOnce(
      new Error("Failed to load locale")
    );

    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });

    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Second attempt succeeds
    mockActivateLocale.mockResolvedValueOnce(undefined);
    fireEvent.change(select, { target: { value: "en" } });

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
