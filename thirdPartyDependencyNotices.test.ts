// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createThirdPartyDependencyNotice,
  mergeThirdPartyDependencyNotices,
} from "./thirdPartyDependencyNotices";

const header =
  "# Third-Party Dependency Notices\n\nThis file is generated from the modules included in this release build. It preserves the license and notice files distributed with each bundled npm package.\n\n";
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createPackage(
  root: string,
  name: string,
  version: string,
  licenseText?: string,
  author?: unknown
): string {
  const directory = path.join(root, "node_modules", ...name.split("/"));
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ author, license: "MIT", name, version })
  );
  if (licenseText) {
    writeFileSync(path.join(directory, "LICENSE.md"), licenseText);
  }
  return directory;
}

describe("createThirdPartyDependencyNotice", () => {
  it("deduplicates and sorts scoped and unscoped packages deterministically", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "dependency-notices-"));
    temporaryDirectories.push(root);
    const zebraDirectory = createPackage(root, "zebra", "2.0.0", "Zebra terms");
    const alphaDirectory = createPackage(
      root,
      "@example/alpha",
      "1.0.0",
      "Alpha terms"
    );

    const notice = createThirdPartyDependencyNotice([
      `${zebraDirectory}/index.js`,
      `${alphaDirectory}/index.js?commonjs-proxy`,
      `${zebraDirectory}/other.js`,
    ]);

    expect(notice.match(/^## /gm)).toHaveLength(2);
    expect(notice.indexOf("## @example/alpha@1.0.0")).toBeLessThan(
      notice.indexOf("## zebra@2.0.0")
    );
    expect(notice).toContain("Alpha terms");
    expect(notice).toContain("Zebra terms");
  });

  it("normalizes Windows module paths and does not stringify object metadata", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "dependency-notices-"));
    temporaryDirectories.push(root);
    const packageDirectory = createPackage(
      root,
      "metadata-package",
      "1.0.0",
      undefined,
      { name: "Example Author" }
    );

    const notice = createThirdPartyDependencyNotice([
      `${packageDirectory.replaceAll("/", "\\")}\\index.js`,
    ]);

    expect(notice).toContain("## metadata-package@1.0.0");
    expect(notice).not.toContain("[object Object]");
  });

  it("rejects packages whose non-string metadata cannot provide a license", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "dependency-notices-"));
    temporaryDirectories.push(root);
    const packageDirectory = createPackage(
      root,
      "invalid-metadata-package",
      "1.0.0"
    );
    writeFileSync(
      path.join(packageDirectory, "package.json"),
      JSON.stringify({ license: { type: "MIT" }, name: [], version: {} })
    );

    expect(() =>
      createThirdPartyDependencyNotice([`${packageDirectory}/index.js`])
    ).toThrow("lacks a name or version");
  });

  it("uses a longer fence when a license notice contains backticks", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "dependency-notices-"));
    temporaryDirectories.push(root);
    const packageDirectory = createPackage(
      root,
      "fenced-license-package",
      "1.0.0",
      "```\nLicense text inside an upstream fence.\n```"
    );

    const notice = createThirdPartyDependencyNotice([
      `${packageDirectory}/index.js`,
    ]);

    expect(notice).toContain(
      "````text\n```\nLicense text inside an upstream fence.\n```\n````"
    );
  });
});

describe("mergeThirdPartyDependencyNotices", () => {
  it("preserves level-two headings embedded in fenced license text", () => {
    const existingNotice = `${header}## example-license@1.0.0\n\n### LICENSE\n\n\`\`\`text\nTerms before heading.\n\n## This is license text, not a package\n\nTerms after heading.\n\`\`\`\n`;
    const generatedNotice = `${header}## workbox-core@7.4.0\n\n### LICENSE\n\n\`\`\`text\nWorkbox terms.\n\`\`\`\n`;

    const mergedNotice = mergeThirdPartyDependencyNotices(
      existingNotice,
      generatedNotice
    );

    expect(mergedNotice).toContain(
      "## This is license text, not a package\n\nTerms after heading."
    );
    expect(mergedNotice.match(/^## /gm)).toHaveLength(3);
    expect(mergedNotice.indexOf("## example-license@1.0.0")).toBeLessThan(
      mergedNotice.indexOf("## workbox-core@7.4.0")
    );
  });

  it("keeps nested upstream fences inside the generated outer fence", () => {
    const existingNotice = `${header}## fenced-license@1.0.0\n\n### LICENSE\n\n\`\`\`\`text\n\`\`\`\n## License heading\n\`\`\`\n\`\`\`\`\n`;
    const generatedNotice = `${header}## workbox-core@7.4.0\n\n### LICENSE\n\n\`\`\`text\nWorkbox terms.\n\`\`\`\n`;

    expect(() =>
      mergeThirdPartyDependencyNotices(existingNotice, generatedNotice)
    ).not.toThrow();
  });

  it("rejects malformed or truncated generated artifacts", () => {
    expect(() =>
      mergeThirdPartyDependencyNotices("unexpected", `${header}`)
    ).toThrow("unexpected header");
    expect(() =>
      mergeThirdPartyDependencyNotices(
        `${header}## package@1.0.0\n\n\`\`\`text\nunclosed\n`,
        `${header}`
      )
    ).toThrow("unclosed fenced block");
  });
});
