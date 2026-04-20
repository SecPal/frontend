// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import config from "../playwright.config";

describe("playwright config", () => {
  it("clears developer-local VITE_API_URL overrides for the local dev web server", () => {
    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toBe("npm run dev");
    expect(webServer?.url).toBe("http://localhost:5173");
    expect(webServer?.env?.VITE_API_URL).toBe("");
  });
});
