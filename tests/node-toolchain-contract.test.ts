// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inc, minVersion } from "semver";
import {
  type NodeToolchainSources,
  validateNodeToolchainContract,
} from "./utils/node-toolchain-contract";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const baseline = minVersion(
  JSON.parse(readRepoFile("package.json")).engines.node
)!;
const patchUpdate = inc(baseline, "patch")!;
const minorUpdate = inc(baseline, "minor")!;
const nextMajor = inc(baseline, "major")!;
const previousMajor = String(baseline.major - 1);
const olderVersion = `${previousMajor}.0.0`;

function getRepositorySources(): NodeToolchainSources {
  const workflowPaths = execFileSync(
    "git",
    ["ls-files", ".github/workflows/*.yml", ".github/workflows/*.yaml"],
    { cwd: repoRoot, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  return {
    packageJson: readRepoFile("package.json"),
    packageLock: readRepoFile("package-lock.json"),
    nvmrc: readRepoFile(".nvmrc"),
    dockerfile: readRepoFile("Containerfile"),
    workflows: Object.fromEntries(
      workflowPaths.map((workflowPath) => [
        workflowPath,
        readRepoFile(workflowPath),
      ])
    ),
    readme: readRepoFile("README.md"),
    contributing: readRepoFile("CONTRIBUTING.md"),
  };
}

function fixtureSources(version = baseline.version): NodeToolchainSources {
  const major = version.split(".")[0];

  return {
    packageJson: JSON.stringify({
      engines: { node: `^${version}` },
      devDependencies: { "@types/node": `^${version}` },
    }),
    packageLock: JSON.stringify({
      packages: {
        "node_modules/ini": {
          engines: { node: `^${version}` },
        },
      },
    }),
    nvmrc: major ?? "",
    dockerfile: `FROM node:${version}-bookworm-slim@sha256:${"a".repeat(64)} AS build`,
    workflows: {
      ".github/workflows/quality.yml": `
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@0000000000000000000000000000000000000000
        with:
          node-version: "^${version}"
      - run: npm test
`,
      ".github/workflows/frontend-container.yml": `
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@0000000000000000000000000000000000000000
        with:
          node-version: "${version}"
      - run: npm test
`,
      ".github/workflows/publish-container.yml": `
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@0000000000000000000000000000000000000000
        with:
          node-version: "${version}"
      - run: npm test
`,
    },
    readme: `Requires Node.js \`^${version}\``,
    contributing: `Requires Node.js** \`^${version}\``,
  };
}

function replaceAllSources(
  sources: NodeToolchainSources,
  searchValue: string,
  replaceValue: string
): NodeToolchainSources {
  return {
    ...sources,
    packageJson: sources.packageJson.replaceAll(searchValue, replaceValue),
    packageLock: sources.packageLock.replaceAll(searchValue, replaceValue),
    nvmrc: sources.nvmrc.replaceAll(searchValue, replaceValue),
    dockerfile: sources.dockerfile.replaceAll(searchValue, replaceValue),
    workflows: Object.fromEntries(
      Object.entries(sources.workflows).map(([workflowPath, workflow]) => [
        workflowPath,
        workflow.replaceAll(searchValue, replaceValue),
      ])
    ),
    readme: sources.readme.replaceAll(searchValue, replaceValue),
    contributing: sources.contributing.replaceAll(searchValue, replaceValue),
  };
}

describe("Node toolchain contract", () => {
  it("keeps repository Node consumers aligned with canonical authorities", () => {
    expect(validateNodeToolchainContract(getRepositorySources())).toEqual([]);
  });

  it("accepts an additional correctly qualified Node job", () => {
    const sources = fixtureSources();
    sources.workflows[".github/workflows/quality.yml"] += `
  additional-check:
    uses: SecPal/.github/.github/workflows/reusable-node-build.yml@0000000000000000000000000000000000000000
    with:
      node-version: "^${baseline.version}"
`;

    expect(validateNodeToolchainContract(sources)).toEqual([]);
  });

  it("accepts a consistently qualified patch change without validator literals", () => {
    expect(validateNodeToolchainContract(fixtureSources(patchUpdate))).toEqual(
      []
    );
  });

  it.each([patchUpdate, minorUpdate])(
    "accepts a digest-pinned builder update to %s within the supported range",
    (version) => {
      const sources = fixtureSources();
      sources.dockerfile = fixtureSources(version).dockerfile.replace(
        "a".repeat(64),
        "b".repeat(64)
      );

      expect(validateNodeToolchainContract(sources)).toEqual([]);
    }
  );

  it("accepts compatible exact workflow versions independently of the builder", () => {
    const sources = fixtureSources();
    sources.workflows[".github/workflows/frontend-container.yml"] =
      fixtureSources(minorUpdate).workflows[
        ".github/workflows/frontend-container.yml"
      ]!;

    expect(validateNodeToolchainContract(sources)).toEqual([]);
  });

  it.each([olderVersion, nextMajor])(
    "rejects a builder version %s outside the supported range",
    (version) => {
      const sources = fixtureSources();
      sources.dockerfile = fixtureSources(version).dockerfile;

      expect(validateNodeToolchainContract(sources)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Node builder " + version + " is incompatible"
          ),
        ])
      );
    }
  );

  it("accepts workflow ordering changes", () => {
    const directJob = `
  direct:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@0000000000000000000000000000000000000000
        with:
          node-version: "^${baseline.version}"
      - run: npm test
`;
    const reusableJob = `
  reusable:
    uses: SecPal/.github/.github/workflows/reusable-node-build.yml@0000000000000000000000000000000000000000
    with:
      node-version: "^${baseline.version}"
`;

    for (const jobs of [directJob + reusableJob, reusableJob + directJob]) {
      const sources = fixtureSources();
      sources.workflows[".github/workflows/quality.yml"] = `jobs:${jobs}`;

      expect(validateNodeToolchainContract(sources)).toEqual([]);
    }
  });

  it("requires workflow selectors to respect the qualified minimum", () => {
    const sources = fixtureSources(patchUpdate);
    sources.workflows[".github/workflows/quality.yml"] = sources.workflows[
      ".github/workflows/quality.yml"
    ]!.replace(
      `node-version: "^${patchUpdate}"`,
      `node-version: "${baseline.major}"`
    );

    expect(validateNodeToolchainContract(sources)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `node-version ${baseline.major} is incompatible`
        ),
      ])
    );
  });

  it.each([
    {
      name: "a Node job has no selector",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(
          sources,
          `          node-version: "^${baseline.version}"\n`,
          ""
        ),
      error: "actions/setup-node requires an explicit node-version",
    },
    {
      name: "a Node command runs before setup-node",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/quality.yml"] =
          sources.workflows[".github/workflows/quality.yml"]?.replace(
            "    steps:\n",
            "    steps:\n      - run: npm test\n"
          ) ?? "";
        return sources;
      },
      error: "Node command runs before an explicit node-version is selected",
    },
    {
      name: "a supported package manager runs without setup-node",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/package-manager.yml"] = `
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test
`;
        return sources;
      },
      error: "Node command runs before an explicit node-version is selected",
    },
    {
      name: "a reusable Node job has no selector",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/quality.yml"] += `
  missing-selector:
    uses: SecPal/.github/.github/workflows/reusable-node-build.yml@0000000000000000000000000000000000000000
`;
        return sources;
      },
      error: "Node reusable workflow requires an explicit node-version",
    },
    {
      name: "a workflow selects an unsupported Node major",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/quality.yml"] =
          sources.workflows[".github/workflows/quality.yml"]?.replace(
            `node-version: "^${baseline.version}"`,
            `node-version: "${previousMajor}"`
          ) ?? "";
        return sources;
      },
      error: `node-version ${previousMajor} is incompatible`,
    },
    {
      name: "a selector predates the engine baseline",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(
          sources,
          `node-version: "^${baseline.version}"`,
          `node-version: "^${olderVersion}"`
        ),
      error: `node-version ^${olderVersion} is incompatible`,
    },
    {
      name: "@types/node uses another runtime major",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(
          sources,
          `"@types/node":"^${baseline.version}"`,
          `"@types/node":"^${nextMajor}"`
        ),
      error: "@types/node major must equal the Node runtime major",
    },
    {
      name: "an exact container selector predates the engine baseline",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/frontend-container.yml"] =
          sources.workflows[
            ".github/workflows/frontend-container.yml"
          ]?.replace(
            `node-version: "${baseline.version}"`,
            `node-version: "${olderVersion}"`
          ) ?? "";
        return sources;
      },
      error: `node-version ${olderVersion} is incompatible`,
    },
    {
      name: "the Docker builder loses its digest",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(sources, `@sha256:${"a".repeat(64)}`, ""),
      error: "Node builder must have a sha256 digest pin",
    },
  ])("rejects when $name", ({ mutate, error }) => {
    expect(validateNodeToolchainContract(mutate(fixtureSources()))).toEqual(
      expect.arrayContaining([expect.stringContaining(error)])
    );
  });
});
