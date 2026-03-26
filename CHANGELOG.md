<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- Removed the deleted legacy product module from the frontend, including its obsolete routes, navigation entries, offline caches, background sync wiring, and associated documentation so the repository no longer ships or documents that retired area in 0.x
- Removed the remaining legacy test suites, stale documentation, and outdated frontend schema/cache references that only existed for the deleted module
- Removed the stale `docs/PERFORMANCE_NEXT_STEPS.md` and `docs/PERFORMANCE_README.md` planning summaries because they only captured temporary 2025 performance follow-up plans
- Removed the stale `docs/PROJECT_STATUS.md` snapshot because it no longer matched the current frontend state and duplicated newer repository history
- Removed the stale `docs/PERFORMANCE_ISSUE319_STATUS.md` and `docs/PERFORMANCE_TBT_DEFER_IMPLEMENTATION.md` worklog documents because they no longer reflected the final outcome of the 2025 Issue #319 investigation
- Removed the stale `docs/PERFORMANCE_DEPLOYMENT_STATUS.md` snapshot because it only documented a temporary 2025 deployment checkpoint and no longer reflected the repository's active guidance
- Removed the obsolete `docs/PERFORMANCE_AGGRESSIVE_SPLITTING_RESULTS_ARCHIVED.md` archive because it only preserved a reverted implementation path and no longer served as useful active documentation
- Removed the stale `docs/PERFORMANCE_OPTIMIZATIONS_IMPLEMENTED.md` worklog because it only tracked temporary 2025 optimization steps and duplicated more precise historical analysis records
- Removed the obsolete `docs/PERFORMANCE_OPTIMIZATIONS_2025-12-06-AGGRESSIVE.md` note because it documented a superseded aggressive chunk-splitting experiment that was not retained as active guidance

### Security

- Pinned the transitive `glob` resolution to `^13.0.6` via `overrides` so the
  deprecated `glob@11.1.0` (pulled in by `@lingui/cli` and `workbox-build`) is
  replaced by a current, non-deprecated release; the remaining deprecated
  transitive packages inside `workbox-build@7.4.0` (`sourcemap-codec@1.4.8`,
  `source-map@0.8.0-beta.0`) are blocked upstream and tracked separately
  (closes #558, remaining items blocked by upstream `vite-plugin-pwa` /
  `workbox-build`)
- Pinned third-party GitHub Actions in frontend workflows to immutable commit SHAs so Lighthouse and Codecov automation no longer depend on floating action tags at runtime
- Pinned the transitive `flatted` resolution to `3.4.2` so Vitest UI and ESLint cache tooling no longer ship the vulnerable parser affected by CVE-2026-33228 / GHSA-rf6f-7fwh-wjgh

- Pinned the transitive `yauzl` resolution to `3.2.1` so Lighthouse-related tooling no longer ships the vulnerable archive parser flagged by `npm audit` and Dependabot

- **Phase 1 offline-data hardening**
  - Removed PWA runtime caching for authenticated API routes to avoid persistent browser caching of sensitive `/v1/*` responses
  - Added centralized sensitive client-state cleanup for logout and session-expiry flows
  - Sensitive IndexedDB tables and legacy API cache names are now cleared when the client session ends
  - Replaced invalid on-prem example domain in frontend config comments to stay within the `secpal.app` / `secpal.dev` domain policy

### Fixed

