// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

describe("Lighthouse CI Configuration", () => {
  const configPath = join(process.cwd(), "lighthouserc.cjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let config: any;

  beforeAll(() => {
    // Load config once for all tests
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    config = require(configPath);
  });

  it("should have valid lighthouserc.js file", () => {
    expect(existsSync(configPath)).toBe(true);
    expect(config).toBeDefined();
    expect(config.ci).toBeDefined();
  });

  it("should configure collect settings", () => {
    expect(config.ci.collect).toBeDefined();
    expect(config.ci.collect.staticDistDir).toBe("./dist");
    expect(config.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(1);
  });

  it("should configure performance assertions", () => {
    expect(config.ci.assert).toBeDefined();
    expect(config.ci.assert.assertions).toBeDefined();

    const assertions = config.ci.assert.assertions;

    // Core Web Vitals must be configured
    expect(assertions["largest-contentful-paint"]).toBeDefined();
    expect(assertions["cumulative-layout-shift"]).toBeDefined();
    expect(assertions["total-blocking-time"]).toBeDefined();
  });

  it("should enforce LCP budget of 2.5s (2500ms)", () => {
    const lcpAssertion =
      config.ci.assert.assertions["largest-contentful-paint"];

    expect(lcpAssertion).toBeDefined();
    expect(lcpAssertion[0]).toBe("error"); // Must be error level
    expect(lcpAssertion[1].maxNumericValue).toBeLessThanOrEqual(2500);
  });

  it("should enforce CLS budget of 0.1", () => {
    const clsAssertion = config.ci.assert.assertions["cumulative-layout-shift"];

    expect(clsAssertion).toBeDefined();
    expect(clsAssertion[0]).toBe("error"); // Must be error level
    expect(clsAssertion[1].maxNumericValue).toBeLessThanOrEqual(0.1);
  });

  it("should detect JavaScript console errors", () => {
    const jsErrorAssertion = config.ci.assert.assertions["errors-in-console"];

    expect(jsErrorAssertion).toBeDefined();
    expect(jsErrorAssertion[0]).toBe("error"); // Must fail on JS errors
    expect(jsErrorAssertion[1].maxNumericValue).toBe(0); // Zero tolerance
  });

  it("should configure upload to temporary storage", () => {
    expect(config.ci.upload).toBeDefined();
    expect(config.ci.upload.target).toBe("temporary-public-storage");
  });

  it("should include accessibility category", () => {
    const categories = config.ci.collect.settings.onlyCategories as string[];
    expect(categories.includes("accessibility")).toBe(true);
  });

  it("should include best-practices category for error detection", () => {
    const categories = config.ci.collect.settings.onlyCategories as string[];
    expect(categories.includes("best-practices")).toBe(true);
  });
});
