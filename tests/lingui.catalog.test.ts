// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function parseCatalogEntries(catalogSource: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const block of catalogSource.split("\n\n")) {
    const lines = block.split("\n");
    let currentSection: "msgid" | "msgstr" | null = null;
    let msgid = "";
    let msgstr = "";

    for (const line of lines) {
      if (line.startsWith("msgid ")) {
        currentSection = "msgid";
        msgid = line.slice(7, -1);
        continue;
      }

      if (line.startsWith("msgstr ")) {
        currentSection = "msgstr";
        msgstr = line.slice(8, -1);
        continue;
      }

      if (line.startsWith('"')) {
        const value = line.slice(1, -1);

        if (currentSection === "msgid") {
          msgid += value;
        } else if (currentSection === "msgstr") {
          msgstr += value;
        }
      }
    }

    if (msgid !== "") {
      entries.set(msgid, msgstr);
    }
  }

  return entries;
}

describe("Lingui German catalog", () => {
  it("keeps the German catalog fully translated", () => {
    const catalogSource = readFileSync(
      join(process.cwd(), "src/locales/de/messages.po"),
      "utf8"
    );
    const entries = parseCatalogEntries(catalogSource);

    const missingEntries = [...entries.entries()]
      .filter(([, msgstr]) => msgstr === "")
      .map(([msgid]) => msgid);

    expect(missingEntries).toEqual([]);
  });

  it("keeps passkey strings translated", () => {
    const catalogSource = readFileSync(
      join(process.cwd(), "src/locales/de/messages.po"),
      "utf8"
    );
    const entries = parseCatalogEntries(catalogSource);

    for (const msgid of [
      "Added {0}",
      "Add passkey",
      "Adding passkey...",
      "Loading passkeys...",
      "No passkeys enrolled yet.",
      "Passkey label",
      "Passkeys",
      "Review the passkeys currently enrolled for this account.",
      "Sign in with passkey",
      "Signing in with passkey...",
      "This browser does not support passkeys.",
    ]) {
      expect(entries.get(msgid), msgid).toBeTruthy();
    }
  });
});
