// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
const CHROME_PATH = process.env.CHROME_PATH?.trim() ?? "";
const DISPLAY = process.env.DISPLAY?.trim() ?? "";
const WAYLAND_DISPLAY = process.env.WAYLAND_DISPLAY?.trim() ?? "";
const XVFB_PATH = "/usr/bin/Xvfb";
const XVFB_DISPLAY_START = 99;
const XVFB_DISPLAY_END = 110;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function onceExit(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.once("error", reject);
    childProcess.once("exit", (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function hasDisplay() {
  return DISPLAY.length > 0 || WAYLAND_DISPLAY.length > 0;
}

async function probeDisplay(display, { retries = 10, intervalMs = 200 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await execFileAsync("xdpyinfo", ["-display", display], {
        timeout: 2000,
      });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return false;
}

async function startVirtualDisplay() {
  if (process.platform !== "linux" || hasDisplay()) {
    return undefined;
  }

  if (!existsSync(XVFB_PATH)) {
    fail(
      "Headless Linux live browser Web Push smoke requires /usr/bin/Xvfb or an existing DISPLAY/WAYLAND_DISPLAY."
    );
  }

  for (
    let displayNumber = XVFB_DISPLAY_START;
    displayNumber <= XVFB_DISPLAY_END;
    displayNumber += 1
  ) {
    const display = `:${displayNumber}`;
    const xvfb = spawn(
      XVFB_PATH,
      [display, "-screen", "0", "1440x1024x24", "-ac"],
      {
        stdio: "ignore",
      }
    );

    const exitedEarly = await new Promise((resolve) => {
      xvfb.once("error", () => resolve(true));
      xvfb.once("exit", () => resolve(true));
      setTimeout(() => resolve(false), 200);
    });

    if (exitedEarly) {
      continue;
    }

    const started = await probeDisplay(display);

    if (started) {
      return {
        display,
        xvfb,
      };
    }

    if (!xvfb.killed) {
      xvfb.kill("SIGTERM");
    }
  }

  fail(
    `Failed to start Xvfb on any display between :${XVFB_DISPLAY_START} and :${XVFB_DISPLAY_END}.`
  );
}

async function main() {
  if (!/^https:\/\//.test(PLAYWRIGHT_BASE_URL)) {
    fail(
      "PLAYWRIGHT_BASE_URL must be set to an https:// app URL before running test:e2e:live:web-push"
    );
  }

  if (!CHROME_PATH) {
    fail(
      "CHROME_PATH must point to a stable Chrome/Chromium binary before running test:e2e:live:web-push"
    );
  }

  const virtualDisplay = await startVirtualDisplay();
  const env = {
    ...process.env,
    PLAYWRIGHT_LIVE_WEB_PUSH: "1",
    PLAYWRIGHT_SKIP_GLOBAL_LOGIN: "1",
    ...(virtualDisplay && !hasDisplay()
      ? { DISPLAY: virtualDisplay.display }
      : {}),
  };

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const playwright = spawn(
    npmCommand,
    [
      "exec",
      "--",
      "playwright",
      "test",
      "tests/e2e/web-push.live.spec.ts",
      "--project=chromium",
    ],
    {
      stdio: "inherit",
      env,
    }
  );

  const cleanup = () => {
    if (virtualDisplay?.xvfb && !virtualDisplay.xvfb.killed) {
      virtualDisplay.xvfb.kill("SIGTERM");
    }
  };

  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(143);
  });

  let exitCode;
  try {
    exitCode = await onceExit(playwright);
  } finally {
    cleanup();
  }
  process.exit(exitCode);
}

void main();
