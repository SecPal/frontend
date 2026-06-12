// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() ?? "";
const POLYSCOPE_WORKSPACE = process.env.POLYSCOPE_WORKSPACE?.trim() ?? "";
const CHROME_PATH = process.env.CHROME_PATH?.trim() ?? "";
const DISPLAY = process.env.DISPLAY?.trim() ?? "";
const WAYLAND_DISPLAY = process.env.WAYLAND_DISPLAY?.trim() ?? "";
const XVFB_PATH = "/usr/bin/Xvfb";
const XVFB_DISPLAY_START = 99;
const XVFB_DISPLAY_END = 110;

// Mirrors the Polyscope clone-path detection in `tests/e2e/target-urls.ts`
// so the live Web Push runbook works inside a Polyscope workspace without
// requiring the operator to set `PLAYWRIGHT_BASE_URL` explicitly. Keep this
// regex in sync with `POLYSCOPE_CLONE_PATH_PATTERN` over there.
const POLYSCOPE_CLONE_PATH_PATTERN =
  /(?:^|\/)\.polyscope\/clones\/[^/]+\/([^/]+)(?:\/|$)/;

// Mirrors `getWorkspacePreviewNameFromBaseUrl` in `tests/e2e/target-urls.ts`.
// Only `frontend-<workspace>.preview.secpal.dev` URLs are workspace-preview
// targets; bare `app.secpal.dev` or other HTTPS hosts are not.
const WORKSPACE_PREVIEW_FRONTEND_PATTERN =
  /^https:\/\/frontend-([^.]+)\.preview\.secpal\.dev(\/|$)/i;

function detectPolyscopeWorkspaceName() {
  if (POLYSCOPE_WORKSPACE.length > 0) {
    return POLYSCOPE_WORKSPACE;
  }

  const normalizedCwd = process.cwd().replace(/\\/g, "/");
  const workspaceMatch = normalizedCwd.match(POLYSCOPE_CLONE_PATH_PATTERN);

  return workspaceMatch?.[1] ?? "";
}

function hasResolvableLiveWebPushTarget() {
  if (detectPolyscopeWorkspaceName().length > 0) {
    return true;
  }

  // An explicit PLAYWRIGHT_BASE_URL override is only accepted when it points
  // at a workspace-preview frontend host; pure live targets such as
  // app.secpal.dev are intentionally not part of the Polyscope E2E surface.
  return WORKSPACE_PREVIEW_FRONTEND_PATTERN.test(PLAYWRIGHT_BASE_URL);
}

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
  if (!hasResolvableLiveWebPushTarget()) {
    fail(
      "test:e2e:live:web-push must run inside a Polyscope workspace clone (under ~/.polyscope/clones/<id>/<workspace>) or with PLAYWRIGHT_BASE_URL set to a workspace-preview frontend URL (https://frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface."
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
