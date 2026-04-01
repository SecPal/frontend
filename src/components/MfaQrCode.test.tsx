// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen, waitFor } from "@testing-library/react";
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
  });

  it("renders an image when QR generation succeeds", async () => {
    mockQrToString.mockResolvedValueOnce(
      "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
    );

    render(<MfaQrCode value="otpauth://example" alt="MFA setup QR code" />);

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

    render(<MfaQrCode value="otpauth://example" alt="MFA setup QR code" />);

    expect(screen.getByText(/generating qr code/i)).toBeInTheDocument();

    expect(
      await screen.findByText(
        /qr code generation is unavailable in this browser/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /mfa setup qr code/i })
    ).not.toBeInTheDocument();
  });
});
