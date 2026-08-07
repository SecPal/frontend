// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { hasExactOrigin } from "./e2e/container-origin";

describe("container browser request origin matching", () => {
  const expectedOrigin = "https://api.secpal.dev";

  it.each([
    "https://api.secpal.dev/v1/me",
    "https://api.secpal.dev:443/health/ready",
  ])("accepts the configured API origin: %s", (requestUrl) => {
    expect(hasExactOrigin(requestUrl, expectedOrigin)).toBe(true);
  });

  it.each([
    "https://api.secpal.dev.evil.secpal.dev/v1/me",
    "https://api.secpal.dev@evil.secpal.dev/v1/me",
    "https://evil.secpal.dev/?next=https://api.secpal.dev",
    "not-a-url",
  ])("rejects a non-matching URL: %s", (requestUrl) => {
    expect(hasExactOrigin(requestUrl, expectedOrigin)).toBe(false);
  });
});
