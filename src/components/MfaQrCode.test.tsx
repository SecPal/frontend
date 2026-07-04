// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import QRCode from "qrcode";
import { MfaQrCode } from "./MfaQrCode";

vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(),
  },
}));

describe("MfaQrCode", () => {
  it("keeps loading, success, and error surfaces on canonical theme tokens", async () => {
    let resolveQr!: (value: string) => void;
    vi.mocked(QRCode.toString).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQr = resolve;
        })
    );

    const { rerender, container } = render(
      <I18nProvider i18n={i18n}>
        <MfaQrCode value="otpauth://totp/demo" alt="QR code" />
      </I18nProvider>
    );

    const loadingShell = screen.getByRole("status");
    const loadingText = screen.getByText(/generating qr code/i);
    expect(loadingShell).toHaveClass("border-border", "bg-muted");
    expect(loadingText).toHaveClass("text-muted-foreground");
    expect(loadingShell.className).not.toContain("border-zinc-200");

    resolveQr("<svg></svg>");
    await waitFor(() => {
      expect(screen.getByAltText("QR code")).toBeInTheDocument();
    });

    const successShell = container.querySelector("img")?.parentElement;
    expect(successShell).toHaveClass("border-border", "bg-card");
    expect(successShell?.className).not.toContain("bg-white");

    vi.mocked(QRCode.toString).mockRejectedValueOnce(new Error("boom"));
    rerender(
      <I18nProvider i18n={i18n}>
        <MfaQrCode value="otpauth://totp/fail" alt="QR code failure" />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/unable to generate qr code/i)
      ).toBeInTheDocument();
    });

    const errorShell = screen
      .getByText(/unable to generate qr code/i)
      .closest('[data-slot="alert"]');
    const errorText = screen.getByText(/unable to generate qr code/i);
    expect(errorShell).toHaveClass("border-amber-500/30", "bg-amber-500/10");
    expect(errorShell).toHaveAttribute("data-slot", "alert");
    expect(errorText).toHaveClass("text-foreground");
    expect(errorShell?.className).not.toContain("border-amber-200");
    expect(errorText.className).not.toContain("text-amber-700");
  });
});
