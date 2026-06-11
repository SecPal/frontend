// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync, statSync } from "node:fs";
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
  "src/pages/Auth",
  "src/pages/Login.tsx",
  "src/pages/Onboarding",
  "src/components/onboarding-layout.tsx",
  "src/components/auth-layout.tsx",
] as const;

const requiredCoveredPaths = [
  "src/pages/Auth/ui/index.ts",
  "src/pages/Login.tsx",
  "src/pages/Onboarding/OnboardingComplete.tsx",
  "src/pages/Onboarding/OnboardingWizard.tsx",
  "src/components/onboarding-layout.tsx",
  "src/components/auth-layout.tsx",
] as const;

// REUSE-IgnoreStart
const forbiddenTextMarkers = [
  "@headlessui/react",
  "LicenseRef-TailwindPlus",
] as const;
// REUSE-IgnoreEnd

const oldComponentWrapperPaths = new Set([
  "src/components/alert",
  "src/components/auth-layout",
  "src/components/avatar",
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

function toProjectPath(filePath: string) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

function listSourceFiles(entryPath: string): string[] {
  const absolutePath = path.resolve(projectRoot, entryPath);
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
        if (moduleSpecifier === "@headlessui/react") {
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
          "import { Dialog } from '@headlessui/react';",
          "// SPDX-License-Identifier: LicenseRef-TailwindPlus",
        ].join("\n"),
      },
      {
        path: "src/pages/Onboarding/OnboardingComplete.tsx",
        content: "export { Input } from '../../components/input';",
      },
    ]);

    expect(violations).toEqual([
      "src/pages/Login.tsx: contains forbidden marker @headlessui/react",
      "src/pages/Login.tsx: contains forbidden marker LicenseRef-TailwindPlus",
      "src/pages/Login.tsx: imports old component wrapper ../components/button",
      "src/pages/Login.tsx: imports forbidden package @headlessui/react",
      "src/pages/Onboarding/OnboardingComplete.tsx: imports old component wrapper ../../components/input",
    ]);
    // REUSE-IgnoreEnd
  });

  it("keeps scoped auth and onboarding sources off legacy UI dependencies", () => {
    expect(collectMigrationBoundaryViolations(readScopedSources())).toEqual([]);
  });
});
