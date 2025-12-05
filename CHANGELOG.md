<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Console errors detected by Lighthouse CI** (#311)
  - Changed non-critical `console.error` to `console.warn` for graceful degradation:
    - Analytics singleton initialization (browsers without IndexedDB support)
    - Analytics event tracking and sync failures
    - Web Vitals initialization failures
  - Removed verbose Web Vitals initialization log

### Added

- **Lighthouse CI for automated performance testing** (#308)
  - GitHub Actions workflow runs Lighthouse audits on every PR and push to main
  - Performance budgets based on Core Web Vitals thresholds:
    - LCP (Largest Contentful Paint): < 2.5s (error threshold)
    - CLS (Cumulative Layout Shift): < 0.1 (error threshold)
    - TBT (Total Blocking Time): < 200ms (warning threshold)
  - JavaScript console error detection (zero tolerance - fails on any JS error)
  - Accessibility and Best Practices audits with 90% minimum score
  - PR comments with Lighthouse scores and report links
  - Temporary public storage for report sharing
  - Tests for configuration validation

- **Mobile-friendly action menu for organization tree** (Part of Epic #283)
  - Replaced individual action buttons (Add Child, Edit, Move, Delete) with a compact dropdown menu (three dots icon)
  - Actions are now accessible via a single button that expands to show all available options
  - Saves horizontal space on mobile devices where action buttons previously overflowed
  - Uses Catalyst Dropdown, DropdownButton, DropdownMenu, and DropdownItem components

- **Detail panel close functionality** (#306, Part of Epic #283)
  - Close button (×) in detail panel header for explicit panel closing
  - ESC key support to close detail panel
  - Toggle selection: clicking the same unit again deselects it
  - Improved UX for organizational structure management

### Changed

- **Optimistic UI for organizational unit CRUD operations** (SecPal/api#303, Part of Epic #283)
  - After creating a unit, it's immediately added to the tree without reload
  - After updating a unit, changes appear instantly in the tree
  - After moving/reparenting a unit, the tree structure updates immediately
  - After deleting a unit, only the affected row is removed from the tree
  - No full tree reload for any CRUD operation, improving perceived performance and UX
  - Maintains tree state (expanded/collapsed nodes) after all operations
  - New `createdUnit` and `updatedUnit` props for optimistic updates from parent
  - Updated `MoveOrganizationalUnitDialog` to pass new parent ID on success
  - 6 test cases for optimistic UI behavior (delete, create, update)

### Fixed

- **Move dialog UX improvements** (Part of Epic #283)
  - Type labels (Company, Holding, etc.) are now translated in the Move dialog dropdown
  - Options are now sorted hierarchically (matching tree order) with indentation based on depth
  - Added type-specific icons in the dropdown options for better visual clarity
  - Replaced native Select with Catalyst Listbox for consistent UI and accessibility
  - Added `getTypeLabel()` and `flattenTree()` utility functions for hierarchical sorting

- **Inconsistent badge colors between tree and detail view** (#304, Part of Epic #283)
  - Detail panel now uses type-specific badge colors matching the tree view
  - Extracted `getTypeBadgeColor()` to `organizationalUnitUtils.ts` (DRY principle)
  - Added `BadgeColor` type for type-safe color values
  - Color mapping: blue (holding/company), green (department/division), purple (branch), orange (region), zinc (custom/unknown)
  - Added unit tests for `getTypeBadgeColor()`

### Changed

- **Permission-Filtered Organizational Unit Tree View** (#291, Part of Epic SecPal/api#280)
  - Tree component now uses `root_unit_ids` from API response to determine tree roots
  - Users see only organizational units they have access to (Need-to-Know principle)
  - Changed header from "Organizational Structure" to "My Organization" (user-centric)
  - Added `title` prop for customization when needed
  - Updated types: `OrganizationalUnitPaginationMeta` and `OrganizationalUnitPaginatedResponse`
  - 6 new test cases for permission filtering scenarios
  - Implements ADR-007 Need-to-Know pattern

### Fixed

- **OfflineIndicator no longer blocks app interaction** (#XXX)
  - Replaced blocking modal dialog (`Alert`) with non-blocking toast banner
  - Banner auto-minimizes to icon after 5 seconds to reduce obstruction
  - Users can manually minimize/expand the notification
  - Resets to expanded state when going offline again (for context)
  - Added comprehensive test coverage (19 tests)
  - Improved accessibility with `role="status"`, `aria-live="polite"`
  - Used `ChevronDownIcon` from HeroIcons instead of inline SVG (DRY)

### Added

- **Organizational Hierarchy UI Components** (#241, Part of Epic #228)
  - **API Services** - Four comprehensive API service modules with full CRUD support:
    - `organizationalUnitApi.ts`: Manage organizational units (holding, company, region, branch, division, department, custom)
    - `customerApi.ts`: Customer hierarchy management with parent-child relationships
    - `objectApi.ts`: SecPal objects and object areas with geofence support
    - `guardBookApi.ts`: Guard books and reports with status/report_type filtering
  - **TypeScript Types** (`src/types/organizational.ts`):
    - Complete type definitions for all organizational entities
    - Request/response types following ADR-007 conventions
    - Paginated response wrapper for list endpoints
  - **React Components** - Four feature-rich tree/manager components:
    - `OrganizationalUnitTree`: Hierarchical tree view with icons, badges, expand/collapse, and CRUD actions
    - `CustomerTree`: Customer hierarchy with object count display and filtering
    - `ObjectManager`: Split-panel object/area manager with detail view
    - `GuardBookManager`: Guard book list with report generation and status badges
  - **Features:**
    - Hierarchical tree building from flat API responses
    - Loading skeletons and error states
    - Empty state with create action
    - Type-specific icons and color-coded badges
    - Accessible tree structure with proper ARIA roles
    - Catalyst Design System integration (Button, Badge, Heading, Text)
  - **Test Coverage:** 60 API tests + 49 component tests, all passing
  - **Benefit:** Enables visual management of the organizational structure introduced in backend Epic #228

### Fixed

- **Centralized API Wrapper with Session Expiry for All Requests** (#XXX)
  - Created `apiFetch()` as centralized API wrapper function in `csrf.ts`
  - Migrated all API services from direct `fetch()` calls to `apiFetch()`:
    - `secretApi.ts`: All GET/POST/PATCH/DELETE operations
    - `shareApi.ts`: All share management operations
    - `customerApi.ts`: All customer CRUD + hierarchy operations
    - `objectApi.ts`: All object and area management operations
    - `guardBookApi.ts`: All guard book and report operations
    - `organizationalUnitApi.ts`: All organizational unit operations
    - `authApi.ts`: Migrated from `fetchWithCsrf` to `apiFetch`
  - `apiFetch()` features:
    - Automatic `credentials: "include"` for httpOnly cookie authentication
    - CSRF token inclusion for POST/PUT/PATCH/DELETE methods
    - Emits `session:expired` event on 401 responses (triggers automatic logout)
    - Automatic retry on 419 (CSRF token mismatch) with fresh token
  - `fetchWithCsrf()` retained as alias for backward compatibility
  - **Root Cause:** GET requests (e.g., `fetchSecrets()`) used direct `fetch()` without 401 handling, so expired sessions were not detected
  - **Benefit:** All API calls now trigger automatic logout when session expires, improving PWA reliability
  - Updated all test files to mock `apiFetch` via `vi.mock("./csrf")`

- **Session Expiry Handling for PWA** (#257)
  - Added `sessionEvents` module: Pub/sub event system for session lifecycle events
  - Modified `fetchWithCsrf` to emit `session:expired` event on 401 responses when online
  - `AuthContext` now subscribes to `session:expired` events and triggers automatic logout
  - Prevents stale UI state where user appears logged in but backend session has expired
  - **Benefit:** Graceful handling of session expiry - user is logged out cleanly with redirect to login page
  - **Note:** Backend now uses `remember=true` for long-lived sessions (see api#270)

- **PWA Service Worker API_URL mode detection** (#249)
  - Updated `vite.config.ts` to use mode-aware API_URL detection matching `src/config.ts`
  - Development mode now uses empty string (Vite proxy forwards `/v1/*` to DDEV backend)
  - Production mode uses `https://api.secpal.app` as fallback
  - **Benefit:** Service worker cache patterns now correctly match local proxy configuration, fixing cache misses in development mode
  - Related to: PR #248 (Vite proxy configuration for local DDEV development)

### Added

- **CSRF Token Integration & API Service Updates** (#224, Part of Epic #205)
  - Updated `secretApi.ts` to use `fetchWithCsrf` for all state-changing operations
    - POST requests (createSecret, uploadAttachment, uploadEncryptedAttachment)
    - PATCH requests (updateSecret)
    - DELETE requests (deleteAttachment)
  - All API services now properly include CSRF tokens via X-XSRF-TOKEN header
  - Automatic 419 (CSRF token mismatch) retry with fresh token refresh
  - Verified comprehensive test coverage: 19 unit tests + 18 integration tests, all passing
  - **Benefit:** Enhanced security against CSRF attacks with seamless token management and automatic retry on token expiration
  - Follows Gebot #1 (Qualität vor Geschwindigkeit) - All existing tests pass, no breaking changes

- **PWA Update Notification** (#222)
  - Changed `vite.config.ts` PWA plugin from `registerType: 'autoUpdate'` to `registerType: 'prompt'`
  - `useServiceWorkerUpdate` hook for detecting and managing PWA updates
    - `needRefresh` state indicates when new version is available
    - `offlineReady` state for offline capability
    - `updateServiceWorker()` method to trigger update and reload
    - `close()` method to dismiss update prompt (with 1-hour snooze - prompt will reappear after 1 hour if update is still available)
    - Automatic hourly update checks via Service Worker registration
    - Comprehensive error handling and logging
  - `UpdatePrompt` component with Catalyst Design System
    - Fixed bottom-right notification when update is available
    - "Update" button to apply new version immediately
    - "Later" button to dismiss and continue with current version
    - Accessible with ARIA attributes (role=status, aria-live=polite)
    - i18n support with lingui
  - Integrated into `App.tsx` for global availability
  - 30 comprehensive tests (14 for hook, 16 for component)
  - **Benefit:** Users are immediately informed when new PWA versions are available and can choose when to update
  - Follows Gebot #1 (Qualität vor Geschwindigkeit) - Full TDD implementation with comprehensive tests

- **Integration Tests & Developer Documentation for httpOnly Cookie Authentication** (#212, Part of Epic #208) - **CURRENT PR**
  - `tests/integration/auth/cookieAuth.test.ts`: Complete integration tests for cookie-based authentication flow
    - Login flow with CSRF token and httpOnly cookies
    - Authenticated requests with automatic cookie inclusion
    - Logout flow and session clearing
    - Security verification (no token in localStorage)
    - Cookie attributes documentation (HttpOnly, Secure, SameSite)
  - `tests/integration/auth/csrfProtection.test.ts`: Comprehensive CSRF protection integration tests
    - CSRF token inclusion in POST/PUT/PATCH/DELETE requests
    - Automatic 419 (CSRF token mismatch) retry with fresh token
    - Error scenarios (401, 403, 500) handled without retry
    - Credentials always included for cross-origin requests
    - GET requests documentation (no CSRF needed for safe methods)
  - `docs/authentication-migration.md`: Complete developer migration guide (600+ lines)
    - Security benefits and XSS protection explanation
    - Architecture diagrams with sequence flows
    - Local development setup with environment configuration
    - API changes for developers with code examples
    - Removed code patterns (localStorage, Authorization header)
    - Testing instructions (unit, integration, manual)
    - Troubleshooting guide for common issues (401, 419, cookie problems)
    - Browser compatibility matrix
    - Production considerations and security headers
  - Updated `README.md`: Added authentication section with httpOnly cookie documentation
  - Updated `CHANGELOG.md`: Added migration entry with complete implementation timeline
  - Code coverage: ≥80% for new integration tests (all tests passing)
  - Security: Comprehensive tests verify no token accessible via JavaScript
  - Part of httpOnly Cookie Authentication Migration Epic #208 (Final Phase - Closes Epic)
  - **Changed in this PR:**
    - `README.md`: Added 🔒 Authentication section with httpOnly cookie documentation
    - `CHANGELOG.md`: Updated with complete Epic #208 implementation timeline

- **CSRF Token Handling & Request Interceptor** (#211, Part of Epic #208) - **MERGED 23.11.2025**
  - `csrf.ts` service module with CSRF token management
  - `fetchCsrfToken()`: Fetches CSRF token from Laravel Sanctum (`/sanctum/csrf-cookie`)
  - `getCsrfTokenFromCookie()`: Extracts XSRF-TOKEN from browser cookies
  - `fetchWithCsrf()`: Request interceptor with automatic CSRF token inclusion
  - 419 (CSRF token mismatch) auto-retry with fresh token
  - Integration in `authApi.ts`: CSRF token fetch before login, all auth endpoints use interceptor
  - `CsrfError` class for CSRF-specific error handling
  - 17 new unit tests for CSRF functionality (all passing)
  - Updated `authApi.test.ts` to mock CSRF token calls (13 tests passing)
  - Total: 677 tests passing, TypeScript strict mode clean, ESLint clean
  - Part of httpOnly Cookie Authentication Migration Epic #208 (Phase 2/3)
  - Security: Protects against CSRF attacks for all state-changing requests

- **Secret Management Frontend - Phase 4: Secret Sharing UI** (#202, Part of #191) - **MERGED 22.11.2025**
  - `ShareDialog.tsx` modal component with user/role selector
  - `SharedWithList.tsx` component for viewing and managing shares
  - Permission management: Read, Write, Admin levels
  - Optional expiration date for temporary shares
  - Revoke functionality with confirmation dialog
  - Integration in `SecretDetail.tsx`: Share button (owner-only) + shared-with list
  - Shared indicator (👥) on `SecretCard.tsx` for shared secrets
  - API service: `shareApi.ts` with `fetchShares()`, `createShare()`, `revokeShare()`
  - XOR constraint handling (user OR role, not both)
  - Accessibility: aria-labels, keyboard navigation, screen reader support
  - Full i18n support with lingui
  - 31 new tests (589/603 passing - 97.7%)
  - 4-Pass review completed with all findings fixed
  - Part of Secret Management Epic #191 (Phase 4/5)

- **Secret Management Frontend - Phase 3: File Attachments UI Integration (Display)** (#200, Part of #191) - **MERGED 22.11.2025**
  - `AttachmentUpload.tsx` component with drag-and-drop and file validation
  - `AttachmentPreview.tsx` modal for images and PDFs with zoom controls
  - Integration of `AttachmentList` component in `SecretDetail.tsx`
  - Download, delete, and preview handlers with master key management
  - File size limits (10MB) and type validation (images, PDFs, documents)
  - Security: Blocks executable files, validates MIME types
  - 21 new unit tests (547 total tests passing)
  - Coverage: 87.95% (exceeds 80% requirement)
  - Part of Secret Management Epic #191 (Phase 3/5)

- **Secret Management Frontend - Phase 2: Secret Create/Edit Forms** (#198, Part of #191) - **MERGED 22.11.2025**
  - `SecretForm.tsx` reusable form component with validation
  - `SecretCreate.tsx` page for creating new secrets
  - `SecretEdit.tsx` page for editing existing secrets
  - API service extensions: `createSecret()`, `updateSecret()`
  - Client-side validation and error handling
  - Password show/hide toggle for security
  - 28 new unit tests (all passing)
  - Routing: `/secrets/new` and `/secrets/:id/edit`
  - Part of Secret Management Epic #191 (Phase 2/5)

- **Secret Management Frontend - Phase 1: Secret List & Detail Views** (#197, Part of #191) - **MERGED 22.11.2025**
  - `SecretList.tsx` component with search, filtering, and pagination (20 items/page)
  - `SecretDetail.tsx` full detail view with encrypted fields
  - `SecretCard.tsx` reusable card component with badges
  - API service: `secretApi.ts` with `getSecrets()`, `getSecretById()`
  - Grid/List view toggle (persisted in localStorage)
  - Filter by tags and expiration status
  - Password show/hide toggle
  - Tags, expiration badges, attachment count, shared indicator
  - 31 new unit tests (450 total tests passing)
  - Coverage: 87.95% (exceeds 80% requirement)
  - Routing: `/secrets` and `/secrets/:id`
  - Part of Secret Management Epic #191 (Phase 1/5)

- **Client-Side File Encryption - Phase 5: Security Audit & Documentation** (#174, Part of #143)
  - Comprehensive security documentation in `CRYPTO_ARCHITECTURE.md`
  - Security audit completed for all encryption code
  - Updated README with File Encryption section
  - Zero-knowledge architecture verified and documented
  - All crypto tests passing (42.85% coverage)
  - Part of File Encryption Epic #143 (Phase 5/5)

- **Client-Side File Encryption - Phase 4: Download & Decryption** (#176, Part of #143) - **MERGED 21.11.2025**
  - `AttachmentList` component with download/preview/delete actions
  - `downloadAndDecryptAttachment()` API function with integrity verification
  - Automatic decryption on download with SHA-256 checksum validation
  - File type detection and human-readable size formatting
  - Loading states and error handling for decryption failures
  - 11 active tests passing
  - Part of File Encryption Epic #143 (Phase 4/5)

- **Client-Side File Encryption - Phase 3: Upload Integration** (#175, Part of #143) - **MERGED 21.11.2025**
  - Background sync for encrypted file uploads with exponential backoff
  - `UploadStatus` component with progress indicators and retry functionality
  - IndexedDB-based upload queue with persistent storage
  - Service Worker integration for offline upload capability
  - `registerEncryptedUploadSync()` function for automatic retries
  - Real-time upload status tracking with i18n support
  - 15 active tests passing
  - Part of File Encryption Epic #143 (Phase 3/5)

- **Client-Side File Encryption - Phase 2: ShareTarget Integration** (#173, Part of #143) - **MERGED 19.11.2025**
  - ShareTarget PWA manifest configuration
  - `useShareTarget` hook for receiving shared files
  - Automatic encryption of shared files via Share Target API
  - Queue management for files shared from other apps
  - 8 active tests passing
  - Part of File Encryption Epic #143 (Phase 2/5)

- **Client-Side File Encryption - Phase 1: Crypto Utilities** (#172, Part of #143) - **MERGED 19.11.2025**
  - AES-GCM-256 encryption/decryption with Web Crypto API
  - HKDF-SHA-256 key derivation for per-file keys
  - SHA-256 checksum calculation for integrity verification
  - Non-extractable CryptoKey management
  - NIST test vectors validation
  - 12 active tests passing (100% coverage)
  - Part of File Encryption Epic #143 (Phase 1/5)

- **Advanced Caching Strategies** (#168, Part of #144 PWA Phase 3) **FINAL SUB-ISSUE - CLOSES EPIC #144**
  - Route-specific caching strategies for optimal performance:
    - Secrets List: NetworkFirst with 5-minute TTL (fresh data preferred)
    - Secret Details: StaleWhileRevalidate with 1-hour TTL (instant load + background refresh)
    - User Data: StaleWhileRevalidate with 1-hour TTL
    - Auth Endpoints: NetworkOnly (NEVER cache credentials)
    - Images: CacheFirst with 30-day TTL (immutable assets)
    - Static Assets (JS/CSS): CacheFirst with 1-year TTL (versioned by build hash)
    - Fonts: CacheFirst with 1-year TTL
  - Cache management utilities:
    - `useCache()` hook - Manual cache invalidation, clear all caches, storage quota monitoring
    - `usePrefetch()` hook - Intelligent prefetching (on idle, on hover, batch prefetch)
    - `CacheMonitor` class - Performance tracking (hit/miss ratio, lookup times, p95 metrics)
  - Components:
    - `LazyImage` - Intersection Observer-based lazy loading with blur-up effect
    - Placeholder support during loading
    - Graceful error handling
  - Enhanced Workbox configuration:
    - 10 distinct cache strategies per resource type
    - TTL-based cache expiration policies
    - Max entries limit per cache (LRU eviction)
    - Proper cache namespacing (api-secrets-list, api-secrets-detail, static-assets, images, fonts)
  - Performance targets achieved:
    - Cache hit ratio >80% for returning users
    - Cache lookup time <50ms (p95)
    - Offline load time <2s (cached app shell)
  - 25 active tests passing (useCache: 13, cacheMonitor: 12)
  - Part of PWA Phase 3 (Epic #144, Sub-Issue #168)
  - ✅ **COMPLETES PWA PHASE 3 EPIC #144**

- **Push Notifications Infrastructure** (#166, Part of #144 PWA Phase 3)
  - Service Worker push event handlers for backend notifications
  - Notification click routing with deep-link support
  - `usePushSubscription` hook for VAPID-based subscription management
    - Subscribe/unsubscribe to push notifications
    - Automatic subscription restoration on page load
    - Push subscription data extraction for backend API
  - `NotificationPermissionPrompt` component
    - Non-intrusive banner UI for permission requests
    - Dismissible with session persistence
    - Test notification on successful grant
  - Push notification features:
    - Notification display with custom title, body, icon, badge
    - Action buttons (Open, Dismiss)
    - Deep-link URL routing on click
    - Support for notification tags and custom data
  - 13 tests for push subscription management
  - 10 tests for permission prompt UI/UX
  - Accessibility: keyboard navigation, ARIA labels
  - Security: VAPID key support via environment variables
  - Part of PWA Phase 3 (Epic #64, Sub-Issue #166)

- **Offline Analytics & Telemetry** (#167, Part of #144 PWA Phase 3)
  - Web Vitals integration for performance monitoring:
    - CLS (Cumulative Layout Shift) - Visual stability tracking
    - INP (Interaction to Next Paint) - Responsiveness measurement (Web Vitals v4)
    - LCP (Largest Contentful Paint) - Loading performance
    - FCP (First Contentful Paint) - Perceived load speed
    - TTFB (Time to First Byte) - Server response time
    - Automatic metric collection via `initWebVitals()` in main.tsx
    - Metrics tracked to analytics IndexedDB for offline queuing
  - Error tracking with React Error Boundary:
    - `AnalyticsErrorBoundary` component - Automatic error capture
    - Graceful fallback UI with refresh option
    - Development-mode error details display
    - Analytics integration for error reporting
  - Dependencies: `web-vitals@5.1.0` for Core Web Vitals metrics
  - 13 comprehensive tests for new features (100% coverage)
  - Privacy-first design: No PII, no file paths, anonymous session IDs
  - Part of PWA Phase 3 (Epic #144, Sub-Issue #167)

- **IndexedDB File Queue for Offline Uploads** (#142)
  - Replaced sessionStorage with IndexedDB for persistent file storage
  - Files now survive browser close and offline conditions
  - Added `fileQueue` table to IndexedDB schema (version 3)
  - Implemented FileQueueEntry interface with upload states (pending, uploading, failed, completed)
  - Created comprehensive file queue utilities:
    - `addFileToQueue()` - Store files in IndexedDB
    - `getPendingFiles()` - Query pending uploads
    - `updateFileUploadState()` - Track upload progress
    - `retryFileUpload()` - Exponential backoff retry logic (max 5 attempts)
    - `processFileQueue()` - Batch upload processing
    - `clearCompletedUploads()` - Queue cleanup
    - `getStorageQuota()` - Monitor IndexedDB quota usage
  - Service Worker integration:
    - Share Target now stores files directly in IndexedDB
    - Background Sync API support for offline upload queue
    - Automatic sync when network connection restores
  - React Hook `useFileQueue()`:
    - Real-time queue status with Dexie live queries
    - Manual queue processing and cleanup
    - Storage quota monitoring
    - Background Sync registration
  - Updated `useShareTarget` hook:
    - Migrated from sessionStorage to Service Worker messages
    - Files now include IndexedDB queue IDs
    - Improved race condition handling
  - Dependencies: `idb@^8.0.2` for Service Worker IndexedDB access
  - 17 comprehensive tests with 100% coverage
  - Placeholder for future Secret API integration
  - Part of PWA Phase 3 (Epic #64)

- **Share Target POST Method & File Sharing** (#101)
  - Extended Share Target API to support POST method with file uploads
  - Created `ShareTarget` page component with file preview and validation
  - Extended `useShareTarget` hook to handle files from sessionStorage
  - Implemented custom Service Worker (`sw.ts`) with `injectManifest` strategy
  - Service Worker processes FormData, converts images to Base64 for preview
  - File validation: type (images, PDFs, docs) and size (max 10MB)
  - Support for combined text + file sharing in single share action
  - Image preview with thumbnails for shared photos
  - File metadata display (name, size, type badge)
  - Clear button to remove all shared data
  - Updated `PWA_PHASE3_TESTING.md` with comprehensive file sharing test scenarios
  - Part of PWA Phase 3 (Epic #64)

- **Code Coverage Integration** (#137)
  - Integrated Codecov for automated coverage tracking
  - Vitest now generates LCOV and Clover coverage reports
  - CI pipeline uploads coverage to Codecov dashboard
  - Added coverage badge to README.md
  - Coverage configuration in `vite.config.ts` with v8 provider
  - Supports organization-wide 80% coverage threshold

- **Git Conflict Marker Detection**: Automated check for unresolved merge conflicts
  - `scripts/check-conflict-markers.sh` - Scans all tracked files for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`)
  - `.github/workflows/check-conflict-markers.yml` - CI integration (runs on all PRs and pushes to main)
  - `docs/scripts/CHECK_CONFLICT_MARKERS.md` - Complete usage guide with examples and troubleshooting
  - Exit codes: 0 = clean, 1 = conflicts detected
  - Prevents accidental commits of broken code from merge conflicts
  - Colored output shows exact file locations and line numbers

- **Documentation**: Created `docs/KNOWN_ISSUES.md` to track upstream dependency issues
  - Documents npm deprecation warnings from `workbox-build@7.3.0` transitive dependencies
  - Explains why warnings appear and why we cannot fix them directly
  - Provides impact assessment, upstream issue links, and expected resolution timeline
  - Follows Gebot #2 (Qualität vor Geschwindigkeit) by accepting the issue rather than hiding it

- **PWA Phase 3 Features (Issue #67)**: Complete implementation of Push Notifications, Share Target API, and Offline Analytics
  - **Push Notifications**: Permission management, Service Worker integration, notification display
    - `useNotifications` hook with permission state management
    - Service Worker notification display with fallback to browser API
    - `NotificationPreferences` component using Catalyst Design System
    - LocalStorage persistence for notification preferences
    - Support for 4 notification categories (alerts, updates, reminders, messages)
    - 13 comprehensive tests
  - **Share Target API**: Receive shared content from other apps
    - PWA manifest share_target configuration
    - `useShareTarget` hook for URL parameter parsing
    - Support for text and URLs (file sharing planned for future release - Issue #101)
    - Automatic URL cleanup after processing shared data
    - 11 comprehensive tests
  - **Offline Analytics**: Privacy-first event tracking with offline persistence
    - `OfflineAnalytics` singleton class with IndexedDB storage
    - Automatic sync when online (every 5 minutes)
    - Session ID generation and user ID tracking
    - Event types: page_view, button_click, form_submit, error, performance, feature_usage
    - Statistics API and old event cleanup (30 days retention)
    - 22 comprehensive tests
  - **IndexedDB Schema v2**: Added analytics table with indexes
    - Breaking change: Schema upgraded from v1 to v2
    - Automatic migration handled by Dexie.js
    - New indexes: `++id, synced, timestamp, sessionId, type`
  - **Testing Guide**: Comprehensive PWA_PHASE3_TESTING.md with manual testing instructions
  - Total: 67 new tests added (131 tests passing)

- **Background Sync API**: Automatic retry of failed operations when connection restored
  - Workbox Background Sync integration for API requests
  - Exponential backoff retry strategy (1s, 2s, 4s, 8s, 16s)
  - Max 5 retry attempts before marking operation as failed
  - Batch processing of pending sync operations
  - Status tracking (pending, synced, error) for each operation
  - Auto-cleanup of successfully synced operations
  - 15 comprehensive tests for sync logic and error handling

- **Sync Status Indicator UI Component**: Real-time sync status visualization
  - Live display of pending/error operations count using Dexie React Hooks
  - Auto-sync when device comes online after being offline
  - Manual sync trigger button for user-initiated synchronization
  - Last sync timestamp display
  - Error message display with retry information
  - Offline notice when device is disconnected
  - Fixed bottom-right positioning with shadow and dark mode support
  - 9 comprehensive tests covering all user interactions
  - Dependencies: `dexie-react-hooks@^4.2.0`

- **IndexedDB Integration with Dexie.js**: Structured client-side storage for offline-first architecture
  - Database schema with tables for guards, sync queue, and API cache
  - TypeScript-first implementation with full type safety
  - CRUD operations for all entities
  - Automatic schema versioning and migrations
  - API response caching with TTL (24h default, customizable)
  - Expired cache cleanup functionality
  - Sync queue for offline operations with retry logic
  - Storage quota monitoring utilities
  - Dependencies: `dexie@^4.2.1`, `fake-indexeddb@^6.2.4` (dev)
  - 27 passing tests with 100% coverage of core functionality

- **PWA App Shortcuts**: Quick access to key features from app icon
  - 4 shortcuts: View Schedule, Quick Report, My Profile, Emergency Contact
  - Deep linking to specific app sections
  - Configured in Web App Manifest for all platforms
  - Mobile and desktop support (Android, iOS, Chrome, Edge)

- **Storage Quota Indicator**: UI component for storage monitoring
  - Real-time display of IndexedDB usage (MB / Quota)
  - Percentage-based progress bar with visual feedback
  - Warning indicator when storage exceeds 80% capacity
  - Graceful fallback when Storage API unavailable
  - 4 comprehensive tests for all scenarios

- **Catalyst Setup Completion**: Production-ready configuration
  - React Router v7 for client-side navigation with SPA routing
  - Inter font family integration via @fontsource/inter (weights 400-700)
  - Heroicons icon library (@heroicons/react) for UI consistency
  - Updated Link component for React Router integration
  - Tailwind @theme configuration with Inter and font features
  - Demo routes (Home, About) showcasing routing capabilities
  - Updated tests for new router-based structure

- **PWA Offline-First Foundation**: Progressive Web App infrastructure
  - Vite PWA plugin with Workbox for service worker management
  - Web App Manifest for installability (name, icons, theme)
  - `useOnlineStatus` hook for network detection
  - `OfflineIndicator` component for user feedback
  - Runtime caching strategies (NetworkFirst for API, CacheFirst for assets)
  - Auto-update service worker registration
  - PWA icons (192x192, 512x512) with SecPal branding
  - Comprehensive test coverage for online/offline detection

- **Catalyst UI Kit integration**: All 27 Catalyst components
  - Components: Alert, Avatar, Badge, Button, Checkbox, Combobox, Dialog, Dropdown, Input, Select, Table, etc.
  - Dependencies: `@headlessui/react`, `motion`, `clsx`
  - Documentation reference in README
  - SPDX license headers for REUSE compliance

### Changed

- **Authentication Migration to httpOnly Cookies** (#210, Part of Epic #208) - **XSS Protection Enhancement**
  - Migrated from localStorage-based token storage to httpOnly cookies for XSS protection
  - Removed client-side token handling from `AuthContext` and `useAuth` hook
  - Updated `authApi.ts` to use `credentials: "include"` for cookie-based authentication
  - Removed `token` parameter from `logout()` and `logoutAll()` API functions
  - Updated `LoginResponse` interface - removed `token` field (authentication now handled via cookies)
  - Deprecated token-related methods in `storage.ts` (marked for future removal)
  - Updated all authentication tests to reflect new API (Header, Login, ProtectedRoute, useAuth)
  - **Security Improvement**: Eliminates XSS attack vector by preventing JavaScript access to authentication tokens
  - Backend dependencies: Laravel Sanctum SPA mode (#209), CSRF protection (#210)
  - Part of Authentication Security Epic #208

- **Preflight Script Performance**: Optimized `scripts/preflight.sh` for significantly faster local development
  - Prettier/markdownlint: Check only changed files in branch instead of all files (10-100x faster for small changes)
  - npm/pnpm/yarn: Skip dependency installation if lockfile unchanged and node_modules exists (saves minutes per push)
  - npm audit: Only run after fresh install, skip when dependencies unchanged (saves 5-10s network call)
  - git fetch: Cache for 5 minutes with 30s timeout to prevent hanging on slow networks
  - Expected improvement: 60s → 10s for small fixes, 90s → 25s for features without dependency changes

### Fixed

- **CI/CD**: Codecov upload now fully functional for Dependabot PRs
  - Added `continue-on-error` for dependabot/renovate bots to prevent blocking
  - Made `CODECOV_TOKEN` optional (tokenless uploads work for public repos)
  - Upload step succeeds even without token access (Dependabot security restriction)
  - Normal PRs still fail CI on codecov errors (security preserved)
  - Fixes issue where Codecov checks remained pending/missing on Dependabot PRs
- **Blank Page Issue**: Fixed blank page caused by incompatible module format in translation catalogs
  - Changed Lingui compilation from CommonJS (`module.exports`) to ES modules (`export`)
  - Updated `package.json` scripts to use `--namespace es` flag for `lingui compile`
  - Changed imports in `i18n.ts` from `.js` to `.mjs` extension
  - Added TypeScript declaration file for `.mjs` message catalogs
  - Added safety checks for `localStorage` and `navigator` access in `detectLocale()`
  - Issue occurred because Vite requires ES modules, but Lingui compiled to CommonJS by default
- Pre-push hook no longer fails with exit code 1 when [Unreleased] is the last CHANGELOG section
- Project automation now triggers on label changes for issues AND pull requests (labeled event)

### Added (Previous)

- Initial repository setup
- React + TypeScript + Vite configuration
- Testing setup with Vitest and React Testing Library
- REUSE 3.3 compliance
- Pre-commit and pre-push quality gates

[unreleased]: https://github.com/SecPal/frontend/commits/main
