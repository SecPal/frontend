// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { getOnboardingPasswordIssue } from "./onboardingPasswordValidation";

describe("getOnboardingPasswordIssue", () => {
  it("returns too_short when under 12 characters", () => {
    expect(getOnboardingPasswordIssue("Abcdefgh1!")).toBe("too_short");
  });

  it("returns mixed_case when letter case is not mixed", () => {
    expect(getOnboardingPasswordIssue("abcdefghijkl1!")).toBe("mixed_case");
  });

  it("returns number when no digit", () => {
    expect(getOnboardingPasswordIssue("Abcdefghijkl!")).toBe("number");
  });

  it("returns symbol when no symbol", () => {
    expect(getOnboardingPasswordIssue("Abcdefghijkl1")).toBe("symbol");
  });

  it("returns null for a compliant password", () => {
    expect(getOnboardingPasswordIssue("ValidPass12!")).toBeNull();
  });
});
