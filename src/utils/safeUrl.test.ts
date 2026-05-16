// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { isSafeHttpUrl } from "./safeUrl";

describe("isSafeHttpUrl", () => {
  it.each([
    "https://api.secpal.dev/v1/employees/emp-1/export.csv",
    "https://api.secpal.dev/path?token=abc#download",
    "http://localhost:5173/export.csv",
    "http://127.0.0.1:4173/export.csv",
    "http://127.42.0.1:4173/export.csv",
    "http://[::1]:4173/export.csv",
  ])("allows safe HTTP URLs: %s", (value) => {
    expect(isSafeHttpUrl(value)).toBe(true);
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
