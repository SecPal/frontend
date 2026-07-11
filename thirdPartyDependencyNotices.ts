// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

const noticeFilePattern = /^(copying|copyright|licen[cs]e|notice)([._-].*)?$/i;
const artifactName = "THIRD-PARTY-DEPENDENCY-NOTICES.md";
const noticeHeader =
  "# Third-Party Dependency Notices\n\nThis file is generated from the modules included in this release build. It preserves the license and notice files distributed with each bundled npm package.\n\n";

interface InstalledPackage {
  copyright?: string;
  directory: string;
  license?: string;
  name: string;
  version: string;
}

function packageDirectoryForModule(moduleId: string): string | null {
  const normalizedModuleId = moduleId.split("?")[0].replaceAll("\\", "/");
  const marker = "/node_modules/";
  const markerIndex = normalizedModuleId.lastIndexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const packagePathParts = normalizedModuleId
    .slice(markerIndex + marker.length)
    .split("/");
  const packagePartCount = packagePathParts[0].startsWith("@") ? 2 : 1;

  if (packagePathParts.length < packagePartCount) {
    return null;
  }

  return path.join(
    normalizedModuleId.slice(0, markerIndex + marker.length),
    ...packagePathParts.slice(0, packagePartCount)
  );
}

function installedPackageForModule(moduleId: string): InstalledPackage | null {
  const directory = packageDirectoryForModule(moduleId);

  if (!directory) {
    return null;
  }

  const packageJson = JSON.parse(
    readFileSync(path.join(directory, "package.json"), "utf8")
  ) as Record<string, unknown>;

  const name = optionalString(packageJson.name);
  const version = optionalString(packageJson.version);

  if (!name || !version) {
    throw new Error(`Bundled package at ${directory} lacks a name or version.`);
  }

  return {
    copyright:
      optionalString(packageJson.copyright) ??
      optionalString(packageJson.author),
    directory,
    license: optionalString(packageJson.license),
    name,
    version,
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPackageNoticeFiles(packageData: InstalledPackage): string {
  const noticeFiles = readdirSync(packageData.directory)
    .filter((fileName) => noticeFilePattern.test(fileName))
    .sort();

  if (noticeFiles.length === 0 && !packageData.license) {
    throw new Error(
      `Bundled package ${packageData.name}@${packageData.version} does not include a license declaration or notice file.`
    );
  }

  if (noticeFiles.length === 0) {
    const fallbackLicensePath = path.join(
      process.cwd(),
      "LICENSES",
      `${packageData.license}.txt`
    );

    try {
      return `The npm package does not include a standalone notice file. Its package metadata declares ${packageData.license}.${packageData.copyright ? `\n\nCopyright/author metadata: ${packageData.copyright}` : ""}\n\n### ${packageData.license}\n\n\`\`\`text\n${readFileSync(fallbackLicensePath, "utf8").trimEnd()}\n\`\`\``;
    } catch {
      throw new Error(
        `Bundled package ${packageData.name}@${packageData.version} declares ${packageData.license} but its canonical license text is unavailable at ${fallbackLicensePath}.`
      );
    }
  }

  return noticeFiles
    .map(
      (fileName) =>
        `### ${fileName}\n\n\`\`\`text\n${readFileSync(
          path.join(packageData.directory, fileName),
          "utf8"
        ).trimEnd()}\n\`\`\``
    )
    .join("\n\n");
}

export function createThirdPartyDependencyNotice(
  moduleIds: Iterable<string>
): string {
  const bundledPackages = new Map<string, InstalledPackage>();

  for (const moduleId of moduleIds) {
    const packageData = installedPackageForModule(moduleId);

    if (packageData) {
      bundledPackages.set(packageData.directory, packageData);
    }
  }

  const entries = [...bundledPackages.values()]
    .sort((left, right) => {
      const leftIdentifier = `${left.name}@${left.version}`;
      const rightIdentifier = `${right.name}@${right.version}`;
      return leftIdentifier < rightIdentifier
        ? -1
        : leftIdentifier > rightIdentifier
          ? 1
          : 0;
    })
    .map(
      (packageData) =>
        `## ${packageData.name}@${packageData.version}\n\n${readPackageNoticeFiles(packageData)}`
    );

  return `${noticeHeader}${entries.join("\n\n")}\n`;
}

function noticeSections(notice: string): readonly [string, string][] {
  if (!notice.startsWith(noticeHeader)) {
    throw new Error("Dependency notice has an unexpected header.");
  }

  const sections: Array<[string, string]> = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];
  let fenceMarker: "```" | "~~~" | null = null;

  const finishSection = () => {
    if (currentHeading) {
      sections.push([currentHeading, currentLines.join("\n").trimEnd()]);
    }
  };

  for (const line of notice.slice(noticeHeader.length).trim().split("\n")) {
    const trimmedLine = line.trimStart();
    const nextFenceMarker = trimmedLine.startsWith("```")
      ? "```"
      : trimmedLine.startsWith("~~~")
        ? "~~~"
        : null;

    if (!fenceMarker && line.startsWith("## ")) {
      finishSection();
      currentHeading = line;
      currentLines = [line];
      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    } else if (line.trim()) {
      throw new Error("Dependency notice contains content before a package.");
    }

    if (nextFenceMarker === fenceMarker) {
      fenceMarker = null;
    } else if (!fenceMarker && nextFenceMarker) {
      fenceMarker = nextFenceMarker;
    }
  }

  if (fenceMarker) {
    throw new Error("Dependency notice contains an unclosed fenced block.");
  }

  finishSection();
  return sections;
}

export function mergeThirdPartyDependencyNotices(
  existingNotice: string,
  generatedNotice: string
): string {
  const sections = new Map<string, string>();

  for (const notice of [existingNotice, generatedNotice]) {
    for (const [heading, section] of noticeSections(notice)) {
      sections.set(heading, section);
    }
  }

  return `${noticeHeader}${[...sections.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, section]) => section)
    .join("\n\n")}\n`;
}

export function thirdPartyDependencyNotices({
  mergeExistingArtifact = false,
}: { mergeExistingArtifact?: boolean } = {}): Plugin {
  const bundledModuleIds = new Set<string>();
  const requireFromProject = createRequire(
    path.join(process.cwd(), "package.json")
  );
  const addResolvedPackage = (source: string) => {
    if (source.startsWith(".") || source.startsWith("/")) {
      return;
    }

    try {
      bundledModuleIds.add(requireFromProject.resolve(source));
    } catch {
      // Vite resolves aliases and virtual modules that are not npm packages.
    }
  };

  return {
    name: "secpal-third-party-dependency-notices",
    buildStart() {
      for (const relativePath of readdirSync(path.join(process.cwd(), "src"), {
        recursive: true,
      })) {
        if (!relativePath.endsWith(".css")) {
          continue;
        }

        const stylesheet = readFileSync(
          path.join(process.cwd(), "src", relativePath),
          "utf8"
        );

        for (const match of stylesheet.matchAll(
          /@import\s+(?:url\(\s*)?["']([^"']+)["']/g
        )) {
          addResolvedPackage(match[1]);
        }
      }
    },
    generateBundle(outputOptions, bundle) {
      for (const moduleId of this.getModuleIds()) {
        bundledModuleIds.add(moduleId);
      }

      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") {
          for (const moduleId of Object.keys(output.modules)) {
            bundledModuleIds.add(moduleId);
          }
        }
      }
      const artifactPath = path.join(
        outputOptions.dir ?? process.cwd(),
        artifactName
      );
      const generatedNotice =
        createThirdPartyDependencyNotice(bundledModuleIds);

      this.emitFile({
        fileName: artifactName,
        source:
          mergeExistingArtifact && existsSync(artifactPath)
            ? mergeThirdPartyDependencyNotices(
                readFileSync(artifactPath, "utf8"),
                generatedNotice
              )
            : generatedNotice,
        type: "asset",
      });
    },
  };
}
