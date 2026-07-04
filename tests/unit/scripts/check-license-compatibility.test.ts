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

type MockReuseEntry = {
  fileName?: string;
  licenseExpressions: string[];
};

type TestRepositoryFixture = {
  reuseEntries: MockReuseEntry[];
  packageLockContents?: string;
};

function installMockReuse(tempDir: string, entries: MockReuseEntry[]) {
  const binDir = path.join(tempDir, "bin");
  mkdirSync(binDir, { recursive: true });

  const reuseSpdx = entries
    .map((entry, index) => {
      const fileName = entry.fileName ?? `./file-${index + 1}.txt`;
      return [
        `FileName: ${fileName}`,
        `SPDXID: SPDXRef-File-${index + 1}`,
        "FileChecksum: SHA1: 0000000000000000000000000000000000000000",
        ...entry.licenseExpressions.map(
          (licenseExpression) => `LicenseInfoInFile: ${licenseExpression}`
        ),
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

function setupTestRepository(
  tempDir: string,
  { packageLockContents }: TestRepositoryFixture
) {
  mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
  writeFileSync(
    path.join(tempDir, "scripts", "check-license-compatibility.sh"),
    readFileSync(
      path.join(repoRoot, "scripts", "check-license-compatibility.sh"),
      "utf8"
    )
  );

  if (packageLockContents !== undefined) {
    writeFileSync(path.join(tempDir, "package-lock.json"), packageLockContents);
  }
}

function runCheck(tempDir: string, fixture: TestRepositoryFixture) {
  setupTestRepository(tempDir, fixture);

  const binDir = installMockReuse(tempDir, fixture.reuseEntries);
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
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [
          {
            licenseExpressions: [
              "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
            ],
          },
          { licenseExpressions: ["CC0-1.0"] },
          { licenseExpressions: ["MIT"] },
        ],
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "All licenses are compatible with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects the SecPal attribution term without AGPL", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [{ licenseExpressions: ["LicenseRef-SecPal-Attribution"] }],
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "LicenseRef-SecPal-Attribution must be paired with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects OR expressions that leave the attribution term standalone", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [
          {
            licenseExpressions: [
              "AGPL-3.0-or-later OR LicenseRef-SecPal-Attribution",
            ],
          },
        ],
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "LicenseRef-SecPal-Attribution must be conjoined with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects Tailwind Plus license markers in this repository", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [{ licenseExpressions: ["LicenseRef-TailwindPlus"] }],
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "ERROR: Incompatible license found in ./file-1.txt: LicenseRef-TailwindPlus"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("accepts split REUSE license lines for one AGPL-covered file", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [
          {
            fileName: "./AGENTS.md",
            licenseExpressions: [
              "AGPL-3.0-or-later",
              "LicenseRef-SecPal-Attribution",
            ],
          },
        ],
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        "All licenses are compatible with AGPL-3.0-or-later"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects incompatible dependency licenses from package-lock.json", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-license-check-")
    );

    try {
      const result = runCheck(tempDir, {
        reuseEntries: [{ licenseExpressions: ["MIT"] }],
        packageLockContents: JSON.stringify(
          {
            name: "@secpal/frontend",
            lockfileVersion: 3,
            packages: {
              "": {
                license:
                  "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
              },
              "node_modules/bad-license-package": {
                license: "LicenseRef-Proprietary",
              },
            },
          },
          null,
          2
        ),
      });

      expect(result.status).toBe(1);
      expect(result.stdout + result.stderr).toContain(
        "ERROR: Incompatible license found in package-lock.json package node_modules/bad-license-package: LicenseRef-Proprietary"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
