// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerEstablishmentFields } from "./CustomerEstablishmentFields";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { messages as enMessages } from "@/locales/en/messages.mjs";

describe("CustomerEstablishmentFields", () => {
  beforeAll(() => {
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
  });

  beforeEach(() => i18n.activate("en"));

  it("groups each establishment with distinctly labelled local contacts", () => {
    render(
      <I18nProvider i18n={i18n}>
        <CustomerEstablishmentFields
          assignments={[
            {
              key: "assignment-1",
              establishment_id: "establishment-1",
              contact_name: "",
              email: "",
              phone: "",
              comments: "",
            },
          ]}
          establishments={[{ id: "establishment-1", name: "Berlin" }]}
          onChange={vi.fn()}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
        />
      </I18nProvider>
    );

    const group = screen.getByRole("group", { name: /establishment 1/i });
    expect(group).toContainElement(
      screen.getByRole("combobox", { name: /establishment 1/i })
    );
    expect(group).toContainElement(
      screen.getByRole("textbox", { name: /local contact name 1/i })
    );
    expect(group).toContainElement(
      screen.getByRole("textbox", { name: /local email 1/i })
    );
    expect(screen.queryByText(/organizational unit/i)).not.toBeInTheDocument();
  });

  it("renders the assignment controls in the active locale", () => {
    i18n.activate("de");
    render(
      <I18nProvider i18n={i18n}>
        <CustomerEstablishmentFields
          assignments={[
            {
              key: "assignment-1",
              establishment_id: "",
              contact_name: "",
              email: "",
              phone: "",
              comments: "",
            },
          ]}
          establishments={[]}
          onChange={vi.fn()}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("button", { name: "Betriebsstätte hinzufügen" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Betriebsstätte 1" })
    ).toBeInTheDocument();
  });
});
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
