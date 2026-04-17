// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const issue874Files = [
  "src/components/MoveOrganizationalUnitDialog.tsx",
  "src/components/NotificationPreferences.tsx",
  "src/components/OrganizationalUnitFormDialog.tsx",
  "src/components/OrganizationalUnitTree.tsx",
  "src/components/ScopeAssignmentForm.tsx",
  "src/hooks/useNotifications.ts",
  "src/hooks/useServiceWorkerUpdate.ts",
  "src/pages/ActivityLog/ActivityDetailDialog.tsx",
  "src/pages/ActivityLog/ActivityLogList.tsx",
  "src/pages/AndroidProvisioning/AndroidProvisioningPage.tsx",
  "src/pages/Customers/CustomersPage.tsx",
  "src/pages/Employees/EmployeeDetail.tsx",
  "src/pages/Employees/EmployeeEdit.tsx",
  "src/pages/Employees/EmployeeList.tsx",
  "src/pages/Onboarding/OnboardingWizard.tsx",
  "src/pages/Settings/SettingsPage.tsx",
  "src/pages/Sites/SitesPage.tsx",
];

describe("Issue 874 lint regression", () => {
  it("has no react-hooks/set-state-in-effect violations in the tracked files", () => {
    const eslintBinary = path.join(repoRoot, "node_modules", ".bin", "eslint");
    const result = spawnSync(
      eslintBinary,
      [
        ...issue874Files,
        "--rule",
        "react-hooks/set-state-in-effect:error",
        "--format",
        "json",
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      }
    );

    expect(result.error).toBeUndefined();

    const output = result.stdout.trim();
    expect(output).not.toBe("");

    const report = JSON.parse(output) as Array<{
      filePath: string;
      messages: Array<{ ruleId: string | null; line: number; column: number }>;
    }>;

    const violations = report.flatMap((entry) =>
      entry.messages
        .filter((message) => message.ruleId === "react-hooks/set-state-in-effect")
        .map((message) => ({
          filePath: path.relative(repoRoot, entry.filePath),
          line: message.line,
          column: message.column,
        }))
    );

    expect(violations).toEqual([]);
  });
  });
