// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Customer Create Page
 * Epic #210 - Customer & Site Management
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import {
  createCustomer,
  listCustomerLegalEntities,
} from "../../services/customersApi";
import type {
  CreateCustomerRequest,
  Address,
  Contact,
  CustomerLegalEntityLookup,
} from "../../types/customers";
import {
  Alert,
  AlertDescription,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  CustomerSiteFormCheckboxField as FormCheckboxField,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";

type CustomerFormErrors = Partial<
  Record<
    | "name"
    | "legal_entity_id"
    | "billing_address.street"
    | "billing_address.postal_code"
    | "billing_address.city"
    | "billing_address.country"
    | "contact.email",
    string
  >
>;

export default function CustomerCreate() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalEntities, setLegalEntities] = useState<
    CustomerLegalEntityLookup[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState<CustomerFormErrors>({});

  const [formData, setFormData] = useState<CreateCustomerRequest>({
    legal_entity_id: "",
    name: "",
    billing_address: {
      street: "",
      city: "",
      postal_code: "",
      country: "DE",
    },
    contact: {
      name: "",
      email: "",
      phone: "",
    },
    is_active: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadLegalEntities() {
      try {
        const entities = await listCustomerLegalEntities();
        if (!cancelled) {
          setLegalEntities(entities);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : _(msg`Failed to load legal entities`)
          );
        }
      }
    }

    void loadLegalEntities();

    return () => {
      cancelled = true;
    };
  }, [_]);

  function updateField(field: keyof CreateCustomerRequest, value: unknown) {
    if (field === "name" || field === "legal_entity_id") {
      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const next = { ...current };
        delete next[field];
        return next;
      });
    }

    setFormData((currentFormData) => ({
      ...currentFormData,
      [field]: value,
    }));
  }

  function updateAddress(field: keyof Address, value: string) {
    const errorKey = `billing_address.${field}` as keyof CustomerFormErrors;
    setFieldErrors((current) => {
      if (!current[errorKey]) {
        return current;
      }

      const next = { ...current };
      delete next[errorKey];
      return next;
    });

    setFormData((currentFormData) => ({
      ...currentFormData,
      billing_address: {
        ...currentFormData.billing_address,
        [field]: value,
      },
    }));
  }

  function updateContact(field: keyof Contact, value: string) {
    if (field === "email") {
      setFieldErrors((current) => {
        if (!current["contact.email"]) {
          return current;
        }

        const next = { ...current };
        delete next["contact.email"];
        return next;
      });
    }

    setFormData((currentFormData) => ({
      ...currentFormData,
      contact: {
        ...(currentFormData.contact || {}),
        [field]: value,
      } as Contact,
    }));
  }

  function validateForm(): CustomerFormErrors {
    const validationErrors: CustomerFormErrors = {};

    if (formData.name.trim().length === 0) {
      validationErrors.name = _(msg`Customer name is required.`);
    }

    if (formData.legal_entity_id.trim().length === 0) {
      validationErrors.legal_entity_id = _(msg`Legal entity is required.`);
    }

    if (formData.billing_address.street.trim().length === 0) {
      validationErrors["billing_address.street"] = _(msg`Street is required.`);
    }

    if (formData.billing_address.postal_code.trim().length === 0) {
      validationErrors["billing_address.postal_code"] = _(
        msg`Postal code is required.`
      );
    }

    if (formData.billing_address.city.trim().length === 0) {
      validationErrors["billing_address.city"] = _(msg`City is required.`);
    }

    if (formData.billing_address.country.trim().length !== 2) {
      validationErrors["billing_address.country"] = _(
        msg`Country must use a 2-letter code.`
      );
    }

    const email = formData.contact?.email?.trim() ?? "";
    if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors["contact.email"] = _(
        msg`Please enter a valid email address.`
      );
    }

    return validationErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      // Clean up the data before sending
      const dataToSend: CreateCustomerRequest = {
        legal_entity_id: formData.legal_entity_id,
        name: formData.name,
        billing_address: formData.billing_address,
        is_active: formData.is_active,
      };

      // Only include contact if at least one field is filled
      if (
        formData.contact &&
        (formData.contact.name ||
          formData.contact.email ||
          formData.contact.phone)
      ) {
        dataToSend.contact = formData.contact;
      }

      // Only include notes if not empty
      if (formData.notes && formData.notes.trim()) {
        dataToSend.notes = formData.notes;
      }

      const customer = await createCustomer(dataToSend);
      navigate(`/customers/${customer.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : _(msg`Failed to create customer`)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>New Customer</Trans>
        </PageTitle>
      </div>

      {error && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="customer-name">
              <Trans>Customer Name</Trans> *
            </FieldLabel>
            <Input
              id="customer-name"
              name="name"
              type="text"
              required
              autoComplete="organization"
              value={formData.name}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={
                fieldErrors.name ? "customer-name-error" : undefined
              }
              onChange={(e) => updateField("name", e.target.value)}
            />
            {fieldErrors.name ? (
              <FieldError id="customer-name-error">
                {fieldErrors.name}
              </FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="customer-legal-entity">
              <Trans>Legal Entity</Trans> *
            </FieldLabel>
            <select
              id="customer-legal-entity"
              name="legal_entity_id"
              required
              value={formData.legal_entity_id}
              aria-invalid={fieldErrors.legal_entity_id ? true : undefined}
              aria-describedby={
                fieldErrors.legal_entity_id
                  ? "customer-legal-entity-error"
                  : undefined
              }
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(e) =>
                updateField("legal_entity_id", e.target.value)
              }
            >
              <option value="">{_(msg`Select legal entity...`)}</option>
              {legalEntities.map((legalEntity) => (
                <option key={legalEntity.id} value={legalEntity.id}>
                  {legalEntity.name}
                </option>
              ))}
            </select>
            {fieldErrors.legal_entity_id ? (
              <FieldError id="customer-legal-entity-error">
                {fieldErrors.legal_entity_id}
              </FieldError>
            ) : null}
          </Field>
        </FieldGroup>

        {/* Billing Address */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Billing Address</Trans>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-street">
                <Trans>Street</Trans> *
              </FieldLabel>
              <Input
                id="customer-street"
                name="street"
                type="text"
                required
                autoComplete="street-address"
                value={formData.billing_address.street}
                aria-invalid={
                  fieldErrors["billing_address.street"] ? true : undefined
                }
                aria-describedby={
                  fieldErrors["billing_address.street"]
                    ? "customer-street-error"
                    : undefined
                }
                onChange={(e) => updateAddress("street", e.target.value)}
              />
              {fieldErrors["billing_address.street"] ? (
                <FieldError id="customer-street-error">
                  {fieldErrors["billing_address.street"]}
                </FieldError>
              ) : null}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="customer-postal-code">
                  <Trans>Postal Code</Trans> *
                </FieldLabel>
                <Input
                  id="customer-postal-code"
                  name="postal_code"
                  type="text"
                  required
                  autoComplete="postal-code"
                  value={formData.billing_address.postal_code}
                  aria-invalid={
                    fieldErrors["billing_address.postal_code"]
                      ? true
                      : undefined
                  }
                  aria-describedby={
                    fieldErrors["billing_address.postal_code"]
                      ? "customer-postal-code-error"
                      : undefined
                  }
                  onChange={(e) => updateAddress("postal_code", e.target.value)}
                />
                {fieldErrors["billing_address.postal_code"] ? (
                  <FieldError id="customer-postal-code-error">
                    {fieldErrors["billing_address.postal_code"]}
                  </FieldError>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="customer-city">
                  <Trans>City</Trans> *
                </FieldLabel>
                <Input
                  id="customer-city"
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  value={formData.billing_address.city}
                  aria-invalid={
                    fieldErrors["billing_address.city"] ? true : undefined
                  }
                  aria-describedby={
                    fieldErrors["billing_address.city"]
                      ? "customer-city-error"
                      : undefined
                  }
                  onChange={(e) => updateAddress("city", e.target.value)}
                />
                {fieldErrors["billing_address.city"] ? (
                  <FieldError id="customer-city-error">
                    {fieldErrors["billing_address.city"]}
                  </FieldError>
                ) : null}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="customer-country">
                <Trans>Country</Trans> *
              </FieldLabel>
              <Input
                id="customer-country"
                name="country"
                type="text"
                required
                maxLength={2}
                placeholder="DE"
                autoComplete="country"
                value={formData.billing_address.country}
                aria-invalid={
                  fieldErrors["billing_address.country"] ? true : undefined
                }
                aria-describedby={
                  fieldErrors["billing_address.country"]
                    ? "customer-country-error"
                    : undefined
                }
                onChange={(e) =>
                  updateAddress("country", e.target.value.toUpperCase())
                }
              />
              {fieldErrors["billing_address.country"] ? (
                <FieldError id="customer-country-error">
                  {fieldErrors["billing_address.country"]}
                </FieldError>
              ) : null}
            </Field>
          </FieldGroup>
        </div>

        {/* Contact Information */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Contact Person</Trans>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-contact-name">
                <Trans>Name</Trans>
              </FieldLabel>
              <Input
                id="customer-contact-name"
                name="contact_name"
                type="text"
                autoComplete="name"
                value={formData.contact?.name || ""}
                onChange={(e) => updateContact("name", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="customer-contact-email">
                <Trans>Email</Trans>
              </FieldLabel>
              <Input
                id="customer-contact-email"
                name="contact_email"
                type="text"
                inputMode="email"
                autoComplete="email"
                value={formData.contact?.email || ""}
                aria-invalid={fieldErrors["contact.email"] ? true : undefined}
                aria-describedby={
                  fieldErrors["contact.email"]
                    ? "customer-contact-email-error"
                    : undefined
                }
                onChange={(e) => updateContact("email", e.target.value)}
              />
              {fieldErrors["contact.email"] ? (
                <FieldError id="customer-contact-email-error">
                  {fieldErrors["contact.email"]}
                </FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="customer-contact-phone">
                <Trans>Phone</Trans>
              </FieldLabel>
              <Input
                id="customer-contact-phone"
                name="contact_phone"
                type="tel"
                autoComplete="tel"
                value={formData.contact?.phone || ""}
                onChange={(e) => updateContact("phone", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>

        {/* Additional Information */}
        <Field>
          <FieldLabel htmlFor="customer-notes">
            <Trans>Notes</Trans>
          </FieldLabel>
          <Textarea
            id="customer-notes"
            name="notes"
            rows={4}
            value={formData.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </Field>

        <FormCheckboxField>
          <Checkbox
            id="customer-is-active"
            name="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) =>
              updateField("is_active", checked === true)
            }
          />
          <FieldLabel htmlFor="customer-is-active">
            <Trans>Active</Trans>
          </FieldLabel>
        </FormCheckboxField>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Trans>Creating...</Trans>
            ) : (
              <Trans>Create Customer</Trans>
            )}
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
