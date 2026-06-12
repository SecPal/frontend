// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer Detail Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ArrowLeft, Edit, List, MapPinned, Trash2 } from "lucide-react";
import { getCustomer, deleteCustomer } from "../../services/customersApi";
import type { Customer } from "../../types/customers";
import {
  DescriptionList,
  DescriptionDetails,
  DescriptionTerm,
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  LinkButton,
  PageLink,
  PageText,
  PageTitle,
  Spinner,
  StatusBadge,
} from "../CustomerSites/ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import { isSafeMailtoTarget, isSafeTelTarget } from "../../utils/safeUrl";

export default function CustomerDetail() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    async function loadCustomer() {
      setLoading(true);
      setLoadError(null);
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const data = await getCustomer(id);
        setCustomer(data);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : _(msg`Failed to load customer`)
        );
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-sm text-zinc-600 dark:text-zinc-300">
        <Spinner aria-label={_(msg`Loading...`)} />
        <span>
          <Trans>Loading...</Trans>
        </span>
      </div>
    );
  }

  if (loadError || !customer) {
    return (
      <div className="text-center py-12">
        <PageText className="text-red-600 dark:text-red-400">
          {loadError || <Trans>Customer not found</Trans>}
        </PageText>
        <LinkButton to="/customers" variant="outline" className="mt-4">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Back to Customers</Trans>
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageTitle>{customer.name}</PageTitle>
          <PageText className="mt-1 text-zinc-500">
            {customer.customer_number}
          </PageText>
        </div>
        <div className="flex gap-2">
          <StatusBadge color={customer.is_active ? "lime" : "zinc"}>
            {customer.is_active ? (
              <Trans>Active</Trans>
            ) : (
              <Trans>Inactive</Trans>
            )}
          </StatusBadge>
        </div>
      </div>

      <div className="space-y-8">
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
              <Trans>City</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer.billing_address.postal_code}{" "}
              {customer.billing_address.city}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Country</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer.billing_address.country}
            </DescriptionDetails>
          </DescriptionList>
        </div>

        {/* Contact Information */}
        {customer.contact && (
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Contact Person</Trans>
            </PageTitle>
            <DescriptionList>
              {customer.contact.name && (
                <>
                  <DescriptionTerm>
                    <Trans>Name</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {customer.contact.name}
                  </DescriptionDetails>
                </>
              )}

              {customer.contact.email && (
                <>
                  <DescriptionTerm>
                    <Trans>Email</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {isSafeMailtoTarget(customer.contact.email) ? (
                      <PageLink to={`mailto:${customer.contact.email}`}>
                        {customer.contact.email}
                      </PageLink>
                    ) : (
                      customer.contact.email
                    )}
                  </DescriptionDetails>
                </>
              )}

              {customer.contact.phone && (
                <>
                  <DescriptionTerm>
                    <Trans>Phone</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {isSafeTelTarget(customer.contact.phone) ? (
                      <PageLink to={`tel:${customer.contact.phone}`}>
                        {customer.contact.phone}
                      </PageLink>
                    ) : (
                      customer.contact.phone
                    )}
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Notes</Trans>
            </PageTitle>
            <PageText className="whitespace-pre-wrap">
              {customer.notes}
            </PageText>
          </div>
        )}

        {/* Sites */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Sites</Trans>
          </PageTitle>
          <PageText className="mb-4">
            <Plural
              value={customer.sites_count || 0}
              zero="This customer has no sites."
              one="This customer has # site."
              other="This customer has # sites."
            />
          </PageText>
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

      {/* Delete Confirmation Dialog */}
      {capabilities.actions.customers.delete && (
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
                  <Alert className="mb-4 border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                    <AlertDescription>{deleteError}</AlertDescription>
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
