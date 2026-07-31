// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import {
  installStrictCspAudit,
  type StrictCspAuditEvent,
} from "./e2e/strict-csp-audit";

describe("strict CSP browser audit", () => {
  it("streams audit events to Node while an init script instruments every document", async () => {
    let reportEvent:
      ((source: unknown, event: StrictCspAuditEvent) => void) | undefined;
    const exposeBinding = vi.fn(
      async (
        _name: string,
        callback: (source: unknown, event: StrictCspAuditEvent) => void
      ) => {
        reportEvent = callback;
      }
    );
    const addInitScript = vi.fn(async () => undefined);
    const page = {
      exposeBinding,
      addInitScript,
    } as unknown as Page;

    const audit = await installStrictCspAudit(page);

    expect(exposeBinding).toHaveBeenCalledWith(
      "__secpalReportStrictCspAudit",
      expect.any(Function)
    );
    expect(addInitScript).toHaveBeenCalledOnce();

    reportEvent?.(
      { frame: { url: () => "http://localhost/login" } },
      {
        kind: "csp-violation",
        detail: "style-src-elem: inline",
      }
    );
    reportEvent?.(
      { frame: { url: () => "http://localhost/" } },
      {
        kind: "executable-element",
        detail: "script",
      }
    );

    expect(audit.violations).toEqual(["style-src-elem: inline"]);
    expect(audit.executableElementMutations).toEqual(["script"]);
  });
});
