// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MfaQrCode } from "./MfaQrCode";

const { mockQrToString } = vi.hoisted(() => ({
  mockQrToString: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: {
    toString: mockQrToString,
  },
}));

describe("MfaQrCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  function renderQrCode() {
    return render(
      <I18nProvider i18n={i18n}>
        <MfaQrCode value="otpauth://example" alt="MFA setup QR code" />
      </I18nProvider>
    );
  }

  it("renders an image when QR generation succeeds", async () => {
    mockQrToString.mockResolvedValueOnce(
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
    );

    renderQrCode();

    expect(screen.getByText(/generating qr code/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: /mfa setup qr code/i })
      ).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
    });

    expect(mockQrToString).toHaveBeenCalledWith("otpauth://example", {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 192,
    });
  });

  it("shows the manual setup fallback when QR generation fails", async () => {
    mockQrToString.mockRejectedValueOnce(new Error("QR failed"));

    renderQrCode();

    expect(screen.getByText(/generating qr code/i)).toBeInTheDocument();

    expect(
      await screen.findByText(/unable to generate qr code/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /mfa setup qr code/i })
    ).not.toBeInTheDocument();
  });
});
