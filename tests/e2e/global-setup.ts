// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { chromium, expect, type FullConfig } from "@playwright/test";
import {
  getConfiguredTestUserOrThrow,
  getAuthStateCachePath,
  isRemoteE2ETarget,
  waitForLoginFormReady,
} from "./auth-helpers";
import {
  installMockAuthRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";
import * as fs from "fs";
import * as path from "path";

/**
 * Global Setup - runs once before all tests
 *
 * Logs in once and saves the session state to be reused by all tests.
 * This prevents rate-limiting issues from multiple login attempts.
 */
async function globalSetup(config: FullConfig) {
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_LOGIN === "1") {
    console.log(
      "⏭️  Skipping global login setup (PLAYWRIGHT_SKIP_GLOBAL_LOGIN=1)"
    );
    return;
  }

  const testUser = getConfiguredTestUserOrThrow();
  // Ensure auth directory exists
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:5173";
  const authFile = path.resolve(
    process.cwd(),
    getAuthStateCachePath(testUser, String(baseURL))
  );
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Skip if auth file already exists and is recent (< 30 minutes old)
  if (isRemoteE2ETarget(String(baseURL)) && fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
    if (ageMinutes < 30) {
      console.log("♻️  Reusing existing auth session");
      return;
    }
  }

  console.log("🔐 Performing global login setup...");

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (!isRemoteE2ETarget(String(baseURL))) {
      await installMockAuthRoutes(context);
      await installStoredMockBrowserSession(page);
      await page.goto(baseURL);
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible({ timeout: 15_000 });

      await context.storageState({ path: authFile });
      console.log("✅ Local mocked auth session saved");
      return;
    }

    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState("networkidle");

    // Fill in credentials
    await page.locator("#email").fill(testUser.email);
    await page.locator("#password").fill(testUser.password);

    await waitForLoginFormReady(page);

    // Submit form
    await page
      .getByRole("button", { name: /log in|anmelden|einloggen/i })
      .click();

    // Wait for redirect
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15_000,
    });

    // Save storage state
    await context.storageState({ path: authFile });
    console.log("✅ Auth session saved");
  } catch (error) {
    console.error("❌ Login failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
