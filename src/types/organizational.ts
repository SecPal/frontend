// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Type definitions for organizational structure and customer hierarchies.
 *
 * Based on ADR-007: Organizational Structure Hierarchy
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251126-organizational-structure-hierarchy.md
 */

/**
 * Organizational unit types for internal company structure
 */
export type OrganizationalUnitType =
  | "holding"
  | "company"
  | "region"
  | "branch"
  | "division"
  | "department"
  | "custom";

/**
 * Customer types for external customer hierarchies
 */
export type CustomerType = "corporate" | "regional" | "local" | "custom";

/**
 * Organizational unit representing internal company structure
 */
export interface OrganizationalUnit {
  id: string;
  type: OrganizationalUnitType;
  name: string;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  parent?: OrganizationalUnit | null;
  children?: OrganizationalUnit[];
  ancestors?: OrganizationalUnit[];
  descendants?: OrganizationalUnit[];
  created_at: string;
  updated_at: string;
}

/**
 * Customer representing external customer organization
 */
export interface Customer {
  id: string;
  name: string;
  customer_number: string;
  type: CustomerType;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  metadata?: Record<string, unknown> | null;
  parent?: Customer | null;
  children?: Customer[];
  ancestors?: Customer[];
  descendants?: Customer[];
  objects?: SecPalObject[];
  managed_by?: OrganizationalUnit | null;
  created_at: string;
  updated_at: string;
}

/**
 * Physical location/object belonging to a customer
 */
export interface SecPalObject {
  id: string;
  object_number: string;
  name: string;
  address?: string | null;
  gps_coordinates?: GpsCoordinates | null;
  metadata?: Record<string, unknown> | null;
  customer?: Customer;
  areas?: ObjectArea[];
  guard_books?: GuardBook[];
  created_at: string;
  updated_at: string;
}

/**
 * GPS coordinates for object location
 */
export interface GpsCoordinates {
  lat: number;
  lon: number;
}

/**
 * Sub-division of an object (e.g., Terminal 1, Parking Garage)
 */
export interface ObjectArea {
  id: string;
  name: string;
  description?: string | null;
  requires_separate_guard_book: boolean;
  geofence_boundaries?: GeofenceBoundary[] | null;
  metadata?: Record<string, unknown> | null;
  object?: SecPalObject;
  guard_book?: GuardBook | null;
  created_at: string;
  updated_at: string;
}

/**
 * Geofence boundary point for object areas
 */
export interface GeofenceBoundary {
  lat: number;
  lon: number;
}

/**
 * Guard book as continuous event stream container
 */
export interface GuardBook {
  id: string;
  title: string;
  description?: string | null;
  is_active: boolean;
  object?: SecPalObject | null;
  object_area?: ObjectArea | null;
  reports?: GuardBookReport[];
  created_at: string;
  updated_at: string;
}

/**
 * Guard book report (snapshot of events for a time period)
 */
export interface GuardBookReport {
  id: string;
  report_number: string;
  period_start: string;
  period_end: string;
  filter_criteria?: ReportFilterCriteria | null;
  total_events: number;
  generated_at: string;
  generated_by?: ReportGeneratedBy | null;
  report_data: ReportEventData[];
  created_at: string;
  updated_at: string;
}

/**
 * Filter criteria for guard book reports
 */
export interface ReportFilterCriteria {
  event_types?: string[];
  severity?: string;
}

/**
 * User who generated the report
 */
export interface ReportGeneratedBy {
  id: string;
  name: string;
}

/**
 * Event data stored in report (denormalized snapshot)
 */
export interface ReportEventData {
  entry_id: string;
  event_type: string;
  occurred_at: string;
  description: string;
  [key: string]: unknown;
}

/**
 * User's organizational scope for RBAC
 */
export interface UserOrganizationalScope {
  id: string;
  user_id: string;
  organizational_unit_id: string;
  organizational_unit: OrganizationalUnit;
  include_descendants: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Customer user access for RBAC
 */
export interface CustomerUserAccess {
  id: string;
  user_id: string;
  customer_id: string;
  customer: Customer;
  access_level: "corporate_wide" | "regional" | "local";
  include_descendants: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fine-grained object access for customer users
 */
export interface CustomerUserObjectAccess {
  id: string;
  user_id: string;
  object_id: string;
  object: SecPalObject;
  allowed_actions: ObjectAction[];
  created_at: string;
  updated_at: string;
}

/**
 * Allowed actions for object access
 */
export type ObjectAction =
  | "read_guard_book"
  | "read_reports"
  | "export_reports"
  | "create_entries";

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/**
 * Create organizational unit request
 */
export interface CreateOrganizationalUnitRequest {
  name: string;
  type: OrganizationalUnitType;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  parent_id?: string | null;
}

/**
 * Update organizational unit request
 */
export interface UpdateOrganizationalUnitRequest {
  name?: string;
  type?: OrganizationalUnitType;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create customer request
 */
export interface CreateCustomerRequest {
  name: string;
  customer_number: string;
  type: CustomerType;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  metadata?: Record<string, unknown> | null;
  parent_id?: string | null;
  managed_by_organizational_unit_id?: string | null;
}

/**
 * Update customer request
 */
export interface UpdateCustomerRequest {
  name?: string;
  type?: CustomerType;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  metadata?: Record<string, unknown> | null;
  managed_by_organizational_unit_id?: string | null;
}

/**
 * Create object request
 */
export interface CreateObjectRequest {
  customer_id: string;
  object_number: string;
  name: string;
  address?: string | null;
  gps_coordinates?: GpsCoordinates | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Update object request
 */
export interface UpdateObjectRequest {
  name?: string;
  address?: string | null;
  gps_coordinates?: GpsCoordinates | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create object area request
 */
export interface CreateObjectAreaRequest {
  name: string;
  description?: string | null;
  requires_separate_guard_book?: boolean;
  geofence_boundaries?: GeofenceBoundary[] | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Update object area request
 */
export interface UpdateObjectAreaRequest {
  name?: string;
  description?: string | null;
  requires_separate_guard_book?: boolean;
  geofence_boundaries?: GeofenceBoundary[] | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create guard book request
 */
export interface CreateGuardBookRequest {
  title: string;
  description?: string | null;
  object_id?: string | null;
  object_area_id?: string | null;
}

/**
 * Update guard book request
 */
export interface UpdateGuardBookRequest {
  title?: string;
  description?: string | null;
  is_active?: boolean;
}

/**
 * Generate guard book report request
 */
export interface GenerateReportRequest {
  period_start: string;
  period_end: string;
  filter_criteria?: ReportFilterCriteria | null;
}

/**
 * Filter parameters for listing organizational units
 */
export interface OrganizationalUnitFilters {
  type?: OrganizationalUnitType;
  parent_id?: string | null;
  per_page?: number;
  page?: number;
}

/**
 * Filter parameters for listing customers
 */
export interface CustomerFilters {
  type?: CustomerType;
  managed_by?: string;
  per_page?: number;
  page?: number;
}

/**
 * Filter parameters for listing objects
 */
export interface ObjectFilters {
  customer_id?: string;
  per_page?: number;
  page?: number;
}

/**
 * Filter parameters for listing guard books
 */
export interface GuardBookFilters {
  object_id?: string;
  object_area_id?: string;
  is_active?: boolean;
  per_page?: number;
  page?: number;
}
