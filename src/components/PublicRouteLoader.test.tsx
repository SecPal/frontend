// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { PublicRouteLoader } from "./PublicRouteLoader";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
}

describe("PublicRouteLoader", () => {
  it("uses canonical theme tokens for the shell and spinner", () => {
    const { container } = renderWithI18n(<PublicRouteLoader />);

    const status = screen.getByRole("status", { name: /loading page/i });
    const spinner = container.querySelector('[aria-hidden="true"]');

    expect(status).toHaveClass("bg-background");
    expect(spinner).toHaveClass("border-border", "border-t-foreground");

    expect(status.className).not.toContain("bg-white");
    expect(spinner?.className).not.toContain("border-zinc-300");
    expect(spinner?.className).not.toContain("border-t-zinc-950");
  });
});
