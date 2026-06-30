// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
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
  "src/pages/Settings/SettingsPage.tsx",
  "src/pages/Profile/ProfilePage.tsx",
  "src/pages/Organization/OrganizationPage.tsx",
  "src/pages/Customers/CustomersPage.tsx",
  "src/pages/Customers/CustomerCreate.tsx",
  "src/pages/Customers/CustomerEdit.tsx",
  "src/pages/Customers/CustomerDetail.tsx",
  "src/pages/Sites/SitesPage.tsx",
  "src/pages/Sites/SiteCreate.tsx",
  "src/pages/Sites/SiteEdit.tsx",
  "src/pages/Sites/SiteDetail.tsx",
  "src/pages/Employees/EmployeeList.tsx",
  "src/pages/Employees/EmployeeDetail.tsx",
  "src/pages/Employees/EmployeeBwrPanel.tsx",
  "src/pages/Employees/EmployeeCreate.tsx",
  "src/pages/Employees/EmployeeEdit.tsx",
  "src/pages/Employees/EmployeeContactsEdit.tsx",
  "src/pages/Employees/EmployeeAddressFields.tsx",
  "src/pages/Employees/EmployeeStatusOptions.tsx",
  "src/pages/ActivityLog/ActivityLogList.tsx",
  "src/pages/ActivityLog/ActivityDetailDialog.tsx",
  "src/pages/AndroidProvisioning/AndroidProvisioningPage.tsx",
  "src/components/OrganizationalUnitTree.tsx",
  "src/components/OrganizationalUnitFormDialog.tsx",
  "src/components/MoveOrganizationalUnitDialog.tsx",
  "src/components/DeleteOrganizationalUnitDialog.tsx",
  "src/components/ScopeAssignmentForm.tsx",
  "src/components/OrganizationalUnitPicker.tsx",
  "src/components/MfaQrCode.tsx",
] as const;

// REUSE-IgnoreStart
const forbiddenHeadlessPackage = ["@headlessui", "react"].join("/");
const forbiddenHeroiconsPackage = ["@heroicons", "react"].join("/");
const forbiddenTailwindPlusLicenseMarker = ["LicenseRef", "TailwindPlus"].join(
  "-"
);

const forbiddenTextMarkers = [
  forbiddenHeadlessPackage,
  forbiddenHeroiconsPackage,
  forbiddenTailwindPlusLicenseMarker,
  "<svg",
] as const;
// REUSE-IgnoreEnd

const oldComponentWrapperPaths = new Set([
  "src/components/alert",
  "src/components/badge",
  "src/components/button",
  "src/components/checkbox",
  "src/components/description-list",
  "src/components/dialog",
  "src/components/divider",
  "src/components/fieldset",
  "src/components/heading",
  "src/components/input",
  "src/components/link",
  "src/components/pagination",
  "src/components/radio",
  "src/components/select",
  "src/components/spinner",
  "src/components/switch",
  "src/components/table",
  "src/components/text",
  "src/components/textarea",
]);

const oldPageUiLayerPaths = new Set([
  "src/pages/CustomerSites/ui",
  "src/pages/Employees/ui",
]);

function readScopedSources(): ScopedSource[] {
  return scopedEntries.map((entry) => ({
    content: readFileSync(path.resolve(projectRoot, entry), "utf8"),
    path: entry,
  }));
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

  return path
    .relative(projectRoot, absoluteImportPath)
    .replaceAll(path.sep, "/")
    .replace(/\.(?:ts|tsx)$/, "");
}

function collectAdminMigrationViolations(sources: ScopedSource[]) {
  return sources.flatMap((source) => {
    const textViolations = forbiddenTextMarkers
      .filter((marker) => source.content.includes(marker))
      .map((marker) => `${source.path}: contains forbidden marker ${marker}`);

    const importViolations = getStaticModuleSpecifiers(source).flatMap(
      (moduleSpecifier) => {
        if (
          moduleSpecifier === forbiddenHeadlessPackage ||
          moduleSpecifier.startsWith(forbiddenHeroiconsPackage)
        ) {
          return [
            `${source.path}: imports forbidden package ${moduleSpecifier}`,
          ];
        }

        const resolvedImport = resolveProjectModulePath(
          source.path,
          moduleSpecifier
        );

        if (
          resolvedImport &&
          (oldComponentWrapperPaths.has(resolvedImport) ||
            oldPageUiLayerPaths.has(resolvedImport))
        ) {
          return [
            `${source.path}: imports old UI compatibility layer ${moduleSpecifier}`,
          ];
        }

        return [];
      }
    );

    return [...textViolations, ...importViolations];
  });
}

describe("admin migration boundary", () => {
  it("covers migrated admin, customer, site, employee, activity, provisioning, and organization sources", () => {
    expect(readScopedSources().map((source) => source.path)).toEqual([
      ...scopedEntries,
    ]);
  });

  it("detects forbidden admin UI regressions", () => {
    // REUSE-IgnoreStart
    const violations = collectAdminMigrationViolations([
      {
        path: "src/pages/Settings/SettingsPage.tsx",
        content: [
          "import { Button } from '../../components/button';",
          `import { Dialog } from '${forbiddenHeadlessPackage}';`,
          `import { XMarkIcon } from '${forbiddenHeroiconsPackage}/24/outline';`,
          "<svg viewBox='0 0 24 24' />",
          `// SPDX-License-Identifier: ${forbiddenTailwindPlusLicenseMarker}`,
        ].join("\n"),
      },
    ]);

    expect(violations).toEqual([
      `src/pages/Settings/SettingsPage.tsx: contains forbidden marker ${forbiddenHeadlessPackage}`,
      `src/pages/Settings/SettingsPage.tsx: contains forbidden marker ${forbiddenHeroiconsPackage}`,
      `src/pages/Settings/SettingsPage.tsx: contains forbidden marker ${forbiddenTailwindPlusLicenseMarker}`,
      "src/pages/Settings/SettingsPage.tsx: contains forbidden marker <svg",
      "src/pages/Settings/SettingsPage.tsx: imports old UI compatibility layer ../../components/button",
      `src/pages/Settings/SettingsPage.tsx: imports forbidden package ${forbiddenHeadlessPackage}`,
      `src/pages/Settings/SettingsPage.tsx: imports forbidden package ${forbiddenHeroiconsPackage}/24/outline`,
    ]);
    // REUSE-IgnoreEnd
  });

  it("keeps scoped admin and employee sources on the shadcn/radix UI layer", () => {
    expect(collectAdminMigrationViolations(readScopedSources())).toEqual([]);
  });
});
