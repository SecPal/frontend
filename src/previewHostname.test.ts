// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { parsePreviewHostname } from "./previewHostname";

describe("parsePreviewHostname", () => {
  it("normalizes repo and workspace names to lowercase", () => {
    expect(
      parsePreviewHostname("Frontend-Grumpy-Lynx.Preview.SecPal.Dev")
    ).toEqual({
      repo: "frontend",
      workspace: "grumpy-lynx",
    });
  });
});