- Centralized frontend UI capabilities for low-privilege users so scope-only accounts stay in self-service areas and direct navigation to elevated feature routes now resolves through one shared capability guard instead of mixed ad hoc checks
- Applied the centralized low-privilege capability model to the main application navigation so management links stay hidden unless the user has the matching feature access
- Hid customer, site, and employee create/update/delete or status-transition CTAs unless the centralized UI capability model grants the matching action, so low-privilege users no longer see misleading management buttons inside accessible pages
- Unified frontend route-guard handling for low-privilege users outside the onboarding flow: permission-gated routes now show the same access-denied state as organizational routes, the legacy `/organizational-units` app path is guarded and mapped to the existing organization screen, and unknown authenticated app URLs now fall back cleanly instead of rendering blank pages
- Aligned the employee create UI and API types with the invite-enabled backend flow by adding `send_invitation` to the create payload and surfacing persisted onboarding invitation delivery status on employee detail pages
- Aligned the frontend employee create payload type with the shared contract by making `EmployeeFormData.position` mandatory, matching the existing required create-form validation and backend/runtime expectations (fixes #578)
- Made the employee create form fail loudly instead of silently by adding Catalyst-aligned submit summaries, inline field errors, first-invalid-field focus, clearer required-field guidance for Date of Birth, Organizational Unit, Status, Contract Type, and the Leadership Position/Management Level relationship, plus structured handling for API validation errors
- Synchronized the employee create Lingui catalogs and finalized the shipped German validation and helper copy so the recent form-usability messages are present in both source and compiled locale bundles
- Replaced the incomplete `public/logo-light.svg` and `public/logo-dark.svg` placeholder contents with valid SVG logo assets that render the canonical frontend light and dark branding outputs correctly
- Moved the local Lighthouse CI CLI to on-demand `npx` execution so regular frontend installs no longer pull the deprecated `@lhci/cli` dependency chain that emitted `rimraf`, `glob@7`, and `inflight` warnings during pre-push installs
- Aligned `eslint` and `@eslint/js` with the `eslint-plugin-react-hooks` peer range by moving both packages back to the latest compatible 9.x line, so `npm ls` no longer reports an invalid frontend lint dependency tree; documented in `docs/KNOWN_ISSUES.md` that the global `minimatch: >=10.2.4` override is intentional and confirmed compatible with ESLint 9 by CI
- Replaced the deprecated PWA service-worker build setting `inlineDynamicImports` with `codeSplitting: false` via the plugin's custom SW build hook so `npm run build` no longer emits the Vite 8 deprecation warning
- Stabilized several interaction-heavy frontend tests by reusing the shared test i18n instance, mocking lazy dialog and listbox edges, and making async form/upload assertions deterministic in Vitest
- Hardened the `EmployeeCreate` success-path test to wait for loaded organizational-unit options and async navigation, reducing full-suite timeout flakiness
- Hardened additional full-suite-sensitive submit flows in `Login`, `ApplicationLayout`, and `CustomerCreate` tests to reduce timing-dependent Vitest failures

### Added

- Offline sync queue retry scheduling now persists `nextRetryAt` timestamps so pending operations can wait for their backoff window instead of retrying immediately on every local processing pass
- Sync status UI now surfaces the next scheduled offline retry time and hides the manual sync trigger while pending operations are still in their backoff window
- `.github/instructions/react-typescript.instructions.md` - targeted React and strict TypeScript guidance for frontend source and test files
- `.github/instructions/github-workflows.instructions.md` - targeted workflow and Dependabot guidance for GitHub automation files in this repo
- `.github/instructions/org-shared.instructions.md` — org-wide Copilot principles (TDD, quality gates, PR protocol) auto-loaded for all files via `applyTo: "**"`
- `docs/OFFLINE_DATA_PROTECTION_ROADMAP.md` - deferred Phase 2 design notes for future encrypted offline data protection with device-bound key options

### Changed

- Updated `.npmrc` to document that `legacy-peer-deps=true` is specifically
  required to suppress the `vite-plugin-pwa@1.2.0` peer-dependency conflict
  with Vite 8; the plugin currently declares peer support only through Vite 7
  (see #559 for status); the SPDX copyright year range was extended to `2025-2026`
- `.github/copilot-instructions.md` now requires a branch hygiene check before any write action so frontend work never starts on local `main` and dirty non-`main` branches must be assessed before continuing
- `.github/copilot-instructions.md` now requires stale `SPDX-FileCopyrightText` years in edited files and license sidecars to be normalized to `YYYY` or `YYYY-YYYY` without spaces
- `.github/copilot-instructions.md` now clarifies that if an edited file has no inline SPDX header, its companion `.license` file must be checked and updated instead
- repo-local frontend instructions and overlays now also restate Copilot review handling, signed-commit checks, EPIC/sub-issue requirements, REUSE checks, 4-pass review, and the `secpal.app` vs `secpal.dev` use-case split so project-wide governance is locally complete
- repo-local frontend instructions and overlays now also require warning, audit, and deprecation notices from scripts and package managers to be reviewed and either fixed or tracked immediately
- Changed the English login email field label from `Email` to `Email address` for clearer authentication microcopy without altering the rest of the screen
- Changed the login-page heading from `Login` to `Log in` for consistent authentication microcopy while leaving the rest of the screen unchanged
- Removed the login-page subtitle so the auth entrypoint shows only the product name and keeps the footer slogan as the sole claim treatment
- Synchronized the frontend Lingui catalogs with Translation.io so the updated German login and tagline-related copy is reflected locally after the recent remote translation refresh
- Standardized the frontend-visible SecPal tagline to `Powered by SecPal – A guard's best friend` across footer text, landing copy, tests, and generated locale catalogs; the tagline is intentionally identical in all locales (no translation)
- Marked `docs/PERFORMANCE_ANALYSIS_2025-12-06.md` as historical reference material so it is not mistaken for the current frontend optimization plan
- Marked `docs/IMPLEMENTATION_PLAN_ISSUE143.md` as a historical planning artifact so it is not mistaken for current implementation guidance
- Marked the retained Issue #319 profiling and TBT analysis notes as historical reference material so they are not mistaken for active implementation instructions

- Updated frontend package baselines to the latest currently compatible releases for `@lingui/core`, `@lingui/react`, `@lingui/macro`, and `vite-plugin-static-copy`

- `.github/copilot-instructions.md` - replaced comment-based inheritance assumptions and long-form examples with a self-contained runtime baseline for this repository
- `.github/instructions/org-shared.instructions.md` - reduced to a short repo-local overlay that reinforces the runtime baseline instead of duplicating org documents
- **Git Hooks Diagnostic Tool** (#392)
  - Created `scripts/diagnose-hooks.sh` to troubleshoot pre-push hook issues
  - Comprehensive checks for hook installation, git config, shell environment
  - Detects prompt/tool integrations that may trigger hooks unexpectedly
  - Provides actionable recommendations for fixing hook problems
  - Documentation: `docs/diagnose-hooks.md`
  - Added "Troubleshooting" section to CONTRIBUTING.md with diagnostic guide, performance tips, and common fixes
- **Employee Management & Onboarding Portal** (#332, Epic #211 Phase 7)
  - **API Service Layers:**
    - Employee API service layer (CRUD operations, activate, terminate)
    - Qualification API service (system/custom qualifications, employee assignments)
    - Onboarding API service (multi-step wizard, file upload, HR approval workflow)
    - Employee Document API service (8 document types, policy-based visibility)
  - **UI Components (Catalyst Framework):**
    - Employee List page with Catalyst Table, Field, Input, Select components
    - Employee Detail page with Catalyst Badge, DescriptionList, tabs with proper dark mode support
    - Employee Create form using Catalyst Fieldset, Legend, FieldGroup, Field, Label, Input
    - Employee Edit form (pre-populated data editing with Catalyst components)
    - Pre-contract Onboarding Wizard (8-step process with Catalyst Button, Heading, Text)
  - **Navigation & Access Control:**
    - UserGroupIcon added to component library
    - "Employees" navigation item in navbar and sidebar (conditional on organizational access)
    - OrganizationalRoute wrapper component for RBAC enforcement
    - All employee routes protected with `hasOrganizationalAccess()` permission checks
  - **Routing Integration:**
    - `/employees` - Employee list view
    - `/employees/create` - Create new employee
    - `/employees/:id` - Employee detail view
    - `/employees/:id/edit` - Edit existing employee
    - `/onboarding` - Pre-contract onboarding wizard
  - **Internationalization:**
    - Full i18n support with `<Trans>` and `msg` from @lingui/macro
    - All UI text translatable (German/English)

### Fixed

- **Frontend build now stays compatible with Vite 8**
  - replaced object-based manual chunk configuration with a function-based variant so production builds and Lighthouse CI continue to work with Vite 8
  - switched the React Babel macro configuration to Lingui's dedicated Babel plugin so Lingui macros continue to compile correctly with `@vitejs/plugin-react` 6

- **Auth bootstrap now revalidates stored sessions before unlocking protected routes** (#503)
  - added frontend bootstrap revalidation against `GET /v1/me` when a stored session is present and the client is online
  - protected routes now remain in the loading state until startup revalidation succeeds or fails closed
  - stale local `auth_user` state is cleared, including sensitive client cleanup, when startup revalidation rejects
  - offline startup still preserves existing local session state to keep the offline-first flow available

- **Employee API types now use a shared contract source** (#492)
  - added `src/types/api` as the central frontend import path for employee API types
  - removed employee request and response type declarations from `src/services/employeeApi.ts`
  - rewired employee pages, tests, and auth context away from service-local employee types
  - aligned the employee UI with the contract-backed `applicant` status

- **Login page: Health check retry on offline→online transition**
  - Fixed false "System not ready" error when login page is opened offline and then comes online
  - Health check is now skipped when offline (shows offline warning instead)
  - Health check automatically retries when device comes back online
  - Eliminates need for manual page reload after network reconnection
  - Added test coverage for offline→online transitions

### Changed

- `.github/copilot-instructions.md` — removed dead `@EXTENDS`, `INHERITANCE`, and `applyTo` HTML comment blocks (replaced by `org-shared.instructions.md`)
- **Migrated to Stacked Layout design** (#TBD)
  - Switched from sidebar navigation to horizontal navbar (stacked layout)
  - Navigation items now displayed in top navbar on desktop
  - Mobile experience unchanged (sidebar drawer)
  - Improved space utilization with horizontal navigation
  - All Catalyst components and patterns maintained
  - Footer integration preserved across both layouts
- **Improved "Add Unit" button label in Organizational Unit Tree** (#300, Part of Epic #283)
  - Renamed "Add Unit" button to "Add Root Unit" for clarity
  - Makes it explicit that the button creates a root-level organizational unit
  - Reduces confusion about where new units will be created
  - Empty state button remains as "Create Organizational Unit" for first-time users
  - **Enhanced with hierarchy-based type filtering**: When creating a child unit, the type dropdown now only shows valid child types based on the parent's hierarchy rank. Child units must be **lower** in the hierarchy than their parent (e.g., Division under Branch is valid, but Branch under Branch is not allowed). This prevents users from selecting invalid types upfront, improving UX by avoiding validation errors after submission.

### Added

- **Web Vitals monitoring with thresholds & development warnings** (#310)
  - Performance threshold configuration aligned with Lighthouse CI and Google's Core Web Vitals
  - Development-mode console warnings for poor metrics (zero runtime cost in production)
  - Metrics export API for dashboards: `getPerformanceMetrics()`, `clearPerformanceMetrics()`
  - Severity levels: "good", "needs-improvement", "poor"
  - Full test coverage (14 passing tests)
  - Documentation: `docs/web-vitals-monitoring.md`

- **Playwright E2E testing infrastructure** (#309)
  - Comprehensive E2E test suite with Playwright
  - Three testing modes:
    - Local development (localhost:5173 with DDEV backend proxy)
    - Staging/performance tests (app.secpal.dev)
    - CI smoke tests (localhost:4173 preview build)
  - Test categories:
    - Authentication flow tests (login, logout, session persistence)
    - Smoke tests (page loading, navigation, accessibility basics)
    - Organization management integration tests
    - Lighthouse performance audits (Core Web Vitals)
  - Global setup with session reuse to prevent rate-limiting
  - Configurable test credentials via environment variables
  - npm scripts: `test:e2e`, `test:e2e:staging`, `test:e2e:ci`, `test:e2e:ui`, `test:e2e:headed`

### Fixed

- **PWA Update: Fixed double page reload issue**
  - **Problem:** When clicking "Update now" for a PWA update, the page reloaded twice, causing a jarring user experience
  - **Root Cause:** `swUpdate(true)` already triggers a reload via `vite-plugin-pwa`, but we were also explicitly calling `window.location.reload()` immediately after
  - **Solution:** Removed redundant `window.location.reload()` call from success path in `useServiceWorkerUpdate.ts`
  - **Impact:** Page now reloads once instead of twice, providing a smoother update experience
  - **Files Changed:**
    - `src/hooks/useServiceWorkerUpdate.ts` - Removed duplicate reload, kept as fallback for error cases only
    - `src/components/UpdatePrompt.tsx` - Simplified error handling
    - `src/hooks/useServiceWorkerUpdate.test.ts` - Updated test expectations
  - **Quality:** All tests pass (27/27), no linting or type errors
  - **Documentation:** `docs/PWA_UPDATE_DOUBLE_RELOAD_FIX.md`

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
  - **Root Cause:** Some GET requests still used direct `fetch()` without 401 handling, so expired sessions were not detected consistently
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

- **Client-Side File Encryption - Phase 1: Crypto Utilities** (#172, Part of #143) - **MERGED 19.11.2025**
  - AES-GCM-256 encryption/decryption with Web Crypto API
  - HKDF-SHA-256 key derivation for per-file keys
  - SHA-256 checksum calculation for integrity verification
  - Non-extractable CryptoKey management
  - NIST test vectors validation
  - 12 active tests passing (100% coverage)
  - Part of File Encryption Epic #143 (Phase 1/5)

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

- **PWA Phase 3 Features (Issue #67)**: Complete implementation of Push Notifications and Offline Analytics
  - **Push Notifications**: Permission management, Service Worker integration, notification display
    - `useNotifications` hook with permission state management
    - Service Worker notification display with fallback to browser API
    - `NotificationPreferences` component using Catalyst Design System
    - LocalStorage persistence for notification preferences
    - Support for 4 notification categories (alerts, updates, reminders, messages)
    - 13 comprehensive tests
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
