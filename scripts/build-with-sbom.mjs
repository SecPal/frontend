// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { execFileSync } from "node:child_process";

const viteArguments = process.argv.slice(2);

function getOutputDirectory(argumentsToParse) {
  for (let index = 0; index < argumentsToParse.length; index += 1) {
    const argument = argumentsToParse[index];

    if (argument === "--outDir") {
      return argumentsToParse[index + 1] ?? "dist";
    }

    if (argument.startsWith("--outDir=")) {
      return argument.slice("--outDir=".length);
    }
  }

  return "dist";
}

execFileSync("npm", ["exec", "--", "tsc"], { stdio: "inherit" });

execFileSync("npm", ["exec", "--", "vite", "build", ...viteArguments], {
  stdio: "inherit",
});

execFileSync(
  "npm",
  ["run", "generate:dependency-sbom", "--", getOutputDirectory(viteArguments)],
  { stdio: "inherit" }
);
