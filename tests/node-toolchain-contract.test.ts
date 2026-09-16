// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
    dockerfile: readRepoFile("Dockerfile"),
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

function fixtureSources(version = "24.21.0"): NodeToolchainSources {
  const major = version.split(".")[0];

  return {
    packageJson: JSON.stringify({
      engines: { node: `^${version}` },
      devDependencies: { "@types/node": `^${major}.1.0` },
    }),
    packageLock: JSON.stringify({
      packages: {
        "node_modules/ini": { engines: { node: ">=22.0.0" } },
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
      node-version: "^24.21.0"
`;

    expect(validateNodeToolchainContract(sources)).toEqual([]);
  });

  it("accepts a consistently qualified patch change without validator literals", () => {
    expect(validateNodeToolchainContract(fixtureSources("24.22.1"))).toEqual(
      []
    );
  });

  it("accepts workflow ordering changes", () => {
    const sources = fixtureSources();
    const quality = sources.workflows[".github/workflows/quality.yml"];
    const container =
      sources.workflows[".github/workflows/frontend-container.yml"];

    sources.workflows = {
      ".github/workflows/frontend-container.yml": container ?? "",
      ".github/workflows/quality.yml": quality ?? "",
      ".github/workflows/publish-container.yml":
        sources.workflows[".github/workflows/publish-container.yml"] ?? "",
    };

    expect(validateNodeToolchainContract(sources)).toEqual([]);
  });

  it.each([
    {
      name: "a Node job has no selector",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(sources, '          node-version: "^24.21.0"\n', ""),
      error: "actions/setup-node requires an explicit node-version",
    },
    {
      name: "a workflow selects Node 22",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/quality.yml"] =
          sources.workflows[".github/workflows/quality.yml"]?.replace(
            'node-version: "^24.21.0"',
            'node-version: "22"'
          ) ?? "";
        return sources;
      },
      error: "node-version 22 is incompatible",
    },
    {
      name: "a selector predates the engine baseline",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(
          sources,
          'node-version: "^24.21.0"',
          'node-version: "^24.20.0"'
        ),
      error: "node-version ^24.20.0 is incompatible",
    },
    {
      name: "@types/node uses another runtime major",
      mutate: (sources: NodeToolchainSources) =>
        replaceAllSources(
          sources,
          '"@types/node":"^24.1.0"',
          '"@types/node":"^25.1.0"'
        ),
      error: "@types/node major must equal the Node runtime major",
    },
    {
      name: "an exact container selector disagrees with the builder",
      mutate: (sources: NodeToolchainSources) => {
        sources.workflows[".github/workflows/frontend-container.yml"] =
          sources.workflows[
            ".github/workflows/frontend-container.yml"
          ]?.replace('node-version: "24.21.0"', 'node-version: "24.22.0"') ??
          "";
        return sources;
      },
      error: "exact node-version must equal the Docker builder",
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
