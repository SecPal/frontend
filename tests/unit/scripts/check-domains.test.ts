// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function runDomainCheck(
  files: Array<{ path: string; contents: string }>
): ReturnType<typeof spawnSync> {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-domains-"));

  try {
    mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
    writeFileSync(
      path.join(tempDir, "scripts", "check-domains.sh"),
      readFileSync(path.join(repoRoot, "scripts", "check-domains.sh"), "utf8")
    );

    for (const file of files) {
      const fullPath = path.join(tempDir, file.path);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.contents, "utf8");
    }

    return spawnSync("bash", ["scripts/check-domains.sh"], {
      cwd: tempDir,
      encoding: "utf8",
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("check-domains", () => {
  it("accepts secpal-prefixed storage keys that are not hostnames", () => {
    const result = runDomainCheck([
      {
        path: "public/theme-color.js",
        contents:
          'var assetLoadRecoveryStorageKey = "secpal.asset-load-recovery";\n',
      },
      {
        path: ".context/notes.md",
        contents:
          "`secpal.asset-load-recovery` is a local workspace storage key.\n",
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain("Domain Policy Check PASSED");
  });

  it("rejects forbidden hostnames on lines that also mention the asset key", () => {
    const forbiddenHostname = ["status", "secpal", "io"].join(".");

    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Inline note: "secpal.asset-load-recovery" must not mask https://${forbiddenHostname}.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(forbiddenHostname);
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects the asset key when it is used as a hostname", () => {
    const forbiddenHostname = ["secpal", "asset-load-recovery"].join(".");

    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${forbiddenHostname}/path for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(forbiddenHostname);
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects the asset key hostname when a query string follows it", () => {
    const forbiddenHostname = ["secpal", "asset-load-recovery"].join(".");

    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use ${forbiddenHostname}?debug=1 for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(forbiddenHostname);
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects the asset key hostname when a fragment follows it", () => {
    const forbiddenHostname = ["secpal", "asset-load-recovery"].join(".");

    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use ${forbiddenHostname}#frag for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(forbiddenHostname);
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["status", "secpal", "io"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      ["status", "secpal", "io"].join(".")
    );
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames with punycode TLDs", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["status", "secpal", "xn--p1ai"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      ["status", "secpal", "xn--p1ai"].join(".")
    );
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames with digit-bearing final labels", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["api", "secpal", "dev2"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      ["api", "secpal", "dev2"].join(".")
    );
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames with long ascii final labels", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["status", "secpal", "abcdefghijklmnopqrstuvwxyz"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      ["status", "secpal", "abcdefghijklmnopqrstuvwxyz"].join(".")
    );
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames with hyphenated final labels", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["api", "secpal", "dev-test"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      ["api", "secpal", "dev-test"].join(".")
    );
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });

  it("rejects forbidden secpal hostnames with one-character final labels", () => {
    const result = runDomainCheck([
      {
        path: "README.md",
        contents: `Use https://${["secpal", "x"].join(".")} for diagnostics.\n`,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain(["secpal", "x"].join("."));
    expect(result.stdout + result.stderr).toContain(
      "Domain Policy Check FAILED"
    );
  });
});
