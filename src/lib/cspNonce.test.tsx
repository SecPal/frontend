// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getNonce } from "get-nonce";
import { describe, expect, it } from "vitest";
import { LoginOtpInput } from "@/pages/Auth/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui";
import {
  getCspNonce,
  INPUT_OTP_STYLE_MARKER_ID,
} from "./cspNonce";
import { RuntimeStyleCspSupport } from "./RuntimeStyleCspSupport";

function installCspNonceCarrier(nonce: string) {
  const existing = document.querySelector("script[data-csp-nonce-carrier]");
  existing?.remove();

  const script = document.createElement("script");
  script.setAttribute("data-csp-nonce-carrier", "");
  script.setAttribute("nonce", nonce);
  document.head.appendChild(script);
}

describe("runtime CSP nonce support", () => {
  it("applies the HTML-shell nonce synchronously before runtime style effects mount", () => {
    installCspNonceCarrier("nonce-sync");

    expect(getCspNonce()).toBe("nonce-sync");
    expect(getNonce()).toBe("nonce-sync");
    expect((globalThis as { __webpack_nonce__?: string }).__webpack_nonce__).toBe(
      "nonce-sync"
    );
  });

  it("reads the nonce property when browsers hide the nonce attribute value", () => {
    installCspNonceCarrier("nonce-property");

    const carrier = document.querySelector(
      "script[data-csp-nonce-carrier]"
    ) as HTMLScriptElement;
    const originalGetAttribute = carrier.getAttribute.bind(carrier);

    carrier.nonce = "nonce-property";
    carrier.getAttribute = ((name: string) =>
      name === "nonce" ? "" : originalGetAttribute(name)) as typeof carrier.getAttribute;

    expect(getCspNonce()).toBe("nonce-property");
    expect(getNonce()).toBe("nonce-property");
  });

  it("adds the CSP nonce to style elements created at runtime", () => {
    installCspNonceCarrier("nonce-style");

    const style = document.createElement("style");

    expect(style).toHaveAttribute("nonce", "nonce-style");
    expect(style.nonce).toBe("nonce-style");
  });

  it("adds the CSP nonce when a runtime style is inserted without one", () => {
    installCspNonceCarrier("nonce-insert");

    const style = document.createElement("style");
    style.removeAttribute("nonce");

    document.head.appendChild(style);

    expect(style).toHaveAttribute("nonce", "nonce-insert");
  });

  it("bridges the HTML-shell nonce into runtime style helpers and blocks input-otp reinjection", () => {
    installCspNonceCarrier("nonce-otp");

    render(
      <>
        <RuntimeStyleCspSupport />
        <LoginOtpInput
          value=""
          onChange={() => undefined}
          aria-label="Authenticator code"
        />
      </>
    );

    expect(getNonce()).toBe("nonce-otp");
    expect(document.getElementById(INPUT_OTP_STYLE_MARKER_ID)).toHaveAttribute(
      "data-secpal-runtime-style-marker",
      ""
    );
    expect(document.querySelector("style#input-otp-style")).toBeNull();
  });

  it("passes the CSP nonce through to Radix Select viewport styles at runtime", async () => {
    installCspNonceCarrier("nonce-select");
    const user = userEvent.setup();

    render(
      <Select defaultValue="de">
        <SelectTrigger aria-label="Language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="de">German</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole("combobox", { name: "Language" }));

    const style = Array.from(document.querySelectorAll("style")).find((node) =>
      node.textContent?.includes("data-radix-select-viewport")
    );

    expect(style).toHaveAttribute("nonce", "nonce-select");
  });

  it("gives scroll-lock runtime styles a CSP nonce when dialogs mount", () => {
    installCspNonceCarrier("nonce-dialog");

    render(
      <>
        <RuntimeStyleCspSupport />
        <Dialog open onClose={() => undefined}>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>Review before continuing.</DialogDescription>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </>
    );

    const style = Array.from(document.querySelectorAll("style")).find((node) =>
      node.textContent?.includes("data-scroll-locked")
    );

    expect(style).toHaveAttribute("nonce", "nonce-dialog");
  });

  it("ignores an unexpanded SSI nonce placeholder", () => {
    installCspNonceCarrier("<!--#echo var='csp_nonce' encoding='none' -->");

    render(<RuntimeStyleCspSupport />);

    expect(getNonce()).not.toContain("<!--#echo");
  });
});
