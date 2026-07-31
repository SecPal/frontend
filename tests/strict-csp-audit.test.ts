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

  it("starts observing the document before bootstrap scripts run", async () => {
    let initScript: (() => void) | undefined;
    let observerCallback: MutationCallback | undefined;
    const observe = vi.fn();
    const report = vi.fn(async () => undefined);
    const addInitScript = vi.fn(async (callback: () => void) => {
      initScript = callback;
    });
    const page = {
      exposeBinding: vi.fn(async () => undefined),
      addInitScript,
    } as unknown as Page;
    const readyState = vi
      .spyOn(document, "readyState", "get")
      .mockReturnValue("loading");
    const MutationObserverMock = vi.fn(function MutationObserverMock(
      callback: MutationCallback
    ) {
      observerCallback = callback;
      return {
        disconnect: vi.fn(),
        observe,
        takeRecords: vi.fn(() => []),
      };
    });
    vi.stubGlobal("MutationObserver", MutationObserverMock);
    Object.assign(window, {
      __secpalReportStrictCspAudit: report,
    });
    const parserScript = document.createElement("script");
    parserScript.src = "/document-language.js";
    const duplicateParserScript = document.createElement("script");
    duplicateParserScript.src = "/document-language.js";
    const unexpectedScript = document.createElement("script");
    unexpectedScript.src = "/unexpected.js";

    try {
      await installStrictCspAudit(page);
      expect(initScript).toBeTypeOf("function");

      initScript?.();

      expect(MutationObserverMock).toHaveBeenCalledOnce();
      expect(observe).toHaveBeenCalledWith(document, {
        childList: true,
        subtree: true,
      });

      document.body.append(
        parserScript,
        duplicateParserScript,
        unexpectedScript
      );
      const transientStyle = document.createElement("style");
      observerCallback?.(
        [
          {
            addedNodes: [
              parserScript,
              parserScript,
              duplicateParserScript,
              unexpectedScript,
              transientStyle,
            ],
          } as unknown as MutationRecord,
        ],
        {} as MutationObserver
      );

      expect(report).toHaveBeenCalledTimes(3);
      expect(report).toHaveBeenNthCalledWith(1, {
        kind: "executable-element",
        detail: expect.stringMatching(/ script$/u),
      });
      expect(report).toHaveBeenNthCalledWith(2, {
        kind: "executable-element",
        detail: expect.stringMatching(/ script$/u),
      });
      expect(report).toHaveBeenNthCalledWith(3, {
        kind: "executable-element",
        detail: expect.stringMatching(/ style$/u),
      });
    } finally {
      parserScript.remove();
      duplicateParserScript.remove();
      unexpectedScript.remove();
      delete (
        window as typeof window & {
          __secpalReportStrictCspAudit?: unknown;
        }
      ).__secpalReportStrictCspAudit;
      readyState.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
