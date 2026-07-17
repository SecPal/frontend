// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Customer Detail Page
 * Epic #210 - Customer & Site Management
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ArrowLeft, Edit, List, MapPinned, Trash2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";
import { SectionSkeleton } from "@/ui";
import { deleteCustomer, getCustomer } from "../../services/customersApi";
import {
  listCustomerEstablishments,
  listEstablishmentLookups,
} from "../../services/customerDomainApi";
import type {
  Customer,
  CustomerEstablishment,
  EstablishmentLookup,
} from "@/types/api/customers";
import {
  Alert,
  AlertDescription,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageLink as PageLink,
  CustomerSitePageText as PageText,
  CustomerSitePageTitle as PageTitle,
  CustomerSiteStatusBadge as StatusBadge,
} from "@/ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import { isSafeMailtoTarget, isSafeTelTarget } from "../../utils/safeUrl";

function getCustomerSitesCount(customer: Customer): number | null {
  return typeof customer.sites_count === "number" ? customer.sites_count : null;
}

function CustomerDetailSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-8">
      <SectionSkeleton loadingLabel={loadingLabel} rows={3} />
      <SectionSkeleton loadingLabel={loadingLabel} rows={3} decorative />
      <SectionSkeleton loadingLabel={loadingLabel} rows={2} decorative />
    </div>
  );
}

