// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EncryptionProgress } from "./EncryptionProgress";

function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("EncryptionProgress", () => {
  it("keeps file and indeterminate progress surfaces on canonical theme tokens", () => {
    const { rerender } = renderWithI18n(
      <EncryptionProgress
        isEncrypting={true}
        progress={new Map([["evidence.pdf", 45]])}
      />
    );

    const shell = screen.getByRole("status");
    const title = screen.getByText(/encrypting files/i);
    const filename = screen.getByText("evidence.pdf");
    const track = screen.getByRole("progressbar").parentElement;
    const bar = screen.getByRole("progressbar");

    expect(shell).toHaveClass("border-border", "bg-muted");
    expect(title).toHaveClass("text-foreground");
    expect(filename).toHaveClass("text-muted-foreground");
    expect(track).toHaveClass("bg-accent");
    expect(bar).toHaveClass("bg-primary");
    expect(shell.className).not.toContain("bg-blue-100");

    rerender(
      <I18nProvider i18n={i18n}>
        <EncryptionProgress isEncrypting={true} progress={new Map()} />
      </I18nProvider>
    );

    const indeterminateTrack = screen.getByText(/encrypting files/i)
      .nextElementSibling as HTMLElement;
    const indeterminateBar =
      indeterminateTrack.firstElementChild as HTMLElement;

    expect(indeterminateTrack).toHaveClass("bg-accent");
    expect(indeterminateBar).toHaveClass("bg-primary");
    expect(indeterminateTrack.className).not.toContain("bg-blue-200");
  });
});
