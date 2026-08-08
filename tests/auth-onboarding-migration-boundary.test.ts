// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import ts from "typescript";
import { describe, expect, it } from "vitest";

interface ScopedSource {
  content: string;
  path: string;
}

const projectRoot = cwd();

const scopedEntries = [
  "src/ui",
  "src/pages/Auth",
  "src/pages/Login.tsx",
  "src/pages/LoginMfaDialog.tsx",
  "src/pages/Onboarding",
  "src/components/onboarding-layout.tsx",
  "src/components/auth-layout.tsx",
] as const;

const requiredCoveredPaths = [
  "src/ui/index.ts",
  "src/ui/primitives.tsx",
  "src/ui/styles.ts",
  "src/pages/Login.tsx",
  "src/pages/LoginMfaDialog.tsx",
  "src/pages/Onboarding/OnboardingComplete.tsx",
  "src/pages/Onboarding/OnboardingSubmitted.tsx",
  "src/pages/Onboarding/OnboardingWizard.tsx",
  "src/components/onboarding-layout.tsx",
  "src/components/auth-layout.tsx",
] as const;

// REUSE-IgnoreStart
const forbiddenHeadlessPackage = ["@headlessui", "react"].join("/");
const forbiddenTailwindPlusLicenseMarker = ["LicenseRef", "TailwindPlus"].join(
  "-"
);

const forbiddenTextMarkers = [
  forbiddenHeadlessPackage,
  forbiddenTailwindPlusLicenseMarker,
] as const;
// REUSE-IgnoreEnd

const oldComponentWrapperPaths = new Set([
  "src/components/alert",
  "src/components/auth-layout",
  "src/components/badge",
  "src/components/button",
  "src/components/checkbox",
  "src/components/combobox",
  "src/components/description-list",
  "src/components/dialog",
  "src/components/divider",
  "src/components/dropdown",
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

const routeLocalPrimitivePaths = new Set([
  "src/pages/Auth/ui",
  "src/pages/Auth/ui/index",
  "src/pages/Auth/ui/primitives",
  "src/pages/Auth/ui/utils",
  "src/pages/Onboarding/ui",
  "src/pages/Onboarding/ui/index",
  "src/pages/Onboarding/ui/primitives",
  "src/pages/Onboarding/ui/utils",
]);

function toProjectPath(filePath: string) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function listSourceFiles(entryPath: string): string[] {
  const absolutePath = path.resolve(projectRoot, entryPath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return /\.(?:ts|tsx)$/.test(absolutePath) ? [absolutePath] : [];
  }

  return readdirSync(absolutePath)
    .flatMap((entry) => listSourceFiles(path.join(entryPath, entry)))
    .sort();
}

function readScopedSources(): ScopedSource[] {
  return scopedEntries.flatMap((entry) =>
    listSourceFiles(entry).map((filePath) => ({
      content: readFileSync(filePath, "utf8"),
      path: toProjectPath(filePath),
    }))
  );
}

function getStaticModuleSpecifiers(source: ScopedSource): string[] {
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

function collectMigrationBoundaryViolations(sources: ScopedSource[]) {
  return sources.flatMap((source) => {
    const textViolations = forbiddenTextMarkers
      .filter((marker) => source.content.includes(marker))
      .map((marker) => `${source.path}: contains forbidden marker ${marker}`);

    const importViolations = getStaticModuleSpecifiers(source).flatMap(
      (moduleSpecifier) => {
        if (moduleSpecifier === forbiddenHeadlessPackage) {
          return [
            `${source.path}: imports forbidden package ${moduleSpecifier}`,
          ];
        }

        const resolvedImport = resolveProjectModulePath(
          source.path,
          moduleSpecifier
        );

        if (resolvedImport && oldComponentWrapperPaths.has(resolvedImport)) {
          return [
            `${source.path}: imports old component wrapper ${moduleSpecifier}`,
          ];
        }

        if (
          resolvedImport &&
          [...routeLocalPrimitivePaths].some(
            (primitivePath) =>
              resolvedImport === primitivePath ||
              resolvedImport.startsWith(`${primitivePath}/`)
          )
        ) {
          return [
            `${source.path}: imports route-local primitive barrel ${moduleSpecifier}`,
          ];
        }

        return [];
      }
    );

    return [...textViolations, ...importViolations];
  });
}

describe("auth/onboarding migration boundary", () => {
  it("covers the auth and onboarding route scope", () => {
    const coveredPaths = readScopedSources().map((source) => source.path);

    expect(coveredPaths).toEqual(
      expect.arrayContaining([...requiredCoveredPaths])
    );
  });

  it("detects forbidden packages, license markers, and old wrappers", () => {
    // REUSE-IgnoreStart
    const violations = collectMigrationBoundaryViolations([
      {
        path: "src/pages/Login.tsx",
        content: [
          "import { Button } from '../components/button';",
          `import { Dialog } from '${forbiddenHeadlessPackage}';`,
          `// SPDX-License-Identifier: ${forbiddenTailwindPlusLicenseMarker}`,
        ].join("\n"),
      },
      {
        path: "src/pages/Onboarding/OnboardingComplete.tsx",
        content: "export { Input } from '../../components/input';",
      },
      {
        path: "src/pages/LoginMfaDialog.tsx",
        content: "import { LoginDialog } from './Auth/ui';",
      },
    ]);

    expect(violations).toEqual([
      `src/pages/Login.tsx: contains forbidden marker ${forbiddenHeadlessPackage}`,
      `src/pages/Login.tsx: contains forbidden marker ${forbiddenTailwindPlusLicenseMarker}`,
      "src/pages/Login.tsx: imports old component wrapper ../components/button",
      `src/pages/Login.tsx: imports forbidden package ${forbiddenHeadlessPackage}`,
      "src/pages/Onboarding/OnboardingComplete.tsx: imports old component wrapper ../../components/input",
      "src/pages/LoginMfaDialog.tsx: imports route-local primitive barrel ./Auth/ui",
    ]);
    // REUSE-IgnoreEnd
  });

  it("keeps scoped auth and onboarding sources off legacy UI dependencies", () => {
    expect(collectMigrationBoundaryViolations(readScopedSources())).toEqual([]);
  });

  it("documents the shared UI migration boundary", () => {
    const guide = readFileSync(
      path.resolve(projectRoot, "src/ui/MIGRATION.md"),
      "utf8"
    );

    expect(guide).toContain("src/ui");
    expect(guide).toContain("Button");
    expect(guide).toContain("Dialog");
    expect(guide).toContain("Do not import old shared UI wrappers");
  });
});
