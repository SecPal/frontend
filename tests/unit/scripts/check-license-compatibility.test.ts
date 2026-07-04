// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function installMockReuse(tempDir: string, licenseExpressions: string[]) {
  const binDir = path.join(tempDir, "bin");
  mkdirSync(binDir, { recursive: true });

  const reuseSpdx = licenseExpressions
    .map((licenseExpression, index) => {
      const fileName = `./file-${index + 1}.txt`;
      return [
        `FileName: ${fileName}`,
        `SPDXID: SPDXRef-File-${index + 1}`,
        "FileChecksum: SHA1: 0000000000000000000000000000000000000000",
        `LicenseInfoInFile: ${licenseExpression}`,
        "FileCopyrightText: NONE",
        "",
      ].join("\n");
    })
    .join("\n");

  writeFileSync(
    path.join(binDir, "reuse"),
    `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "spdx" ] && [ "$2" = "-o" ]; then
  cat <<'EOF' > "$3"
SPDXVersion: SPDX-2.3
DataLicense: CC0-1.0
SPDXID: SPDXRef-DOCUMENT
DocumentName: mock

${reuseSpdx}EOF
  exit 0
fi
echo "unexpected reuse invocation: $*" >&2
exit 1
`,
    "utf8"
  );
  spawnSync("chmod", ["+x", path.join(binDir, "reuse")], { encoding: "utf8" });

  return binDir;
}

function runCheck(tempDir: string, licenseExpressions: string[]) {
  const binDir = installMockReuse(tempDir, licenseExpressions);
  const result = spawnSync("bash", ["scripts/check-license-compatibility.sh"], {
    cwd: tempDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
  });

  expect(result.error).toBeUndefined();
  return result;
}

describe("check-license-compatibility", () => {
  it("accepts AGPL files with the SecPal attribution term", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-license-check-"));

    try {
      mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
      writeFileSync(
        path.join(tempDir, "scripts", "check-license-compatibility.sh"),
        readFileSync(
          path.join(repoRoot, "scripts", "check-license-compatibility.sh"),
          "utf8"
        )
      );

      const result = runCheck(tempDir, [
        "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
        "CC0-1.0",
        "MIT",
      ]);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "All licenses are compatible with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects the SecPal attribution term without AGPL", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-license-check-"));

    try {
      mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
      writeFileSync(
        path.join(tempDir, "scripts", "check-license-compatibility.sh"),
        readFileSync(
          path.join(repoRoot, "scripts", "check-license-compatibility.sh"),
          "utf8"
        )
      );

      const result = runCheck(tempDir, ["LicenseRef-SecPal-Attribution"]);

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "LicenseRef-SecPal-Attribution must be paired with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects Tailwind Plus license markers in this repository", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-license-check-"));

    try {
      mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
      writeFileSync(
        path.join(tempDir, "scripts", "check-license-compatibility.sh"),
        readFileSync(
          path.join(repoRoot, "scripts", "check-license-compatibility.sh"),
          "utf8"
        )
      );

      const result = runCheck(tempDir, ["LicenseRef-TailwindPlus"]);

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "ERROR: Incompatible license found: LicenseRef-TailwindPlus"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
