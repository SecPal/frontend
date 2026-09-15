// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
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
  StrongEntityTag,
  UpdateCustomerRequest,
} from "@/types/api/customers";
import {
  CustomerTransactionalEditError,
  getCustomerEditSnapshot,
  transactionallyEditCustomer,
} from "../../services/customersApi";
import { listEstablishmentLookups } from "../../services/customerDomainApi";
import { useDomainAssignmentNames } from "../../hooks/useDomainAssignmentNames";
import {
  customerEditIntentFromCustomer,
  emptyCustomerAssignment,
  reconcileCustomerEditIntent,
} from "./customerEditIntent";
import type { CustomerEditIntent } from "./customerEditIntent";
const optional = (value: string) => value.trim() || null;

export default function CustomerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { _ } = useLingui();
  const recoveryError = (location.state as { recoveryError?: unknown } | null)
    ?.recoveryError;
  const activeRouteId = useRef(id);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [etag, setEtag] = useState<StrongEntityTag | null>(null);
  const [form, setForm] = useState<UpdateCustomerRequest>({});
  const [assignments, setAssignments] = useState<
    CustomerEstablishmentFormValue[]
  >([]);
  const [establishments, setEstablishments] = useState<EstablishmentLookup[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [establishmentsLoading, setEstablishmentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignmentLoadError, setAssignmentLoadError] = useState<string | null>(
    null
  );
  const [submitError, setSubmitError] = useState<string | null>(
    typeof recoveryError === "string" ? recoveryError : null
  );
  const [staleIntent, setStaleIntent] = useState<CustomerEditIntent | null>(
    null
  );
  const [editBaseline, setEditBaseline] = useState<CustomerEditIntent | null>(
    null
  );
  const domainNames = useDomainAssignmentNames(
    customer ? [{ legal_entity_id: customer.legal_entity_id }] : []
  );

  useLayoutEffect(() => {
    activeRouteId.current = id;
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomer() {
      setCustomer(null);
      setEtag(null);
      setAssignments([]);
      setEstablishments([]);
      setLoadError(null);
      setAssignmentLoadError(null);
      setStaleIntent(null);
      setEditBaseline(null);
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getCustomerEditSnapshot(id);
        if (cancelled) return;
        const loadedCustomer = snapshot.customer;
        const loadedIntent = customerEditIntentFromCustomer(loadedCustomer);
        setCustomer(loadedCustomer);
        setEtag(snapshot.etag);
        setForm(loadedIntent.form);
        setAssignments(loadedIntent.assignments);
        setEditBaseline(loadedIntent);
        setEstablishmentsLoading(true);
        try {
          const options = await listEstablishmentLookups(
            loadedCustomer.legal_entity_id
          );
          if (cancelled) return;
          setEstablishments(options);
        } catch {
          if (!cancelled) {
            setAssignmentLoadError(
              _(msg`Some establishment details could not be loaded.`)
            );
          }
        } finally {
          if (!cancelled) setEstablishmentsLoading(false);
        }
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

  async function retryEstablishmentLookups() {
    const activeCustomer = customer?.id === id ? customer : null;
    if (!activeCustomer) return;
    const customerId = activeCustomer.id;
    setEstablishmentsLoading(true);
    setAssignmentLoadError(null);
    try {
      const options = await listEstablishmentLookups(
        activeCustomer.legal_entity_id
      );
      if (activeRouteId.current !== customerId) return;
      setEstablishments(options);
    } catch {
      if (activeRouteId.current !== customerId) return;
      setAssignmentLoadError(
        _(msg`Some establishment details could not be loaded.`)
      );
    } finally {
      if (activeRouteId.current === customerId) {
        setEstablishmentsLoading(false);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !id ||
      !customer ||
      customer.id !== id ||
      !etag ||
      establishmentsLoading ||
      assignmentLoadError
    )
      return;
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
    try {
      const committedCustomer = await transactionallyEditCustomer(id, etag, {
        customer: {
          ...form,
          vat_id: optional(form.vat_id ?? ""),
        },
        customer_establishments: assignments.map((assignment) => ({
          customer_id: id,
          establishment_id: assignment.establishment_id,
          contact_name: optional(assignment.contact_name),
          email: optional(assignment.email),
          phone: optional(assignment.phone),
          comments: optional(assignment.comments),
        })),
      });
      navigate(`/customers/${id}`, { state: { committedCustomer } });
    } catch (reason) {
      if (
        reason instanceof CustomerTransactionalEditError &&
        reason.status === 412 &&
        reason.code === "CUSTOMER_EDIT_STALE"
      ) {
        const intent = { form, assignments };
        setEtag(null);
        try {
          const currentSnapshot = await getCustomerEditSnapshot(id);
          if (activeRouteId.current !== id) return;
          const freshIntent = customerEditIntentFromCustomer(
            currentSnapshot.customer
          );
          setCustomer(currentSnapshot.customer);
          setEtag(currentSnapshot.etag);
          setForm(freshIntent.form);
          setAssignments(freshIntent.assignments);
          setStaleIntent(
            editBaseline
              ? reconcileCustomerEditIntent(editBaseline, intent, freshIntent)
              : null
          );
          setEditBaseline(freshIntent);
          setSubmitError(
            _(
              msg`This customer changed while you were editing. Your changes were not saved. The latest customer data is shown below; review it before saving again.`
            )
          );
        } catch {
          if (activeRouteId.current !== id) return;
          setSubmitError(
            _(
              msg`This customer changed while you were editing, and the latest customer data could not be loaded. Reload the page before trying again.`
            )
          );
        }
      } else {
        setSubmitError(
          reason instanceof Error
            ? reason.message
            : _(msg`Failed to update customer`)
        );
      }
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
                <span className="block">{submitError}</span>
                {staleIntent ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setForm(staleIntent.form);
                      setAssignments(staleIntent.assignments);
                      setStaleIntent(null);
                      setSubmitError(null);
                    }}
                  >
                    <Trans>Restore My Changes</Trans>
                  </Button>
                ) : null}
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
            {assignmentLoadError ? (
              <Alert role="alert" className="mb-4">
                <AlertDescription>
                  <p>{assignmentLoadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={establishmentsLoading}
                    onClick={() => void retryEstablishmentLookups()}
                  >
                    <Trans>Retry</Trans>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <CustomerEstablishmentFields
              assignments={assignments}
              establishments={establishments}
              disabled={establishmentsLoading || Boolean(assignmentLoadError)}
              onChange={(key, value) =>
                setAssignments((current) =>
                  current.map((item) => (item.key === key ? value : item))
                )
              }
              onAdd={() =>
                setAssignments((current) => [
                  ...current,
                  emptyCustomerAssignment(),
                ])
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
            <Button
              type="submit"
              disabled={
                saving ||
                establishmentsLoading ||
                Boolean(assignmentLoadError) ||
                !etag
              }
            >
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
