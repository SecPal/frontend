// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, beforeEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { NavUser } from "./nav-user";
import { SidebarProvider } from "@/ui/sidebar";

function renderNavUser() {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>
        <SidebarProvider>
          <NavUser
            user={{ name: "Max Mustermann", email: "max@example.com" }}
            onLogout={() => {}}
          />
        </SidebarProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("NavUser", () => {
  beforeEach(() => {
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
  });

  it("localizes the user menu trigger label", () => {
    i18n.activate("de");

    renderNavUser();

    expect(
      screen.getByRole("button", { name: "Benutzermenü" })
    ).toBeInTheDocument();
  });
});
