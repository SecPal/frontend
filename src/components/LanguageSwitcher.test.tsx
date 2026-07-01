// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, fireEvent, waitFor } from "@testing-library/dom";
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

  async function selectLanguage(visibleName: string) {
    const trigger = screen.getByRole("combobox", {
      name: /select language/i,
    });
    fireEvent.pointerDown(trigger, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(trigger, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.click(trigger, { button: 0 });

    const option = await screen.findByRole("option", { name: visibleName });
    fireEvent.pointerDown(option, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(option, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.click(option, { button: 0 });
  }

  it("renders language selector with current locale", () => {
    renderComponent();
    const select = screen.getByRole("combobox", { name: /select language/i });
    expect(select).toBeInTheDocument();
    expect(select).toHaveTextContent("English");
    expect(select).toHaveAttribute("data-slot", "select-trigger");
  });

  it("changes locale when selection changes", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);

    mockActivateLocale.mockResolvedValueOnce(undefined);

    renderComponent();
    await selectLanguage("Deutsch");

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
    await selectLanguage("Deutsch");

    await waitFor(() => {
      expect(mockActivateLocale).toHaveBeenCalledWith("de");
      expect(mockSetLocalePreference).not.toHaveBeenCalled();
    });

    // Check for error message
    const errorMessage = await screen.findByRole("alert");
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(/failed to load locale/i);
    expect(errorMessage).toHaveAttribute("data-slot", "alert");
    expect(errorMessage).toHaveClass("border-destructive/30", "bg-destructive/10");
    expect(errorMessage.className).not.toContain("text-red-600");
  });

  it("displays generic error message for unknown errors", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);

    mockActivateLocale.mockRejectedValueOnce("Unknown error");

    renderComponent();
    await selectLanguage("Deutsch");

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
    await selectLanguage("Deutsch");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Second attempt succeeds
    mockActivateLocale.mockResolvedValueOnce(undefined);
    await selectLanguage("Deutsch");

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
