// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import ts from "typescript";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageLock {
  dependencies?: Record<string, unknown>;
  packages?: Record<string, unknown>;
}

interface SourceFile {
  content: string;
  path: string;
}

const projectRoot = cwd();

const forbiddenHeadlessPackage = ["@headlessui", "react"].join("/");
const forbiddenHeroiconsPackage = ["@heroicons", "react"].join("/");
const forbiddenTailwindPlusLicenseMarker = ["LicenseRef", "TailwindPlus"].join(
  "-"
);
const forbiddenAuthUiLitePath = "pages/Auth/ui-lite";

const forbiddenSourceMarkers = [
  forbiddenHeadlessPackage,
  forbiddenHeroiconsPackage,
  forbiddenTailwindPlusLicenseMarker,
  "<svg",
  forbiddenAuthUiLitePath,
] as const;

const productionSourceEntries = [
  "src",
  "vite.config.ts",
  "README.md",
  "REUSE.toml",
] as const;

const oldComponentWrapperPaths = new Set([
  "src/components/alert",
  "src/components/badge",
  "src/components/button",
  "src/components/checkbox",
  "src/components/combobox",
  "src/components/description-list",
  "src/components/dropdown",
  "src/components/dialog",
  "src/components/divider",
  "src/components/fieldset",
  "src/components/heading",
  "src/components/input",
  "src/components/link",
  "src/components/listbox",
  "src/components/navbar",
  "src/components/pagination",
  "src/components/radio",
  "src/components/select",
  "src/components/sidebar",
  "src/components/spinner",
  "src/components/switch",
  "src/components/table",
  "src/components/text",
  "src/components/textarea",
]);

function toProjectPath(filePath: string) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function isProductionSourceFile(filePath: string) {
  return (
    /\.(?:css|ts|tsx|md|toml)$/.test(filePath) &&
    !/(?:^|\/)(?:.*\.)?(?:test|spec)\.[tj]sx?$/.test(filePath) &&
    !filePath.endsWith(".test.ts") &&
    !filePath.endsWith(".test.tsx")
  );
}

function listFiles(entryPath: string): string[] {
  const absolutePath = path.resolve(projectRoot, entryPath);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return isProductionSourceFile(absolutePath) ? [absolutePath] : [];
  }

  return readdirSync(absolutePath)
    .flatMap((entry) => listFiles(path.join(entryPath, entry)))
    .sort();
}

function readProductionSources(): SourceFile[] {
  return productionSourceEntries.flatMap((entry) =>
    listFiles(entry).map((filePath) => ({
      content: readFileSync(filePath, "utf8"),
      path: toProjectPath(filePath),
    }))
  );
}

function collectSourceMarkerViolations(sources: SourceFile[]) {
  return sources.flatMap((source) =>
    forbiddenSourceMarkers
      .filter((marker) => source.content.includes(marker))
      .map((marker) => `${source.path}: contains legacy marker ${marker}`)
  );
}

function getStaticModuleSpecifiers(source: SourceFile): string[] {
  const sourceFile = ts.createSourceFile(
    source.path,
    source.content,
    ts.ScriptTarget.Latest,
    false,
    source.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  return sourceFile.statements.flatMap((statement) => {
    if (
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [statement.moduleSpecifier.text];
    }

    return [];
  });
}

function resolveProjectModulePath(sourcePath: string, moduleSpecifier: string) {
  if (moduleSpecifier.startsWith("@/")) {
    return `src/${moduleSpecifier.slice(2)}`.replace(/\.(?:ts|tsx)$/, "");
  }

  if (!moduleSpecifier.startsWith(".")) {
    return undefined;
  }

  const absoluteImportPath = path.resolve(
    projectRoot,
    path.dirname(sourcePath),
    moduleSpecifier
  );

  return toProjectPath(absoluteImportPath).replace(/\.(?:ts|tsx)$/, "");
}

function collectOldWrapperImportViolations(sources: SourceFile[]) {
  return sources.flatMap((source) => {
    const sourceModulePath = source.path.replace(/\.(?:ts|tsx)$/, "");

    if (oldComponentWrapperPaths.has(sourceModulePath)) {
      return [];
    }

    return getStaticModuleSpecifiers(source).flatMap((moduleSpecifier) => {
      const resolvedImport = resolveProjectModulePath(
        source.path,
        moduleSpecifier
      );

      if (resolvedImport && oldComponentWrapperPaths.has(resolvedImport)) {
        return [
          `${source.path}: imports old component wrapper ${moduleSpecifier}`,
        ];
      }

      return [];
    });
  });
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(path.resolve(projectRoot, filePath), "utf8"));
}

describe("legacy UI guardrails", () => {
  it("keeps production source and project metadata free of legacy UI markers", () => {
    expect(collectSourceMarkerViolations(readProductionSources())).toEqual([]);
    expect(
      existsSync(
        path.resolve(
          projectRoot,
          "LICENSES",
          `${forbiddenTailwindPlusLicenseMarker}.txt`
        )
      )
    ).toBe(false);
    expect(
      existsSync(path.resolve(projectRoot, "src/pages/Auth/ui-lite.tsx"))
    ).toBe(false);
  });

  it("prevents production code from importing old generic component wrappers", () => {
    expect(collectOldWrapperImportViolations(readProductionSources())).toEqual(
      []
    );
  });

  it("keeps legacy UI packages out of the manifest and lockfile", () => {
    const manifest = readJsonFile<PackageManifest>("package.json");
    const packageLock = readJsonFile<PackageLock>("package-lock.json");
    const dependencyNames = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ]);
    const lockfileNames = new Set([
      ...Object.keys(packageLock.dependencies ?? {}),
      ...Object.keys(packageLock.packages ?? {}).map((packagePath) =>
        packagePath.replace(/^node_modules\//, "")
      ),
    ]);

    for (const packageName of [
      forbiddenHeadlessPackage,
      forbiddenHeroiconsPackage,
    ]) {
      expect(dependencyNames.has(packageName), packageName).toBe(false);
      expect(lockfileNames.has(packageName), packageName).toBe(false);
    }
  });
});
