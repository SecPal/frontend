// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import {
  Alert,
  AlertDescription,
  Field,
  FieldGroup,
  FieldLabel,
  CustomerSiteFormCheckboxField as FormCheckboxField,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { CustomerEstablishmentFields } from "@/components/CustomerEstablishmentFields";
import type { CustomerEstablishmentFormValue } from "@/components/CustomerEstablishmentFields";
import type {
  CreateCustomerRequest,
  EstablishmentLookup,
  LegalEntityLookup,
} from "@/types/api/customers";
import { createCustomer } from "../../services/customersApi";
import { listCustomerLegalEntities } from "../../services/customerLegalEntitiesApi";
import {
  createCustomerEstablishment,
  listEstablishmentLookups,
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

function optional(value: string): string | null {
  return value.trim() || null;
}

export default function CustomerCreate() {
  const navigate = useNavigate();
  const [legalEntities, setLegalEntities] = useState<LegalEntityLookup[]>([]);
  const [establishments, setEstablishments] = useState<EstablishmentLookup[]>(
    []
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loadingLegalEntities, setLoadingLegalEntities] = useState(true);
  const [loadingEstablishments, setLoadingEstablishments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState([emptyAssignment()]);
  const [form, setForm] = useState<CreateCustomerRequest>({
    legal_entity_id: "",
    name: "",
    vat_id: null,
    billing_address: { street: "", postal_code: "", city: "", country: "DE" },
    is_active: true,
  });
  const selectedLegalEntityId =
    form.legal_entity_id ||
    (legalEntities.length === 1 ? legalEntities[0]!.id : "");
  const loadingLookups = loadingLegalEntities || loadingEstablishments;

  useEffect(() => {
    let cancelled = false;
    listCustomerLegalEntities()
      .then((items) => {
        if (cancelled) return;
        setLegalEntities(items);
        if (items.length === 1) setLoadingEstablishments(true);
        setLookupError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLookupError(
            error instanceof Error
              ? error.message
              : "Failed to load legal entities"
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingLegalEntities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedLegalEntityId) return;
    listEstablishmentLookups(selectedLegalEntityId)
      .then((items) => {
        if (!cancelled) {
          setEstablishments(items);
          setLookupError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLookupError(
            error instanceof Error
              ? error.message
              : "Failed to load establishments"
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingEstablishments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLegalEntityId]);

  const assignmentIds = useMemo(
    () =>
      assignments
        .map((assignment) => assignment.establishment_id)
        .filter(Boolean),
    [assignments]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    if (!selectedLegalEntityId || assignmentIds.length !== assignments.length) {
      setSubmitError("Select a legal entity and at least one establishment.");
      return;
    }
    if (new Set(assignmentIds).size !== assignmentIds.length) {
      setSubmitError("Each establishment can only be assigned once.");
      return;
    }
    setSaving(true);
    try {
      const customer = await createCustomer({
        ...form,
        legal_entity_id: selectedLegalEntityId,
        name: form.name.trim(),
        vat_id: optional(form.vat_id ?? ""),
      });
      await Promise.all(
        assignments.map((assignment) =>
          createCustomerEstablishment({
            customer_id: customer.id,
            establishment_id: assignment.establishment_id,
            contact_name: optional(assignment.contact_name),
            email: optional(assignment.email),
            phone: optional(assignment.phone),
            comments: optional(assignment.comments),
          })
        )
      );
      navigate(`/customers/${customer.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create customer"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle className="mb-6">
        <Trans>New Customer</Trans>
      </PageTitle>
      {(lookupError || submitError) && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {submitError ?? lookupError}
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="customer-legal-entity">
              <Trans>Legal Entity</Trans> *
            </FieldLabel>
            <Select
              value={selectedLegalEntityId}
              onValueChange={(value) => {
                setEstablishments([]);
                setAssignments([emptyAssignment()]);
                setLoadingEstablishments(true);
                setForm((current) => ({ ...current, legal_entity_id: value }));
              }}
            >
              <SelectTrigger
                id="customer-legal-entity"
                aria-required="true"
                disabled={loadingLookups || legalEntities.length === 1}
              >
                <SelectValue placeholder="Select legal entity..." />
              </SelectTrigger>
              <SelectContent>
                {legalEntities.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="customer-name">
              <Trans>Customer Name</Trans> *
            </FieldLabel>
            <Input
              id="customer-name"
              required
              autoComplete="organization"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </Field>
        </FieldGroup>
        <section aria-labelledby="billing-address-heading">
          <PageTitle id="billing-address-heading" level={2} className="mb-4">
            <Trans>Billing Address</Trans>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-street">
                <Trans>Street</Trans> *
              </FieldLabel>
              <Input
                id="customer-street"
                required
                value={form.billing_address.street}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    billing_address: {
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
                  value={form.billing_address.postal_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billing_address: {
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
                  value={form.billing_address.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      billing_address: {
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
                maxLength={32}
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
                value={form.billing_address.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    billing_address: {
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
            Contact details entered here apply only to the selected
            establishment.
          </p>
          <CustomerEstablishmentFields
            assignments={assignments}
            establishments={establishments}
            disabled={loadingLookups || !selectedLegalEntityId}
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
            checked={form.is_active}
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
          <Button type="submit" disabled={saving || loadingLookups}>
            {saving ? "Creating..." : "Create Customer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/customers")}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </div>
  );
}
