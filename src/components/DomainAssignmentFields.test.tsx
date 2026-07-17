// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainAssignmentFields } from "./DomainAssignmentFields";
import * as legalEntityApi from "../services/customerLegalEntitiesApi";
import * as domainApi from "../services/customerDomainApi";

vi.mock("../services/customerLegalEntitiesApi");
vi.mock("../services/customerDomainApi");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness({
  customer = true,
  withErrors = false,
  required = true,
  fixedCustomerId,
}: {
  customer?: boolean;
  withErrors?: boolean;
  required?: boolean;
  fixedCustomerId?: string;
}) {
  const [value, setValue] = React.useState({
    legal_entity_id: "",
    establishment_id: "",
    customer_id: "",
  });
  const [errors, setErrors] = React.useState(
    withErrors
      ? {
          legal_entity_id: "Invalid legal entity",
          establishment_id: "Invalid establishment",
          customer_id: "Invalid customer",
        }
      : {}
  );
  return (
    <I18nProvider i18n={i18n}>
      <DomainAssignmentFields
        value={value}
        onChange={(next) => setValue({ ...value, ...next })}
        includeCustomer={customer}
        required={required}
        fixedCustomerId={fixedCustomerId}
        errors={errors}
        onClearErrors={(fields) =>
          setErrors((current) => {
            const next = { ...current };
            for (const field of fields) delete next[field];
            return next;
          })
        }
      />
      <output data-testid="assignment-value">{JSON.stringify(value)}</output>
    </I18nProvider>
  );
}

describe("DomainAssignmentFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
      { id: "legal-2", name: "Operations GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([]);
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue([]);
  });

  it("auto-selects the sole authorized legal entity and exposes accessible fields", async () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
    ]);
    render(<Harness />);

    await waitFor(() =>
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith("legal-1")
    );
    expect(
      screen.getByRole("combobox", { name: /legal entity/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /establishment/i })
    ).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("combobox", { name: /customer/i })).toBeDisabled();
  });

  it("resets descendants and ignores a stale establishment response", async () => {
    const first = deferred<Array<{ id: string; name: string }>>();
    vi.mocked(domainApi.listEstablishmentLookups)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([{ id: "est-2", name: "Hamburg" }]);
    const user = userEvent.setup();
    render(<Harness customer={false} />);

    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(screen.getByRole("option", { name: "SecPal GmbH" }));
    await user.click(screen.getByRole("combobox", { name: /legal entity/i }));
    await user.click(screen.getByRole("option", { name: "Operations GmbH" }));
    await waitFor(() =>
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith("legal-2")
    );
    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    expect(
      await screen.findByRole("option", { name: "Hamburg" })
    ).toBeInTheDocument();

    first.resolve([{ id: "est-1", name: "Berlin" }]);
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Berlin" })
      ).not.toBeInTheDocument()
    );
  });

  it("resets descendant values and errors when a parent changes", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
    ]);
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue([
      { id: "customer-1", name: "Customer One" },
    ]);
    const user = userEvent.setup();
    render(<Harness withErrors />);

    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(screen.getByRole("option", { name: "SecPal GmbH" }));

    expect(screen.queryByText("Invalid establishment")).not.toBeInTheDocument();
    expect(screen.queryByText("Invalid customer")).not.toBeInTheDocument();
    expect(screen.getByTestId("assignment-value")).toHaveTextContent(
      '"establishment_id":"","customer_id":""'
    );

    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    await user.click(await screen.findByRole("option", { name: "Berlin" }));
    await waitFor(() =>
      expect(domainApi.listCustomerLookups).toHaveBeenCalledWith("est-1")
    );
  });

  it("ignores a stale customer response", async () => {
    const first = deferred<Array<{ id: string; name: string }>>();
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
    ]);
    vi.mocked(domainApi.listCustomerLookups)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([{ id: "customer-2", name: "Current Customer" }]);
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(screen.getByRole("option", { name: "SecPal GmbH" }));
    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    await user.click(await screen.findByRole("option", { name: "Berlin" }));
    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    await user.click(await screen.findByRole("option", { name: "Hamburg" }));

    await user.click(screen.getByRole("combobox", { name: /customer/i }));
    expect(
      await screen.findByRole("option", { name: "Current Customer" })
    ).toBeInTheDocument();

    first.resolve([{ id: "customer-1", name: "Stale Customer" }]);
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "Stale Customer" })
      ).not.toBeInTheDocument()
    );
  });

  it("clears optional domain filters back to an unfiltered value", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
    ]);
    const user = userEvent.setup();
    render(<Harness customer={false} required={false} />);

    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(screen.getByRole("option", { name: "SecPal GmbH" }));
    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    await user.click(await screen.findByRole("option", { name: "Berlin" }));
    await user.click(
      screen.getByRole("button", { name: /clear domain filters/i })
    );

    expect(screen.getByTestId("assignment-value")).toHaveTextContent(
      '"legal_entity_id":"","establishment_id":""'
    );
  });

  it("preserves and locks a route-scoped customer across parent changes", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
    ]);
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue([
      { id: "customer-1", name: "Route Customer" },
    ]);
    const user = userEvent.setup();
    render(<Harness fixedCustomerId="customer-1" />);

    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(screen.getByRole("option", { name: "SecPal GmbH" }));
    await user.click(screen.getByRole("combobox", { name: /establishment/i }));
    await user.click(await screen.findByRole("option", { name: "Berlin" }));

    expect(screen.getByTestId("assignment-value")).toHaveTextContent(
      '"customer_id":"customer-1"'
    );
    expect(screen.getByRole("combobox", { name: /customer/i })).toBeDisabled();
  });
});
