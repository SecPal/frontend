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

const ISSUE_874_FILE_BATCH_SIZE = 4;
const ISSUE_874_BATCH_TIMEOUT_MS = 30_000;

type LintReportEntry = {
  filePath: string;
  messages: Array<{ ruleId: string | null; line: number; column: number }>;
};

function chunkFiles(files: string[], batchSize: number): string[][] {
  const batches: string[][] = [];

  for (let index = 0; index < files.length; index += batchSize) {
    batches.push(files.slice(index, index + batchSize));
  }

  return batches;
}

function lintTrackedFiles(trackedFiles: string[]) {
  const eslintCli = path.join(
    repoRoot,
    "node_modules",
    "eslint",
    "bin",
    "eslint.js"
  );
  const result = spawnSync(
    process.execPath,
    [
      eslintCli,
      ...trackedFiles,
      "--rule",
      "react-hooks/set-state-in-effect:error",
      "--format",
      "json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: ISSUE_874_BATCH_TIMEOUT_MS,
      killSignal: "SIGTERM",
    }
  );

  if (
    result.signal === "SIGTERM" ||
    result.error?.message?.includes("ETIMEDOUT")
  ) {
    throw new Error(
      `ESLint timed out after ${ISSUE_874_BATCH_TIMEOUT_MS}ms for batch: ${trackedFiles.join(", ")}`
    );
  }

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);

  const output = result.stdout.trim();
  expect(output).not.toBe("");

  const report = JSON.parse(output) as LintReportEntry[];

  return report.flatMap((entry) =>
    entry.messages
      .filter((message) => message.ruleId === "react-hooks/set-state-in-effect")
      .map((message) => ({
        filePath: path.relative(repoRoot, entry.filePath),
        line: message.line,
        column: message.column,
      }))
  );
}

describe("Issue 874 lint regression", () => {
  it.each(
    chunkFiles(issue874Files, ISSUE_874_FILE_BATCH_SIZE).map(
      (trackedFiles, index) => [index + 1, trackedFiles] as const
    )
  )(
    "has no react-hooks/set-state-in-effect violations in tracked batch %i",
    (_batchNumber, trackedFiles) => {
      expect(lintTrackedFiles(trackedFiles)).toEqual([]);
    },
    ISSUE_874_BATCH_TIMEOUT_MS
  );
});
