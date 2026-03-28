// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Lingui configuration", () => {
  const baseConfigPath = join(process.cwd(), "lingui.config.cjs");
  const translationConfigPath = join(
    process.cwd(),
    "lingui.translationio.config.cjs"
  );

  it("keeps the default sync config local-only", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(baseConfigPath);

    expect(config.service).toBeUndefined();
  });

  it("enables Translation.io only when an API key is provided", () => {
    const stdout = execFileSync(
      process.execPath,
      [
        "-e",
        `const config = require(${JSON.stringify(translationConfigPath)}); process.stdout.write(JSON.stringify(config.service));`,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TRANSLATION_IO_API_KEY: "test-translation-io-key",
        },
        encoding: "utf8",
      }
    );

    expect(JSON.parse(stdout)).toEqual({
      name: "TranslationIO",
      apiKey: "test-translation-io-key",
    });
  });

  it("fails fast when Translation.io sync is requested without an API key", () => {
    const result = spawnSync(
      process.execPath,
      ["-e", `require(${JSON.stringify(translationConfigPath)});`],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TRANSLATION_IO_API_KEY: "",
        },
        encoding: "utf8",
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Translation.io sync requires TRANSLATION_IO_API_KEY"
    );
  });
});
