// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

// OpenAPI component type output for frontend API aliases.
// Source: contracts/docs/openapi.yaml

export interface components {
  schemas: {
    BootstrapClientPlatform: "android" | "browser";
    BootstrapVersion: "v1";
    NotificationChannel: "android_fcm" | "web_push";
    NotificationChannelFeatureFlags: {
      android_fcm: boolean;
      web_push: boolean;
    };
    AndroidFcmPublicRuntimeMetadata: {
      api_key: string;
      project_id: string;
      application_id: string;
      sender_id: string;
    };
    WebPushPublicRuntimeMetadata: {
      vapid_public_key: string;
    };
    AndroidFcmNotificationChannelRuntime: {
      channel: "android_fcm";
      metadata_revision: number;
      public_runtime_metadata: components["schemas"]["AndroidFcmPublicRuntimeMetadata"];
    };
    WebPushNotificationChannelRuntime: {
      channel: "web_push";
      metadata_revision: number;
      public_runtime_metadata: components["schemas"]["WebPushPublicRuntimeMetadata"];
    };
    NotificationChannelRuntimeMetadata: {
      android_fcm?: components["schemas"]["AndroidFcmNotificationChannelRuntime"];
      web_push?: components["schemas"]["WebPushNotificationChannelRuntime"];
    };
    BootstrapInstanceMetadata: {
      display_name: string;
    };
    BootstrapFeatureFlags: {
      password_login: boolean;
      passkey_login: boolean;
      managed_android_enrollment: boolean;
      notification_channels: components["schemas"]["NotificationChannelFeatureFlags"];
    };
    BootstrapCompatibility: {
      bootstrap_version: components["schemas"]["BootstrapVersion"];
      schema_version: number;
      minimum_supported_app_version: string;
      minimum_supported_app_build: number;
    };
    BootstrapConfiguration: {
      client_platform: components["schemas"]["BootstrapClientPlatform"];
      api_base_url: string;
      instance: components["schemas"]["BootstrapInstanceMetadata"];
      compatibility: components["schemas"]["BootstrapCompatibility"];
      features: components["schemas"]["BootstrapFeatureFlags"];
      notification_channels?: components["schemas"]["NotificationChannelRuntimeMetadata"];
    };
    BootstrapResponse: {
      data: components["schemas"]["BootstrapConfiguration"];
    };
    OrganizationalUnitType:
      | "holding"
      | "company"
      | "region"
      | "branch"
      | "division"
      | "department"
      | "custom";
    OrganizationalUnitPermissions: {
      create_child: boolean;
      update: boolean;
      delete: boolean;
      manage_scopes: boolean;
    };
    OrganizationalUnit: {
      id: string;
      type: components["schemas"]["OrganizationalUnitType"];
      name: string;
      custom_type_name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      is_legal_entity: boolean;
      is_establishment: boolean;
      is_active?: boolean;
      is_assignable?: boolean;
      parent?: components["schemas"]["OrganizationalUnit"] | null;
      permissions?: components["schemas"]["OrganizationalUnitPermissions"];
      children?: components["schemas"]["OrganizationalUnit"][];
      ancestors?: components["schemas"]["OrganizationalUnit"][];
      descendants?: components["schemas"]["OrganizationalUnit"][];
      created_at: string;
      updated_at: string;
    };
    OrganizationalUnitCreateRequest: {
      name: string;
      type: components["schemas"]["OrganizationalUnitType"];
      custom_type_name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      parent_id?: string | null;
      is_legal_entity?: boolean;
      is_establishment?: boolean;
      is_active?: boolean;
      is_assignable?: boolean;
    };
    OrganizationalUnitUpdateRequest: {
      name?: string;
      type?: components["schemas"]["OrganizationalUnitType"];
      custom_type_name?: string | null;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      is_legal_entity?: boolean;
      is_establishment?: boolean;
      is_active?: boolean;
      is_assignable?: boolean;
    };
    OrganizationalUnitPaginationMeta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      root_unit_ids: string[];
    };
    OrganizationalUnitCollectionResponse: {
      data: components["schemas"]["OrganizationalUnit"][];
      meta: components["schemas"]["OrganizationalUnitPaginationMeta"];
    };
    Address: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
      latitude?: number | null;
      longitude?: number | null;
    };
    Contact: {
      name: string;
      email?: string | null;
      phone?: string | null;
      position?: string | null;
    };
    Customer: {
      id: string;
      customer_number: string;
      legal_entity_id: string;
      vat_id?: string | null;
      name: string;
      billing_address: components["schemas"]["Address"];
      is_active: boolean;
      sites_count?: number;
      customer_establishments: components["schemas"]["CustomerEstablishment"][];
      created_at: string;
      updated_at: string;
      deleted_at?: string | null;
    };
    LegalEntityLookup: {
      id: string;
      name: string;
    };
    EstablishmentLookup: {
      id: string;
      name: string;
    };
    CustomerEstablishment: {
      id: string;
      customer_id: string;
      establishment_id: string;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      comments?: string | null;
      created_at: string;
      updated_at: string;
    };
    CustomerEstablishmentCreateRequest: {
      customer_id: string;
      establishment_id: string;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      comments?: string | null;
    };
    CustomerEstablishmentUpdateRequest: {
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      comments?: string | null;
    };
    CustomerCreateRequest: {
      legal_entity_id: string;
      vat_id?: string | null;
      name: string;
      billing_address: components["schemas"]["Address"];
      is_active?: boolean;
    };
    CustomerUpdateRequest: {
      legal_entity_id?: string;
      vat_id?: string | null;
      name?: string;
      billing_address?: components["schemas"]["Address"];
      is_active?: boolean;
    };
  };
}
