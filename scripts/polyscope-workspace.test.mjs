// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { getResolvableWorkspacePreviewName } from "./polyscope-workspace.mjs";

describe("getResolvableWorkspacePreviewName", () => {
  it("accepts the retired changelog prefix as part of a generic workspace name", () => {
    expect(
      getResolvableWorkspacePreviewName(
        "https://changelog-grumpy-lynx.preview.secpal.dev"
      )
    ).toBe("changelog-grumpy-lynx");
  });
});
