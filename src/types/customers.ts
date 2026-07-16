// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Customer & Site Management Types
 * Generated from contracts/docs/openapi.yaml (Epic #210)
 */

import type {
  Address as ApiAddress,
  Contact as ApiContact,
  CreateSiteRequest as ApiCreateSiteRequest,
  CreateCustomerRequest as ApiCreateCustomerRequest,
  Customer as ApiCustomer,
  CustomerEstablishmentLookup as ApiCustomerEstablishmentLookup,
  CustomerEstablishmentRelationship as ApiCustomerEstablishmentRelationship,
  CustomerLegalEntityLookup as ApiCustomerLegalEntityLookup,
  Site as ApiSite,
  SiteFilters as ApiSiteFilters,
  SiteType as ApiSiteType,
  UpdateSiteRequest as ApiUpdateSiteRequest,
  UpdateCustomerRequest as ApiUpdateCustomerRequest,
} from "./api/customers";

// ============================================================================
// Common Schemas
// ============================================================================

export type Address = ApiAddress;
export type Contact = ApiContact;

// ============================================================================
// Customer
// ============================================================================

export type Customer = ApiCustomer;

export type CreateCustomerRequest = ApiCreateCustomerRequest;
export type UpdateCustomerRequest = ApiUpdateCustomerRequest;

export interface CustomerFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export type CustomerLegalEntityLookup = ApiCustomerLegalEntityLookup;
export type CustomerEstablishmentLookup = ApiCustomerEstablishmentLookup;
export type CustomerEstablishmentRelationship =
  ApiCustomerEstablishmentRelationship;

// ============================================================================
// Site (de: Objekt)
// ============================================================================

export type SiteType = ApiSiteType;
export type Site = ApiSite;
export type CreateSiteRequest = ApiCreateSiteRequest;
export type UpdateSiteRequest = ApiUpdateSiteRequest;
export type SiteFilters = ApiSiteFilters;

// ============================================================================
// Customer Assignment
// ============================================================================

export interface CustomerAssignment {
  id: string;
  customer_id: string;
  user_id: string;
  role: string; // Flexible: "Key Account Manager", "Billing Contact", etc.
  valid_from?: string | null; // ISO 8601 date
  valid_until?: string | null; // ISO 8601 date
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerAssignmentRequest {
  user_id: string;
  role: string;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerAssignmentRequest {
  role?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface CustomerAssignmentFilters {
  customer_id?: string;
  user_id?: string;
  role?: string;
  active_only?: boolean;
  page?: number;
  per_page?: number;
}

// ============================================================================
// Site Assignment
// ============================================================================

export interface SiteAssignment {
  id: string;
  site_id: string;
  user_id: string;
  role: string; // Flexible: "Site Manager", "Account Manager", etc.
  is_primary: boolean;
  valid_from?: string | null; // ISO 8601 date
  valid_until?: string | null; // ISO 8601 date
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSiteAssignmentRequest {
  user_id: string;
  role: string;
  is_primary?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface UpdateSiteAssignmentRequest {
  role?: string;
  is_primary?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}

export interface SiteAssignmentFilters {
  site_id?: string;
  user_id?: string;
  role?: string;
  is_primary?: boolean;
  active_only?: boolean;
  page?: number;
  per_page?: number;
}

// ============================================================================
// Cost Center
// ============================================================================

export interface CostCenter {
  id: string;
  site_id: string;
  code: string;
  name: string;
  activity_type?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateCostCenterRequest {
  code: string;
  name: string;
  activity_type?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface UpdateCostCenterRequest {
  code?: string;
  name?: string;
  activity_type?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface CostCenterFilters {
  search?: string;
  is_active?: boolean;
  activity_type?: string;
  active_only?: boolean;
  page?: number;
  per_page?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}
