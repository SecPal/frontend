// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, isSafeMailtoTarget, isSafeTelTarget } from "./safeUrl";

describe("isSafeHttpUrl", () => {
  it.each([
    "https://api.secpal.dev/v1/employees/emp-1/export.csv",
    "https://api.secpal.dev/path?token=abc#download",
  ])("allows HTTPS URLs: %s", (value) => {
    expect(isSafeHttpUrl(value)).toBe(true);
  });

  it.each([
    "http://localhost:5173/export.csv",
    "http://127.0.0.1:4173/export.csv",
    "http://127.42.0.1:4173/export.csv",
    "http://[::1]:4173/export.csv",
  ])("allows loopback HTTP URLs in development: %s", (value) => {
    expect(isSafeHttpUrl(value, { allowDevLoopback: true })).toBe(true);
  });

  it.each([
    "http://localhost:5173/export.csv",
    "http://127.0.0.1:4173/export.csv",
    "http://[::1]:4173/export.csv",
  ])("allows loopback HTTP URLs from loopback app origins: %s", (value) => {
    expect(
      isSafeHttpUrl(value, {
        allowDevLoopback: false,
        currentHostname: "localhost",
      })
    ).toBe(true);
  });

  it.each([
    "http://localhost:5173/export.csv",
    "http://127.0.0.1:4173/export.csv",
    "http://[::1]:4173/export.csv",
  ])("rejects loopback HTTP URLs from production app origins: %s", (value) => {
    expect(
      isSafeHttpUrl(value, {
        allowDevLoopback: false,
        currentHostname: "app.secpal.dev",
      })
    ).toBe(false);
  });

  it.each([
    "",
    "   ",
    "/v1/employees/emp-1/export.csv",
    "javascript:alert('xss')",
    "JaVaScRiPt:alert('xss')",
    " javascript:alert('xss') ",
    "data:text/html,<script>alert('xss')</script>",
    " data:text/html,<script>alert('xss')</script> ",
    "vbscript:msgbox('xss')",
    "file:///etc/passwd",
    "ftp://api.secpal.dev/export.csv",
    "http://api.secpal.dev/export.csv",
    "http://192.168.0.1/export.csv",
    "http://127.evil.com/export.csv",
    "http://127.0.0.1.evil.com/export.csv",
  ])("rejects unsafe or non-absolute URLs: %s", (value) => {
    expect(isSafeHttpUrl(value)).toBe(false);
  });
});

describe("isSafeMailtoTarget", () => {
  it.each([
    "user@example.com",
    "first.last@example.co.uk",
    "service+alerts@sub.example.com",
    "user@intranet",
    "me@example",
    "user@example.xn--p1ai",
    "user@xn--bcher-kva.de",
  ])("allows email addresses without mailto parameters: %s", (value) => {
    expect(isSafeMailtoTarget(value)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "foo@bar.com?bcc=attacker@example.com",
    "foo@bar.com&subject=Injected",
    "foo@bar.com#fragment",
    "foo@bar.com\nBcc: attacker@example.com",
    "foo@bar.com\r\nBcc: attacker@example.com",
    "foo@bar.com%0ABcc:attacker@example.com",
    // local-part injection: ? & # in local part produce header-injection mailto URIs
    "foo?bcc=attacker@bar.com",
    "foo&subject=Injected@bar.com",
    "foo#fragment@bar.com",
    // percent-encoding bypass: %40 decodes to @ producing double-@ addresses
    "foo%40bar@example.com",
    // % in local part
    "foo%2Fbar@example.com",
    "javascript:alert(1)",
    "mailto:foo@bar.com",
    "foo bar@example.com",
  ])("rejects unsafe mailto targets: %s", (value) => {
    expect(isSafeMailtoTarget(value)).toBe(false);
  });
});

describe("isSafeTelTarget", () => {
  it.each([
    "+49 30 1234567",
    "+1-202-555-0100",
    "030.1234567",
    "+49 30 1234567;ext=42",
    "(202) 555-0100",
    "+1 202 555 0100 x42",
  ])("allows dial strings with visual separators: %s", (value) => {
    expect(isSafeTelTarget(value)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "+49?suffix=evil",
    "+49&suffix=evil",
    "+49#evil",
    "+49\n1234567",
    "+49\r1234567",
    "+49%0A1234567",
    "javascript:alert(1)",
    "tel:+49301234567",
    "+49,301234567",
    "+49;phone-context=example.com",
    "+49;ext=abc",
    // space immediately before ;ext= produces a malformed RFC 3966 dial string
    "+49 30 1234567 ;ext=42",
  ])("rejects unsafe tel targets: %s", (value) => {
    expect(isSafeTelTarget(value)).toBe(false);
  });
});
