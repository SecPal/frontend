// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { Page } from "@playwright/test";

export type StrictCspAuditEvent =
  | { kind: "csp-violation"; detail: string }
  | { kind: "executable-element"; detail: string };

export interface StrictCspAudit {
  readonly violations: string[];
  readonly executableElementMutations: string[];
}

export async function installStrictCspAudit(
  page: Page
): Promise<StrictCspAudit> {
  const audit: StrictCspAudit = {
    violations: [],
    executableElementMutations: [],
  };

  await page.exposeBinding(
    "__secpalReportStrictCspAudit",
    (_source, event: StrictCspAuditEvent) => {
      if (event.kind === "csp-violation") {
        audit.violations.push(event.detail);
        return;
      }

      audit.executableElementMutations.push(event.detail);
    }
  );

  await page.addInitScript(() => {
    const auditWindow = window as typeof window & {
      __secpalReportStrictCspAudit: (
        event: StrictCspAuditEvent
      ) => Promise<void>;
    };
    const report = (event: StrictCspAuditEvent) => {
      void auditWindow.__secpalReportStrictCspAudit(event);
    };

    window.addEventListener("securitypolicyviolation", (event) => {
      report({
        kind: "csp-violation",
        detail: `${window.location.href} ${event.violatedDirective}: ${event.blockedURI || "inline"}`,
      });
    });

    const startExecutableElementObserver = () => {
      const recordElement = (element: Element) => {
        if (element.matches("style, script")) {
          report({
            kind: "executable-element",
            detail: `${window.location.href} ${element.tagName.toLowerCase()}`,
          });
        }

        for (const descendant of element.querySelectorAll("style, script")) {
          report({
            kind: "executable-element",
            detail: `${window.location.href} ${descendant.tagName.toLowerCase()}`,
          });
        }
      };
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) {
              recordElement(node);
            }
          }
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        startExecutableElementObserver,
        { once: true }
      );
    } else {
      startExecutableElementObserver();
    }
  });

  return audit;
}
