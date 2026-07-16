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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Textarea } from "@/ui/textarea";
import {
  createCustomer,
  listCustomerEstablishmentOptions,
} from "../../services/customersApi";
import { listCustomerLegalEntities } from "../../services/customerLegalEntitiesApi";
import type {
  Address,
  Contact,
  CreateCustomerRequest,
  CustomerEstablishmentLookup,
  CustomerLegalEntityLookup,
} from "@/types/api/customers";
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
    | "establishment_id"
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
  const [loadingLegalEntities, setLoadingLegalEntities] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [legalEntities, setLegalEntities] = useState<
    CustomerLegalEntityLookup[]
  >([]);
  const [establishments, setEstablishments] = useState<
    CustomerEstablishmentLookup[]
  >([]);
  const [loadingEstablishments, setLoadingEstablishments] = useState(false);
  const [establishmentLookupError, setEstablishmentLookupError] = useState<
    string | null
  >(null);
  const [fieldErrors, setFieldErrors] = useState<CustomerFormErrors>({});

  const [formData, setFormData] = useState<CreateCustomerRequest>({
    legal_entity_id: "",
    establishment_id: "",
    name: "",
    vat_id: null,
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
      setLoadingLegalEntities(true);
      setLookupError(null);

      try {
        const entities = await listCustomerLegalEntities();
        if (!cancelled) {
          setLegalEntities(entities);
          setLookupError(null);
          setLoadingLegalEntities(false);
        }
      } catch (err) {
        if (!cancelled) {
          setLookupError(
            err instanceof Error
              ? err.message
              : _(msg`Failed to load legal entities`)
          );
          setLoadingLegalEntities(false);
        }
      }
    }

    void loadLegalEntities();

    return () => {
      cancelled = true;
    };
  }, [_, lookupAttempt]);

  useEffect(() => {
    let cancelled = false;
    const legalEntityId = selectedLegalEntityId;

    if (!legalEntityId) {
      return () => {
        cancelled = true;
      };
    }

    void listCustomerEstablishmentOptions(legalEntityId)
      .then((options) => {
        if (!cancelled) {
          setEstablishments(options);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEstablishments([]);
          setEstablishmentLookupError(
            err instanceof Error
              ? err.message
              : _(msg`Failed to load establishments`)
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEstablishments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [_, selectedLegalEntityId]);

  function retryLegalEntityLookup() {
    setLookupAttempt((attempt) => attempt + 1);
  }

  function updateField(field: keyof CreateCustomerRequest, value: unknown) {
    if (field === "legal_entity_id") {
      setFieldErrors((current) => {
        if (!current.legal_entity_id) return current;
        const next = { ...current };
        delete next.legal_entity_id;
        return next;
      });
      setSubmitError(null);
      setEstablishmentLookupError(null);
      setEstablishments([]);
      setLoadingEstablishments(Boolean(value));
      setFormData((currentFormData) => ({
        ...currentFormData,
        legal_entity_id: String(value),
        establishment_id: "",
        contact: { name: "", email: "", phone: "" },
        notes: null,
      }));
      return;
    }

    if (field === "name" || field === "establishment_id") {
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

  const hasExplicitLegalEntitySelection =
    formData.legal_entity_id.trim().length > 0;
  const isExplicitLegalEntitySelectionAuthorized = legalEntities.some(
    (legalEntity) => legalEntity.id === formData.legal_entity_id
  );
  const hasStaleExplicitLegalEntitySelection =
    hasExplicitLegalEntitySelection &&
    !isExplicitLegalEntitySelectionAuthorized;
  const selectedLegalEntityId = hasExplicitLegalEntitySelection
    ? isExplicitLegalEntitySelectionAuthorized
      ? formData.legal_entity_id
      : ""
    : legalEntities.length === 1
      ? legalEntities[0]!.id
      : "";

  function validateForm(): CustomerFormErrors {
    const validationErrors: CustomerFormErrors = {};

    if (formData.name.trim().length === 0) {
      validationErrors.name = _(msg`Customer name is required.`);
    }

    if (selectedLegalEntityId.trim().length === 0) {
      validationErrors.legal_entity_id = _(msg`Legal entity is required.`);
    }

    if (formData.establishment_id.trim().length === 0) {
      validationErrors.establishment_id = _(msg`Establishment is required.`);
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
    setSubmitError(null);

    if (loadingLegalEntities || lookupError || legalEntities.length === 0) {
      return;
    }

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
        legal_entity_id: selectedLegalEntityId,
        establishment_id: formData.establishment_id,
        name: formData.name,
        billing_address: formData.billing_address,
        is_active: formData.is_active,
      };

      const vatId = formData.vat_id?.trim();
      if (vatId) {
        dataToSend.vat_id = vatId;
      }

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
      setSubmitError(
        err instanceof Error ? err.message : _(msg`Failed to create customer`)
      );
    } finally {
      setLoading(false);
    }
  }

  const hasLegalEntityOptions = legalEntities.length > 0;
  const legalEntitySelectDisabled =
    loadingLegalEntities ||
    (legalEntities.length === 1 && !hasStaleExplicitLegalEntitySelection);
  const cannotCreateCustomer =
    loading ||
    loadingLegalEntities ||
    loadingEstablishments ||
    !!establishmentLookupError ||
    !hasLegalEntityOptions ||
    !!lookupError;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>New Customer</Trans>
        </PageTitle>
      </div>

      {lookupError && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            <span>{lookupError}</span>
            <Button
              type="button"
              variant="outline"
              onClick={retryLegalEntityLookup}
            >
              <Trans>Retry</Trans>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loadingLegalEntities && !lookupError && !hasLegalEntityOptions && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            <Trans>
              No legal entities are available for customer creation.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      {submitError && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {submitError}
          </AlertDescription>
        </Alert>
      )}

      {establishmentLookupError && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {establishmentLookupError}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="customer-legal-entity">
              <Trans>Legal Entity</Trans> *
            </FieldLabel>
            <Select
              name="legal_entity_id"
              required
              value={selectedLegalEntityId}
              onValueChange={(value) => updateField("legal_entity_id", value)}
            >
              <SelectTrigger
                id="customer-legal-entity"
                disabled={legalEntitySelectDisabled}
                aria-required="true"
                aria-invalid={fieldErrors.legal_entity_id ? true : undefined}
                aria-describedby={
                  fieldErrors.legal_entity_id
                    ? "customer-legal-entity-error"
                    : undefined
                }
              >
                <SelectValue placeholder={_(msg`Select legal entity...`)} />
              </SelectTrigger>
              <SelectContent>
                {legalEntities.map((legalEntity) => (
                  <SelectItem key={legalEntity.id} value={legalEntity.id}>
                    {legalEntity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.legal_entity_id ? (
              <FieldError id="customer-legal-entity-error">
                {fieldErrors.legal_entity_id}
              </FieldError>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="customer-establishment">
              <Trans>Establishment</Trans> *
            </FieldLabel>
            <Select
              name="establishment_id"
              required
              value={formData.establishment_id}
              onValueChange={(value) => updateField("establishment_id", value)}
            >
              <SelectTrigger
                id="customer-establishment"
                disabled={
                  !selectedLegalEntityId ||
                  loadingEstablishments ||
                  !!establishmentLookupError
                }
                aria-required="true"
                aria-invalid={fieldErrors.establishment_id ? true : undefined}
                aria-describedby={
                  fieldErrors.establishment_id
                    ? "customer-establishment-error"
                    : undefined
                }
              >
                <SelectValue placeholder={_(msg`Select establishment...`)} />
              </SelectTrigger>
              <SelectContent>
                {establishments.map((establishment) => (
                  <SelectItem key={establishment.id} value={establishment.id}>
                    {establishment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.establishment_id ? (
              <FieldError id="customer-establishment-error">
                {fieldErrors.establishment_id}
              </FieldError>
            ) : null}
          </Field>

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
              <FieldLabel htmlFor="customer-vat-id">
                <Trans>VAT ID</Trans>
              </FieldLabel>
              <Input
                id="customer-vat-id"
                name="vat_id"
                type="text"
                maxLength={32}
                autoComplete="off"
                value={formData.vat_id ?? ""}
                onChange={(e) => updateField("vat_id", e.target.value)}
              />
            </Field>

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
          <Button type="submit" disabled={cannotCreateCustomer}>
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
