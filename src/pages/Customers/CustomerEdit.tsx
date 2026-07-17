// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import { FormSkeleton } from "@/ui/loading";
import {
  Alert,
  AlertDescription,
  Field,
  FieldGroup,
  FieldLabel,
  CustomerSiteFormCheckboxField as FormCheckboxField,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";
import { CustomerEstablishmentFields } from "@/components/CustomerEstablishmentFields";
import type { CustomerEstablishmentFormValue } from "@/components/CustomerEstablishmentFields";
import type {
  Customer,
  CustomerEstablishment,
  EstablishmentLookup,
  UpdateCustomerRequest,
} from "@/types/api/customers";
import { getCustomer, updateCustomer } from "../../services/customersApi";
import {
  listAllCustomerEstablishments,
  listEstablishmentLookups,
} from "../../services/customerDomainApi";
import {
  CustomerEstablishmentRecoveryError,
  reconcileCustomerEstablishments,
} from "./customerEstablishmentReconciliation";
import { useDomainAssignmentNames } from "../../hooks/useDomainAssignmentNames";

function emptyAssignment(): CustomerEstablishmentFormValue {
  return {
    key: crypto.randomUUID(),
    establishment_id: "",
    contact_name: "",
    email: "",
    phone: "",
    comments: "",
  };
}
const optional = (value: string) => value.trim() || null;

function originalCustomerUpdate(customer: Customer): UpdateCustomerRequest {
  return {
    name: customer.name,
    vat_id: customer.vat_id ?? null,
    billing_address: customer.billing_address,
    is_active: customer.is_active,
  };
}

export default function CustomerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { _ } = useLingui();
  const recoveryError = (location.state as { recoveryError?: unknown } | null)
    ?.recoveryError;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<UpdateCustomerRequest>({});
  const [assignments, setAssignments] = useState<
    CustomerEstablishmentFormValue[]
  >([]);
  const [originalAssignments, setOriginalAssignments] = useState<
    CustomerEstablishment[]
  >([]);
  const [establishments, setEstablishments] = useState<EstablishmentLookup[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(
    typeof recoveryError === "string" ? recoveryError : null
  );
  const domainNames = useDomainAssignmentNames(
    customer ? [{ legal_entity_id: customer.legal_entity_id }] : []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      setCustomer(null);
      setAssignments([]);
      setOriginalAssignments([]);
      setEstablishments([]);
      setLoadError(null);
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [loadedCustomer, links] = await Promise.all([
          getCustomer(id),
          listAllCustomerEstablishments({ customer_id: id }),
        ]);
        const options = await listEstablishmentLookups(
          loadedCustomer.legal_entity_id
        );
        if (cancelled) return;
        setCustomer(loadedCustomer);
        setForm({
          name: loadedCustomer.name,
          vat_id: loadedCustomer.vat_id ?? null,
          billing_address: loadedCustomer.billing_address,
          is_active: loadedCustomer.is_active,
        });
        const values = links.map((link) => ({
          key: link.id,
          id: link.id,
          establishment_id: link.establishment_id,
          contact_name: link.contact_name ?? "",
          email: link.email ?? "",
          phone: link.phone ?? "",
          comments: link.comments ?? "",
        }));
        setAssignments(values.length ? values : [emptyAssignment()]);
        setOriginalAssignments(links);
        setEstablishments(options);
      } catch (reason: unknown) {
        if (!cancelled)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : _(msg`Failed to load customer`)
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [_, id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!id || !customer || customer.id !== id) return;
    const selected = assignments.map((item) => item.establishment_id);
    if (
      selected.some((value) => !value) ||
      new Set(selected).size !== selected.length
    ) {
      setSubmitError(_(msg`Select each establishment once.`));
      return;
    }
    setSaving(true);
    setSubmitError(null);
    let masterDataUpdated = false;
    try {
      await updateCustomer(id, {
        ...form,
        vat_id: optional(form.vat_id ?? ""),
      });
      masterDataUpdated = true;
      await reconcileCustomerEstablishments(
        id,
        assignments,
        originalAssignments
      );
      navigate(`/customers/${id}`);
    } catch (reason) {
      if (masterDataUpdated) {
        try {
          await updateCustomer(id, originalCustomerUpdate(customer));
        } catch {
          setSubmitError(
            _(
              msg`Customer data could not be fully restored. Reload the page before making further changes.`
            )
          );
          return;
        }
      }
      setSubmitError(
        reason instanceof CustomerEstablishmentRecoveryError
          ? _(
              msg`The establishment assignments could not be fully restored. Reload the page before making further changes.`
            )
          : reason instanceof Error
            ? reason.message
            : _(msg`Failed to update customer`)
      );
    } finally {
      setSaving(false);
    }
  }

  const activeCustomer = customer?.id === id ? customer : null;
  const isRouteLoading = loading || (customer !== null && !activeCustomer);

  return (
    <div className="max-w-3xl">
      <PageTitle className="mb-6">
        <Trans>Edit Customer</Trans>
      </PageTitle>
      {isRouteLoading ? (
        <FormSkeleton loadingLabel={_(msg`Loading customer form`)} fields={8} />
      ) : !activeCustomer ? (
        <Alert role="alert">
          <AlertDescription>
            {loadError ?? <Trans>Customer not found</Trans>}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <Alert className="border-destructive/30 bg-destructive/10">
              <AlertDescription className="text-destructive">
                {submitError}
              </AlertDescription>
            </Alert>
          )}
          <section aria-labelledby="master-data-heading">
            <PageTitle id="master-data-heading" level={2} className="mb-4">
              <Trans>Legal-entity master data</Trans>
            </PageTitle>
            <p className="mb-4 text-sm text-muted-foreground">
              <Trans>Legal Entity:</Trans>{" "}
              {domainNames.legalEntities[activeCustomer.legal_entity_id] ??
                activeCustomer.legal_entity_id}
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer-name">
                  <Trans>Customer Name</Trans> *
                </FieldLabel>
                <Input
                  id="customer-name"
                  required
                  value={form.name ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="customer-street">
                  <Trans>Street</Trans> *
                </FieldLabel>
                <Input
                  id="customer-street"
                  required
                  value={form.billing_address?.street ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billing_address: {
                        ...activeCustomer.billing_address,
                        ...current.billing_address,
                        street: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="customer-postal-code">
                    <Trans>Postal Code</Trans> *
                  </FieldLabel>
                  <Input
                    id="customer-postal-code"
                    required
                    value={form.billing_address?.postal_code ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        billing_address: {
                          ...activeCustomer.billing_address,
                          ...current.billing_address,
                          postal_code: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customer-city">
                    <Trans>City</Trans> *
                  </FieldLabel>
                  <Input
                    id="customer-city"
                    required
                    value={form.billing_address?.city ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        billing_address: {
                          ...activeCustomer.billing_address,
                          ...current.billing_address,
                          city: event.target.value,
                        },
                      }))
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="customer-vat-id">
                  <Trans>VAT ID</Trans>
                </FieldLabel>
                <Input
                  id="customer-vat-id"
                  value={form.vat_id ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vat_id: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="customer-country">
                  <Trans>Country</Trans> *
                </FieldLabel>
                <Input
                  id="customer-country"
                  required
                  maxLength={2}
                  value={form.billing_address?.country ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billing_address: {
                        ...activeCustomer.billing_address,
                        ...current.billing_address,
                        country: event.target.value.toUpperCase(),
                      },
                    }))
                  }
                />
              </Field>
            </FieldGroup>
          </section>
          <section aria-labelledby="establishments-heading">
            <PageTitle id="establishments-heading" level={2} className="mb-2">
              <Trans>Establishments and local contacts</Trans>
            </PageTitle>
            <p className="mb-4 text-sm text-muted-foreground">
              <Trans>
                Contact details entered here apply only to the selected
                establishment.
              </Trans>
            </p>
            <CustomerEstablishmentFields
              assignments={assignments}
              establishments={establishments}
              onChange={(key, value) =>
                setAssignments((current) =>
                  current.map((item) => (item.key === key ? value : item))
                )
              }
              onAdd={() =>
                setAssignments((current) => [...current, emptyAssignment()])
              }
              onRemove={(key) =>
                setAssignments((current) =>
                  current.filter((item) => item.key !== key)
                )
              }
            />
          </section>
          <FormCheckboxField>
            <Checkbox
              id="customer-is-active"
              checked={form.is_active ?? false}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  is_active: checked === true,
                }))
              }
            />
            <FieldLabel htmlFor="customer-is-active">
              <Trans>Active</Trans>
            </FieldLabel>
          </FormCheckboxField>
          <div className="flex gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/customers/${id}`)}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
