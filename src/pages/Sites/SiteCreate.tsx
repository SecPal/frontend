// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Site Create Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { FormSkeleton } from "@/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import {
  createSite,
  listCustomerEstablishmentOptions,
  listCustomers,
} from "../../services/customersApi";
import { listCustomerLegalEntities } from "../../services/customerLegalEntitiesApi";
import type {
  CreateSiteRequest,
  Address,
  Contact,
  SiteType,
  Customer,
  CustomerEstablishmentLookup,
  CustomerLegalEntityLookup,
} from "../../types/customers";
import {
  Alert,
  AlertDescription,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";

export default function SiteCreate() {
  const navigate = useNavigate();
  const { _ } = useLingui();
  const { customerId } = useParams<{ customerId?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [legalEntities, setLegalEntities] = useState<
    CustomerLegalEntityLookup[]
  >([]);
  const [establishments, setEstablishments] = useState<
    CustomerEstablishmentLookup[]
  >([]);
  const [loadingData, setLoadingData] = useState(true);
  const [establishmentLookupError, setEstablishmentLookupError] = useState<
    string | null
  >(null);

  const [formData, setFormData] = useState<CreateSiteRequest>({
    customer_id: customerId || "",
    establishment_id: "",
    name: "",
    type: "permanent",
    address: {
      street: "",
      city: "",
      postal_code: "",
      country: "DE",
    },
    is_active: true,
  });

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const [customersData, legalEntitiesData] = await Promise.all([
          listCustomers({ per_page: 100 }),
          listCustomerLegalEntities(),
        ]);
        setCustomers(customersData.data);
        setLegalEntities(legalEntitiesData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : _(msg`Failed to load required data`)
        );
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [_]);

  useEffect(() => {
    let cancelled = false;
    const customer = customers.find(
      (candidate) => candidate.id === formData.customer_id
    );

    if (!customer) {
      return () => {
        cancelled = true;
      };
    }

    void listCustomerEstablishmentOptions(customer.legal_entity_id)
      .then((options) => {
        if (!cancelled) {
          setEstablishments(options);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEstablishments([]);
          setFormData((current) => ({
            ...current,
            establishment_id: "",
          }));
          setEstablishmentLookupError(
            err instanceof Error
              ? err.message
              : _(msg`Failed to load establishments`)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [_, customers, formData.customer_id]);

  function updateField(field: keyof CreateSiteRequest, value: unknown) {
    if (field === "customer_id") {
      setError(null);
      setEstablishmentLookupError(null);
      setEstablishments([]);
      setFormData((currentFormData) => ({
        ...currentFormData,
        customer_id: String(value),
        establishment_id: "",
      }));
      return;
    }

    setFormData((currentFormData) => ({
      ...currentFormData,
      [field]: value,
    }));
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === formData.customer_id
  );
  const selectedLegalEntityName = legalEntities.find(
    (legalEntity) => legalEntity.id === selectedCustomer?.legal_entity_id
  )?.name;

  function updateAddress(field: keyof Address, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      address: {
        ...currentFormData.address,
        [field]: value,
      },
    }));
  }

  function updateContact(field: keyof Contact, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      contact: {
        ...(currentFormData.contact || {}),
        [field]: value,
      } as Contact,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      // Clean up the data before sending
      const dataToSend: CreateSiteRequest = {
        customer_id: formData.customer_id,
        establishment_id: formData.establishment_id,
        name: formData.name,
        type: formData.type,
        address: formData.address,
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

      const site = await createSite(dataToSend);
      navigate(`/sites/${site.id}`);
    } catch (err: unknown) {
      // Parse validation errors from Laravel API
      const error = err as Error & { errors?: Record<string, string[]> };
      if (error.errors && typeof error.errors === "object") {
        setFieldErrors(error.errors);
        setError(_(msg`Please correct the errors below.`));
      } else {
        setError(error.message || _(msg`Failed to create site`));
      }
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <PageTitle>
            <Trans>New Site</Trans>
          </PageTitle>
        </div>
        <FormSkeleton
          loadingLabel={_(msg`Loading site lookup data`)}
          fields={10}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>New Site</Trans>
        </PageTitle>
      </div>

      {error && (
        <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="site-customer">
              <Trans>Customer</Trans> *
            </FieldLabel>
            <Select
              name="customer_id"
              required
              value={formData.customer_id}
              onValueChange={(value) => updateField("customer_id", value)}
            >
              <SelectTrigger
                id="site-customer"
                aria-invalid={fieldErrors.customer_id ? true : undefined}
                aria-describedby={
                  fieldErrors.customer_id ? "site-customer-error" : undefined
                }
              >
                <SelectValue placeholder={_(msg`Select customer...`)} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.customer_number} - {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.customer_id && (
              <FieldError id="site-customer-error">
                {fieldErrors.customer_id.join(", ")}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="site-legal-entity">
              <Trans>Legal Entity</Trans>
            </FieldLabel>
            <Input
              id="site-legal-entity"
              value={selectedLegalEntityName ?? ""}
              placeholder="—"
              readOnly
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="site-establishment">
              <Trans>Establishment</Trans> *
            </FieldLabel>
            <Select
              name="establishment_id"
              required
              disabled={!selectedCustomer || Boolean(establishmentLookupError)}
              value={formData.establishment_id}
              onValueChange={(value) => updateField("establishment_id", value)}
            >
              <SelectTrigger
                id="site-establishment"
                aria-invalid={fieldErrors.establishment_id ? true : undefined}
                aria-describedby={
                  fieldErrors.establishment_id
                    ? "site-establishment-error"
                    : establishmentLookupError
                      ? "site-establishment-lookup-error"
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
            {fieldErrors.establishment_id && (
              <FieldError id="site-establishment-error">
                {fieldErrors.establishment_id.join(", ")}
              </FieldError>
            )}
            {establishmentLookupError && (
              <FieldError id="site-establishment-lookup-error">
                {establishmentLookupError}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="site-name">
              <Trans>Site Name</Trans> *
            </FieldLabel>
            <Input
              id="site-name"
              name="name"
              type="text"
              required
              value={formData.name}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={
                fieldErrors.name ? "site-name-error" : undefined
              }
              onChange={(e) => updateField("name", e.target.value)}
            />
            {fieldErrors.name && (
              <FieldError id="site-name-error">
                {fieldErrors.name.join(", ")}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="site-type">
              <Trans>Type</Trans> *
            </FieldLabel>
            <Select
              name="type"
              required
              value={formData.type}
              onValueChange={(value) => updateField("type", value as SiteType)}
            >
              <SelectTrigger id="site-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">{_(msg`Permanent`)}</SelectItem>
                <SelectItem value="temporary">{_(msg`Temporary`)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        {/* Address */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Address</Trans>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="site-street">
                <Trans>Street</Trans> *
              </FieldLabel>
              <Input
                id="site-street"
                name="street"
                type="text"
                required
                autoComplete="street-address"
                value={formData.address.street}
                aria-invalid={fieldErrors["address.street"] ? true : undefined}
                aria-describedby={
                  fieldErrors["address.street"]
                    ? "site-street-error"
                    : undefined
                }
                onChange={(e) => updateAddress("street", e.target.value)}
              />
              {fieldErrors["address.street"] && (
                <FieldError id="site-street-error">
                  {fieldErrors["address.street"].join(", ")}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="site-city">
                <Trans>City</Trans> *
              </FieldLabel>
              <Input
                id="site-city"
                name="city"
                type="text"
                required
                autoComplete="address-level2"
                value={formData.address.city}
                aria-invalid={fieldErrors["address.city"] ? true : undefined}
                aria-describedby={
                  fieldErrors["address.city"] ? "site-city-error" : undefined
                }
                onChange={(e) => updateAddress("city", e.target.value)}
              />
              {fieldErrors["address.city"] && (
                <FieldError id="site-city-error">
                  {fieldErrors["address.city"].join(", ")}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="site-postal-code">
                <Trans>Postal Code</Trans> *
              </FieldLabel>
              <Input
                id="site-postal-code"
                name="postal_code"
                type="text"
                required
                autoComplete="postal-code"
                value={formData.address.postal_code}
                aria-invalid={
                  fieldErrors["address.postal_code"] ? true : undefined
                }
                aria-describedby={
                  fieldErrors["address.postal_code"]
                    ? "site-postal-code-error"
                    : undefined
                }
                onChange={(e) => updateAddress("postal_code", e.target.value)}
              />
              {fieldErrors["address.postal_code"] && (
                <FieldError id="site-postal-code-error">
                  {fieldErrors["address.postal_code"].join(", ")}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="site-country">
                <Trans>Country</Trans> *
              </FieldLabel>
              <Select
                name="country"
                required
                value={formData.address.country}
                onValueChange={(value) => updateAddress("country", value)}
              >
                <SelectTrigger
                  id="site-country"
                  aria-invalid={
                    fieldErrors["address.country"] ? true : undefined
                  }
                  aria-describedby={
                    fieldErrors["address.country"]
                      ? "site-country-error"
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DE">{_(msg`Germany`)}</SelectItem>
                  <SelectItem value="AT">{_(msg`Austria`)}</SelectItem>
                  <SelectItem value="CH">{_(msg`Switzerland`)}</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors["address.country"] && (
                <FieldError id="site-country-error">
                  {fieldErrors["address.country"].join(", ")}
                </FieldError>
              )}
            </Field>
          </FieldGroup>
        </div>

        {/* Contact Person */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Contact Person</Trans>{" "}
            <span className="text-muted-foreground">
              <Trans>(Optional)</Trans>
            </span>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="site-contact-name">
                <Trans>Name</Trans>
              </FieldLabel>
              <Input
                id="site-contact-name"
                name="contact_name"
                type="text"
                autoComplete="name"
                value={formData.contact?.name || ""}
                aria-invalid={fieldErrors["contact.name"] ? true : undefined}
                aria-describedby={
                  fieldErrors["contact.name"]
                    ? "site-contact-name-error"
                    : undefined
                }
                onChange={(e) => updateContact("name", e.target.value)}
              />
              {fieldErrors["contact.name"] && (
                <FieldError id="site-contact-name-error">
                  {fieldErrors["contact.name"].join(", ")}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="site-contact-email">
                <Trans>Email</Trans>
              </FieldLabel>
              <Input
                id="site-contact-email"
                name="contact_email"
                type="email"
                autoComplete="email"
                value={formData.contact?.email || ""}
                aria-invalid={fieldErrors["contact.email"] ? true : undefined}
                aria-describedby={
                  fieldErrors["contact.email"]
                    ? "site-contact-email-error"
                    : undefined
                }
                onChange={(e) => updateContact("email", e.target.value)}
              />
              {fieldErrors["contact.email"] && (
                <FieldError id="site-contact-email-error">
                  {fieldErrors["contact.email"].join(", ")}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="site-contact-phone">
                <Trans>Phone</Trans>
              </FieldLabel>
              <Input
                id="site-contact-phone"
                name="contact_phone"
                type="tel"
                autoComplete="tel"
                value={formData.contact?.phone || ""}
                aria-invalid={fieldErrors["contact.phone"] ? true : undefined}
                aria-describedby={
                  fieldErrors["contact.phone"]
                    ? "site-contact-phone-error"
                    : undefined
                }
                onChange={(e) => updateContact("phone", e.target.value)}
              />
              {fieldErrors["contact.phone"] && (
                <FieldError id="site-contact-phone-error">
                  {fieldErrors["contact.phone"].join(", ")}
                </FieldError>
              )}
            </Field>
          </FieldGroup>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" disabled={loading}>
            {loading ? <Trans>Creating...</Trans> : <Trans>Create Site</Trans>}
          </Button>
          <LinkButton to="/sites" variant="outline">
            <Trans>Cancel</Trans>
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
