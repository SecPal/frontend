// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RouteLoader } from "./RouteLoader";
import { APP_SHELL_MAX_WIDTH_CLASS } from "./app-shell-width";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("RouteLoader", () => {
  it("renders a shell-equivalent loading placeholder", () => {
    renderWithI18n(<RouteLoader />);

    expect(screen.getByRole("img", { name: "SecPal" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();
  });

  it("has correct accessibility attributes on the content skeleton", () => {
    renderWithI18n(<RouteLoader />);

    const statusElement = screen.getByRole("status", {
      name: /loading application/i,
    });
    expect(statusElement).toHaveAttribute("aria-live", "polite");
    expect(statusElement).toHaveAttribute("aria-busy", "true");
  });

  it("does not render the old raw loading copy", () => {
    renderWithI18n(<RouteLoader />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders with shell styling classes", () => {
    const { container } = renderWithI18n(<RouteLoader />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass(
      "relative",
      "isolate",
      "flex",
      "min-h-[var(--app-shell-min-height)]",
      "w-full",
      "flex-col"
    );
    expect(outerDiv).toHaveClass("bg-background");
    expect(outerDiv.className).not.toContain("bg-white");
    expect(outerDiv.className).not.toContain("lg:bg-zinc-100");
  });

  it("keeps the loading header below the iOS top safe area", () => {
    const { container } = renderWithI18n(<RouteLoader />);

    expect(container.querySelector("header")).toHaveClass(
      "pt-[var(--app-safe-area-inset-top)]"
    );
  });

  it("renders skeleton placeholders instead of a spinner", () => {
    const { container } = renderWithI18n(<RouteLoader />);

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("keeps header and content surfaces on canonical tokens", () => {
    const { container } = renderWithI18n(<RouteLoader />);

    const headerRow = container.querySelector("header > div");
    const main = container.querySelector("main");

    expect(headerRow).toHaveClass("border-border");
    expect(main).toHaveClass("bg-background");

    expect(headerRow?.className).not.toContain("border-zinc-950/10");
    expect(main?.className).not.toContain("bg-white");
  });

  it("uses the shared wide desktop content container", () => {
    const { container } = renderWithI18n(<RouteLoader />);

    const contentContainer = container.querySelector("main > div > div");

    expect(contentContainer).toHaveClass(
      ...APP_SHELL_MAX_WIDTH_CLASS.split(" ")
    );
  });
});