export default function CustomerDetail() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerEstablishments, setCustomerEstablishments] = useState<
    CustomerEstablishment[]
  >([]);
  const [establishmentLookups, setEstablishmentLookups] = useState<
    EstablishmentLookup[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    // Capture a per-`id` cancellation flag so that a slow fetch for the
    // *previous* id cannot overwrite state after the user has already
    // navigated to a new `/customers/:id`. Without this guard, a
    // late-resolving setCustomer would render the previous record's name
    // and customer_number under the new URL — and its destructive
    // actions (Edit, Delete) would operate on the wrong record.
    let cancelled = false;

    async function loadCustomer() {
      // Drop the previous customer *synchronously* on every `id` change.
      // The skeleton is gated on `customer === null`, so without this
      // reset a param-only navigation between `/customers/:id` routes
      // would keep the previous customer's details — including the
      // destructive Delete action — visible under the new URL until the
      // new fetch resolved, letting a user act on the wrong record
      // during that window.
      setCustomer(null);
      setLoading(true);
      setLoadError(null);
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const data = await getCustomer(id);
        const [links, lookups] = await Promise.all([
          listCustomerEstablishments({ customer_id: id, per_page: 100 }),
          listEstablishmentLookups(data.legal_entity_id),
        ]);
        if (cancelled) return;
        setCustomer(data);
        setCustomerEstablishments(links.data);
        setEstablishmentLookups(lookups);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : _(msg`Failed to load customer`)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [_, id]);

  async function handleDelete() {
    if (!customer) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteCustomer(customer.id);
      navigate("/customers");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : _(msg`Failed to delete customer`)
      );
      setDeleting(false);
      // Keep dialog open to show error message
    }
  }

  const isInitialLoading = loading && customer === null;
  const sitesCount = customer ? getCustomerSitesCount(customer) : null;

  if (!isInitialLoading && (loadError || !customer)) {
    return (
      <div className="py-12 text-center">
        <Alert className="mx-auto max-w-md border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {loadError || <Trans>Customer not found</Trans>}
          </AlertDescription>
        </Alert>
        <LinkButton to="/customers" variant="outline" className="mt-4">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Back to Customers</Trans>
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageTitle>
            {customer ? customer.name : <Trans>Customer</Trans>}
          </PageTitle>
          {customer ? (
            <PageText className="text-muted-foreground mt-1">
              {customer.customer_number}
            </PageText>
          ) : (
            <Skeleton className="mt-3 h-4 w-40" />
          )}
        </div>
        <div className="flex gap-2">
          {customer ? (
            <StatusBadge color={customer.is_active ? "lime" : "zinc"}>
              {customer.is_active ? (
                <Trans>Active</Trans>
              ) : (
                <Trans>Inactive</Trans>
              )}
            </StatusBadge>
          ) : (
            <Skeleton className="h-6 w-20" />
          )}
        </div>
      </div>

      {customer ? (
        <div className="space-y-8">
          {/* Legal Entity */}
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Legal Entity</Trans>
            </PageTitle>
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Legal Entity ID</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {typeof customer.legal_entity_id === "string" &&
                customer.legal_entity_id.trim().length > 0 ? (
                  customer.legal_entity_id
                ) : (
                  <span className="text-destructive">
                    <Trans>
                      This customer requires a Legal Entity assignment.
                    </Trans>
                  </span>
                )}
              </DescriptionDetails>
            </DescriptionList>
          </div>

          {/* Billing Address */}
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Billing Address</Trans>
            </PageTitle>
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Street</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {customer.billing_address.street}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Postal Code</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {customer.billing_address.postal_code}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>City</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {customer.billing_address.city}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Country</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {customer.billing_address.country}
              </DescriptionDetails>

              {customer.vat_id ? (
                <>
                  <DescriptionTerm>
                    <Trans>VAT ID</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>{customer.vat_id}</DescriptionDetails>
                </>
              ) : null}
            </DescriptionList>
          </div>

          <div>
            <PageTitle level={2} className="mb-2">
              <Trans>Establishments and local contacts</Trans>
            </PageTitle>
            <PageText className="mb-4 text-muted-foreground">
              <Trans>
                These contact details apply only to their establishment.
              </Trans>
            </PageText>
            {customerEstablishments.length === 0 ? (
              <PageText>
                <Trans>No establishments assigned.</Trans>
              </PageText>
            ) : (
              <div className="space-y-4">
                {customerEstablishments.map((assignment) => {
                  const establishmentName =
                    establishmentLookups.find(
                      (lookup) => lookup.id === assignment.establishment_id
                    )?.name ?? assignment.establishment_id;
                  return (
                    <section
                      key={assignment.id}
                      aria-labelledby={`establishment-${assignment.id}`}
                      className="rounded-md border border-border p-4"
                    >
                      <h3
                        id={`establishment-${assignment.id}`}
                        className="mb-3 font-semibold"
                      >
                        {establishmentName}
                      </h3>
                      <DescriptionList>
                        {assignment.contact_name ? (
                          <>
                            <DescriptionTerm>
                              <Trans>Local contact</Trans>
                            </DescriptionTerm>
                            <DescriptionDetails>
                              {assignment.contact_name}
                            </DescriptionDetails>
                          </>
                        ) : null}
                        {assignment.email ? (
                          <>
                            <DescriptionTerm>
                              <Trans>Local email</Trans>
                            </DescriptionTerm>
                            <DescriptionDetails>
                              {isSafeMailtoTarget(assignment.email) ? (
                                <PageLink to={`mailto:${assignment.email}`}>
                                  {assignment.email}
                                </PageLink>
                              ) : (
                                assignment.email
                              )}
                            </DescriptionDetails>
                          </>
                        ) : null}
                        {assignment.phone ? (
                          <>
                            <DescriptionTerm>
                              <Trans>Local phone</Trans>
                            </DescriptionTerm>
                            <DescriptionDetails>
                              {isSafeTelTarget(assignment.phone) ? (
                                <PageLink to={`tel:${assignment.phone}`}>
                                  {assignment.phone}
                                </PageLink>
                              ) : (
                                assignment.phone
                              )}
                            </DescriptionDetails>
                          </>
                        ) : null}
                        {assignment.comments ? (
                          <>
                            <DescriptionTerm>
                              <Trans>Local comments</Trans>
                            </DescriptionTerm>
                            <DescriptionDetails className="whitespace-pre-wrap">
                              {assignment.comments}
                            </DescriptionDetails>
                          </>
                        ) : null}
                      </DescriptionList>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sites */}
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Sites</Trans>
            </PageTitle>
            {sitesCount === null ? (
              <PageText className="mb-4">
                <Trans>This customer's site count is unavailable.</Trans>
              </PageText>
            ) : (
              <PageText className="mb-4">
                <Plural
                  value={sitesCount}
                  zero="This customer has no sites."
                  one="This customer has # site."
                  other="This customer has # sites."
                />
              </PageText>
            )}
            <LinkButton to={`/sites/customer/${customer.id}`} variant="outline">
              <MapPinned className="size-4" aria-hidden="true" />
              <Trans>View Sites</Trans>
            </LinkButton>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t">
            {capabilities.actions.customers.update && (
              <LinkButton to={`/customers/${customer.id}/edit`}>
                <Edit className="size-4" aria-hidden="true" />
                <Trans>Edit</Trans>
              </LinkButton>
            )}
            {capabilities.actions.customers.delete && (
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteError(null);
                  setShowDeleteDialog(true);
                }}
                disabled={deleting}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <Trans>Delete</Trans>
              </Button>
            )}
            <LinkButton to="/customers" variant="outline">
              <List className="size-4" aria-hidden="true" />
              <Trans>Back to List</Trans>
            </LinkButton>
          </div>
        </div>
      ) : (
        <>
          <CustomerDetailSkeleton
            loadingLabel={_(msg`Loading customer details`)}
          />
          <div className="mt-8 flex gap-4 border-t pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <LinkButton to="/customers" variant="outline">
              <List className="size-4" aria-hidden="true" />
              <Trans>Back to List</Trans>
            </LinkButton>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {customer && capabilities.actions.customers.delete && (
        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
        >
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>
                <Trans>Delete Customer</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Are you sure you want to delete "{customer.name}"? This action
                  cannot be undone.
                </Trans>
              </DialogDescription>
              <DialogBody>
                {deleteError && (
                  <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
                    <AlertDescription className="text-destructive">
                      {deleteError}
                    </AlertDescription>
                  </Alert>
                )}
              </DialogBody>
              <DialogActions>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={deleting}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {deleting ? (
                    <Trans>Deleting...</Trans>
                  ) : (
                    <Trans>Delete</Trans>
                  )}
                </Button>
              </DialogActions>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
}
