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
  EstablishmentLookup,
  UpdateCustomerRequest,
} from "@/types/api/customers";
import { getCustomer, updateCustomer } from "../../services/customersApi";
import {
  createCustomerEstablishment,
  deleteCustomerEstablishment,
  listCustomerEstablishments,
  listEstablishmentLookups,
  updateCustomerEstablishment,
} from "../../services/customerDomainApi";

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
  const [originalEstablishments, setOriginalEstablishments] = useState<
    Record<string, string>
  >({});
  const [establishments, setEstablishments] = useState<EstablishmentLookup[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(
    typeof recoveryError === "string" ? recoveryError : null
  );

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setLoading(true);
        return Promise.all([
          getCustomer(id),
          listCustomerEstablishments({ customer_id: id, per_page: 100 }),
        ]);
      })
      .then(async (result) => {
        if (!result) return;
        const [loadedCustomer, links] = result;
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
        const values = links.data.map((link) => ({
          key: link.id,
          id: link.id,
          establishment_id: link.establishment_id,
          contact_name: link.contact_name ?? "",
          email: link.email ?? "",
          phone: link.phone ?? "",
          comments: link.comments ?? "",
        }));
        setAssignments(values.length ? values : [emptyAssignment()]);
        setOriginalEstablishments(
          Object.fromEntries(
            values.map((value) => [value.id!, value.establishment_id])
          )
        );
        setEstablishments(options);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : _(msg`Failed to load customer`)
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
      setError(_(msg`Select each establishment once.`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateCustomer(id, {
        ...form,
        vat_id: optional(form.vat_id ?? ""),
      });
      const unchangedIds = assignments.flatMap((item) =>
        item.id && originalEstablishments[item.id] === item.establishment_id
          ? [item.id]
          : []
      );
      const contactsFor = (item: CustomerEstablishmentFormValue) => ({
        contact_name: optional(item.contact_name),
        email: optional(item.email),
        phone: optional(item.phone),
        comments: optional(item.comments),
      });
      await Promise.all(
        assignments
          .filter((item) => item.id && unchangedIds.includes(item.id))
          .map((item) =>
            updateCustomerEstablishment(item.id!, contactsFor(item))
          )
      );

      const pendingCreations = assignments.filter(
        (item) => !item.id || !unchangedIds.includes(item.id)
      );
      const created = [];
      try {
        for (const item of pendingCreations) {
          created.push({
            item,
            link: await createCustomerEstablishment({
              customer_id: id,
              establishment_id: item.establishment_id,
              ...contactsFor(item),
            }),
          });
        }
      } catch (creationError) {
        await Promise.allSettled(
          created.map(({ link }) => deleteCustomerEstablishment(link.id))
        );
        throw creationError;
      }

      for (const { item, link } of created) {
        if (!item.id) continue;
        try {
          await deleteCustomerEstablishment(item.id);
        } catch (deletionError) {
          await deleteCustomerEstablishment(link.id).catch(() => undefined);
          throw deletionError;
        }
      }

      const retainedOriginalIds = new Set(
        assignments.flatMap((item) => (item.id ? [item.id] : []))
      );
      await Promise.all(
        Object.keys(originalEstablishments)
          .filter((linkId) => !retainedOriginalIds.has(linkId))
          .map((linkId) => deleteCustomerEstablishment(linkId))
      );
      navigate(`/customers/${id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
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
        <Alert>
          <AlertDescription>
            {error ?? <Trans>Customer not found</Trans>}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert className="border-destructive/30 bg-destructive/10">
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <section aria-labelledby="master-data-heading">
            <PageTitle id="master-data-heading" level={2} className="mb-4">
              <Trans>Legal-entity master data</Trans>
            </PageTitle>
            <p className="mb-4 text-sm text-muted-foreground">
              <Trans>Legal Entity:</Trans> {activeCustomer.legal_entity_id}
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
