// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import { resolve as resolvePath, sep as pathSep } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  buildSyncEnvironment,
  checkLinguiCatalogs,
} from "../scripts/check-lingui-catalogs.mjs";

const execFileAsync = promisify(execFile);

describe("Lingui catalog sync guard", () => {
  it("preserves PATHEXT for Windows npm resolution", () => {
    const environment = buildSyncEnvironment({
      PATH: "/usr/bin",
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
    });

    expect(environment.PATHEXT).toBe(".COM;.EXE;.BAT;.CMD");
  });

  it("runs sync inside an isolated temporary workspace", async () => {
    let observedCwd = "";
    let observedCommand = "";
    let observedArgs: readonly string[] = [];

    const changedFiles = await checkLinguiCatalogs({
      execFileAsyncImpl: async (_command, _args, options) => {
        observedCommand = _command;
        observedArgs = _args;
        observedCwd = options.cwd;
        return {
          stdout: "",
          stderr: "",
        };
      },
    });

    expect(changedFiles).toEqual([]);
    expect(observedCommand).toBe(process.platform === "win32" ? "npm.cmd" : "npm");
    expect(observedArgs).toEqual(["run", "sync:purge"]);
    expect(observedCwd.startsWith(resolvePath(process.cwd()) + pathSep)).toBe(
      false
    );
    expect(observedCwd).toContain("secpal-lingui-catalog-check-");
  }, 5_000);

  it("keeps checked-in catalogs synchronized with source strings", async () => {
    const scriptPath = resolvePath(
      process.cwd(),
      "scripts/check-lingui-catalogs.mjs"
    );

    const result = await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CI: "1",
      },
      maxBuffer: 16 * 1024 * 1024,
    });

    expect(result.stdout).toContain("Lingui catalogs are up to date.");
  }, 120_000);
});
