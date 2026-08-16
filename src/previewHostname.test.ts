// SPDX-FileCopyrightText: 2026 SecPal Contributors
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

  it("treats the retired changelog prefix as part of a generic workspace name", () => {
    expect(
      parsePreviewHostname("changelog-grumpy-lynx.preview.secpal.dev")
    ).toEqual({
      repo: null,
      workspace: "changelog-grumpy-lynx",
    });
  });
});
