// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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
  it("keeps passkey and Android provisioning strings translated", () => {
    const catalogSource = readFileSync(
      join(process.cwd(), "src/locales/de/messages.po"),
      "utf8"
    );
    const entries = parseCatalogEntries(catalogSource);

    for (const msgid of [
      "Added {0}",
      "Add passkey",
      "Adding passkey...",
      "Create enrollment session",
      "Creating enrollment session...",
      "Device label",
      "Enrollment Sessions",
      "Expires",
      "Front desk tablet",
      "Loading enrollment sessions...",
      "Loading passkeys...",
      "No action available",
      "No Android enrollment sessions have been created yet.",
      "No passkeys enrolled yet.",
      "Passkey label",
      "Passkeys",
      "Provisioning QR code",
      "Reason",
      "Review the passkeys currently enrolled for this account.",
      "Revocation reason",
      "Revoke",
      "Revoked",
      "Sign in with passkey",
      "Signing in with passkey...",
      "This browser does not support passkeys.",
      "Unnamed Android enrollment session",
      "Update channel",
      "You can inspect Android enrollment status, but write permission is required to create or revoke sessions.",
      "Removing...",
    ]) {
      expect(entries.get(msgid), msgid).toBeTruthy();
    }
  });
});
