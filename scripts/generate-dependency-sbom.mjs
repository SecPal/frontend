// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputDirectory = process.argv[2] ?? "dist";

mkdirSync(outputDirectory, { recursive: true });

const sbom = execFileSync(
  "npx",
  [
    "--yes",
    "--package",
    "npm@12.0.0",
    "npm",
    "sbom",
    "--package-lock-only",
    "--sbom-format",
    "spdx",
    "--sbom-type",
    "application",
  ],
  {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  }
);

writeFileSync(path.join(outputDirectory, "dependencies.spdx.json"), sbom);
