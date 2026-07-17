// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerEstablishmentFields } from "./CustomerEstablishmentFields";

describe("CustomerEstablishmentFields", () => {
  it("groups each establishment with distinctly labelled local contacts", () => {
    render(
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
});
