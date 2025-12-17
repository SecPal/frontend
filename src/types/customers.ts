// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer & Site Management Types
 * Generated from contracts/docs/openapi.yaml (Epic #210)
 */

// ============================================================================
// Common Schemas
// ============================================================================

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string; // ISO 3166-1 alpha-2
  latitude?: number | null;
  longitude?: number | null;
}

export interface Contact {
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
}

// ============================================================================
// Customer
// ============================================================================

export interface Customer {
  id: string;
  customer_number: string; // KD-YYYY-####
  name: string;
  billing_address: Address;
  contact?: Contact | null;
  is_active: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  sites_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateCustomerRequest {
  name: string;
  billing_address: Address;
  contact?: Contact | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface UpdateCustomerRequest {
  name?: string;
  billing_address?: Address;
  contact?: Contact | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface CustomerFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

// ============================================================================
// Site
// ============================================================================

export type SiteType = "permanent" | "temporary";

export interface Site {
  id: string;
  customer_id: string;
  organizational_unit_id: string;
  site_number: string; // OBJ-YYYY-####
  name: string;
  type: SiteType;
  address: Address;
  contact?: Contact | null;
  access_instructions?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active: boolean;
  valid_from?: string | null; // ISO 8601 date
  valid_until?: string | null; // ISO 8601 date
  is_expired: boolean;
  full_address: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateSiteRequest {
  customer_id: string;
  organizational_unit_id: string;
  name: string;
  type: SiteType;
  address: Address;
  contact?: Contact | null;
  access_instructions?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface UpdateSiteRequest {
  customer_id?: string;
  organizational_unit_id?: string;
  name?: string;
  type?: SiteType;
  address?: Address;
  contact?: Contact | null;
  access_instructions?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface SiteFilters {
  customer_id?: string;
  organizational_unit_id?: string;
  type?: SiteType;
  is_active?: boolean;
  currently_valid?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

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
