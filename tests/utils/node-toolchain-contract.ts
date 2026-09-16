// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { load } from "js-yaml";

interface NodeToolchainSources {
  packageJson: string;
  packageLock: string;
  nvmrc: string;
  dockerfile: string;
  workflows: Record<string, string>;
  readme: string;
  contributing: string;
}

interface Version {
  major: number;
  minor: number;
  patch: number;
}

interface QualifiedNodeRange {
  source: string;
  minimum: Version;
}

interface DockerBuilder {
  version: Version;
  digest: string | undefined;
}

const exactReleaseWorkflowPaths = new Set([
  ".github/workflows/frontend-container.yml",
  ".github/workflows/publish-container.yml",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function versionToString(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function parseVersion(source: string): Version | undefined {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/u.exec(source);

  if (!match?.groups) {
    return undefined;
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
  };
}

function compareVersions(left: Version, right: Version): number {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

function parseQualifiedNodeRange(
  source: unknown
): QualifiedNodeRange | undefined {
  if (typeof source !== "string") {
    return undefined;
  }

  const match = /^\^(?<version>\d+\.\d+\.\d+)$/u.exec(source);
  const minimum = match?.groups?.version
    ? parseVersion(match.groups.version)
    : undefined;

  return minimum ? { source, minimum } : undefined;
}

function versionSatisfiesQualifiedRange(
  version: Version,
  range: QualifiedNodeRange
): boolean {
  return (
    version.major === range.minimum.major &&
    compareVersions(version, range.minimum) >= 0
  );
}

function selectorSatisfiesQualifiedRange(
  selector: string,
  range: QualifiedNodeRange
): boolean {
  const majorSelector = /^(?<major>\d+)(?:\.x)?$/u.exec(selector);

  if (majorSelector?.groups) {
    return Number(majorSelector.groups.major) === range.minimum.major;
  }

  const versionSelector = /^(?<caret>\^)?(?<version>\d+\.\d+\.\d+)$/u.exec(
    selector
  );
  const version = versionSelector?.groups?.version
    ? parseVersion(versionSelector.groups.version)
    : undefined;

  return version ? versionSatisfiesQualifiedRange(version, range) : false;
}

function rangeIncludesVersion(source: string, version: Version): boolean {
  return source.split("||").some((candidate) => {
    const range = candidate.trim();
    const match = /^(?<operator>\^|>=)?(?<version>\d+\.\d+\.\d+)$/u.exec(range);
    const minimum = match?.groups?.version
      ? parseVersion(match.groups.version)
      : undefined;

    if (!minimum) {
      return false;
    }

    if (match.groups?.operator === ">=") {
      return compareVersions(version, minimum) >= 0;
    }

    if (match.groups?.operator === "^") {
      return (
        version.major === minimum.major &&
        compareVersions(version, minimum) >= 0
      );
    }

    return compareVersions(version, minimum) === 0;
  });
}

function getDeclaredMajor(source: unknown): number | undefined {
  if (typeof source !== "string") {
    return undefined;
  }

  const match = /^(?:\^|~)?(?<major>\d+)(?:\.\d+){0,2}$/u.exec(source);

  return match?.groups ? Number(match.groups.major) : undefined;
}

function getDockerBuilder(dockerfile: string): DockerBuilder | undefined {
  const matches = [
    ...dockerfile.matchAll(
      /^FROM\s+node:(?<version>\d+\.\d+\.\d+)-[^@\s]+(?:@sha256:(?<digest>[0-9a-f]+))?\s+AS\s+build\s*$/gimu
    ),
  ];

  if (matches.length !== 1 || !matches[0]?.groups?.version) {
    return undefined;
  }

  const version = parseVersion(matches[0].groups.version);

  return version ? { version, digest: matches[0].groups.digest } : undefined;
}

function reusableWorkflowRequiresNode(reference: string): boolean {
  return /SecPal\/\.github\/\.github\/workflows\/reusable-(?:ai-instructions|markdown-lint|node-[^/@]+|prettier)\.ya?ml@/u.test(
    reference
  );
}

function getNodeSelectors(
  workflowPath: string,
  workflowSource: string,
  errors: string[]
): string[] {
  let document: unknown;

  try {
    document = load(workflowSource);
  } catch {
    errors.push(`${workflowPath}: workflow YAML cannot be parsed`);
    return [];
  }

  if (!isRecord(document) || !isRecord(document.jobs)) {
    errors.push(`${workflowPath}: workflow jobs are missing`);
    return [];
  }

  const selectors: string[] = [];

  for (const [jobName, value] of Object.entries(document.jobs)) {
    if (!isRecord(value)) {
      continue;
    }

    if (typeof value.uses === "string") {
      if (!reusableWorkflowRequiresNode(value.uses)) {
        continue;
      }

      const selector = isRecord(value.with) ? value.with["node-version"] : null;

      if (typeof selector !== "string") {
        errors.push(
          `${workflowPath}:${jobName}: Node reusable workflow requires an explicit node-version`
        );
      } else {
        selectors.push(selector);
      }

      continue;
    }

    if (!Array.isArray(value.steps)) {
      continue;
    }

    let hasSelectedNodeVersion = false;

    for (const step of value.steps.filter(isRecord)) {
      const isSetupStep =
        typeof step.uses === "string" &&
        /^actions\/setup-node@/u.test(step.uses);

      if (isSetupStep) {
        const selector = isRecord(step.with) ? step.with["node-version"] : null;

        hasSelectedNodeVersion = typeof selector === "string";

        if (!hasSelectedNodeVersion) {
          errors.push(
            `${workflowPath}:${jobName}: actions/setup-node requires an explicit node-version`
          );
        } else {
          selectors.push(selector);
        }

        continue;
      }

      if (
        typeof step.run === "string" &&
        /\b(?:node|npm|npx|corepack)(?:\s|$)/mu.test(step.run) &&
        !hasSelectedNodeVersion
      ) {
        errors.push(
          `${workflowPath}:${jobName}: Node command runs before an explicit node-version is selected`
        );
      }
    }
  }

  return selectors;
}

export function validateNodeToolchainContract(
  sources: NodeToolchainSources
): string[] {
  const errors: string[] = [];
  let packageJson: unknown;
  let packageLock: unknown;

  try {
    packageJson = JSON.parse(sources.packageJson) as unknown;
    packageLock = JSON.parse(sources.packageLock) as unknown;
  } catch {
    return ["package.json and package-lock.json must contain valid JSON"];
  }

  const engineSource =
    isRecord(packageJson) && isRecord(packageJson.engines)
      ? packageJson.engines.node
      : undefined;
  const engine = parseQualifiedNodeRange(engineSource);

  if (!engine) {
    return ["package.json: engines.node must be one qualified caret range"];
  }

  const nodeTypesSource =
    isRecord(packageJson) && isRecord(packageJson.devDependencies)
      ? packageJson.devDependencies["@types/node"]
      : undefined;
  const nodeTypesMajor = getDeclaredMajor(nodeTypesSource);

  if (nodeTypesMajor !== engine.minimum.major) {
    errors.push(
      `package.json: @types/node major must equal the Node runtime major ${engine.minimum.major}`
    );
  }

  if (sources.nvmrc.trim() !== String(engine.minimum.major)) {
    errors.push(
      `.nvmrc: selected major must equal the Node runtime major ${engine.minimum.major}`
    );
  }

  const builder = getDockerBuilder(sources.dockerfile);

  if (!builder) {
    errors.push("Dockerfile: expected exactly one qualified Node build stage");
  } else {
    const builderVersion = versionToString(builder.version);

    if (builder.digest?.length !== 64) {
      errors.push("Dockerfile: Node builder must have a sha256 digest pin");
    }

    if (compareVersions(builder.version, engine.minimum) !== 0) {
      errors.push(
        `Dockerfile: Node builder ${builderVersion} must equal the qualified engine baseline ${versionToString(engine.minimum)}`
      );
    }
  }

  const markdownNodeRange =
    isRecord(packageLock) &&
    isRecord(packageLock.packages) &&
    isRecord(packageLock.packages["node_modules/ini"]) &&
    isRecord(packageLock.packages["node_modules/ini"].engines)
      ? packageLock.packages["node_modules/ini"].engines.node
      : undefined;

  if (
    typeof markdownNodeRange !== "string" ||
    !rangeIncludesVersion(markdownNodeRange, engine.minimum)
  ) {
    errors.push(
      "package-lock.json: Markdown toolchain must support the qualified Node baseline"
    );
  }

  if (!sources.readme.includes(`Node.js \`${engine.source}\``)) {
    errors.push("README.md: Node requirement must match package.json");
  }

  if (!sources.contributing.includes(`Node.js** \`${engine.source}\``)) {
    errors.push("CONTRIBUTING.md: Node requirement must match package.json");
  }

  for (const [workflowPath, workflowSource] of Object.entries(
    sources.workflows
  )) {
    for (const selector of getNodeSelectors(
      workflowPath,
      workflowSource,
      errors
    )) {
      if (!selectorSatisfiesQualifiedRange(selector, engine)) {
        errors.push(
          `${workflowPath}: node-version ${selector} is incompatible with ${engine.source}`
        );
      }

      if (
        exactReleaseWorkflowPaths.has(workflowPath) &&
        builder &&
        selector !== versionToString(builder.version)
      ) {
        errors.push(
          `${workflowPath}: exact node-version must equal the Docker builder ${versionToString(builder.version)}`
        );
      }
    }
  }

  return errors;
}

export type { NodeToolchainSources };
