// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { isTransientModuleLoadError } from "./lazyModuleErrors";

describe("isTransientModuleLoadError", () => {
  it("treats Firefox dynamic import failures as transient", () => {
    expect(
      isTransientModuleLoadError(
        new TypeError("error loading dynamically imported module")
      )
    ).toBe(true);
  });
});
