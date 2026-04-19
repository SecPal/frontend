<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Wired the central Copilot-instructions validator into `quality.yml` so frontend pull requests now fail automatically when known React AI-risk guardrails or generic AI-triage guidance are missing from the runtime baseline
- Dropped restoration of legacy cleartext and pre-v2 encrypted `auth_user` localStorage payloads; unsupported auth-storage records are now purged instead of being restored, and frontend test fixtures now seed authenticated state through the encrypted storage path only
- Dropped the legacy `template_id` alias in the onboarding submission client so runtime writes now require `form_template_id` only, matching the current API contract during the project's `0.x` line

### Removed

- Removed stale and historical documentation: DDEV-era PWA testing guide (`PWA_PHASE3_TESTING.md`), stale PR artefact (`.pr-body.md`), closed-issue implementation plans and summaries (`docs/IMPLEMENTATION_PLAN_ISSUE143.md`, `docs/IMPLEMENTATION_SUMMARY_OFFLINE_ORGANIZATION.md`), and historical performance snapshots (`docs/PERFORMANCE_ANALYSIS_2025-12-06.md`, `docs/PERFORMANCE_ISSUE319_PHASE2_PROFILING.md`, `docs/PERFORMANCE_TBT_ANALYSIS.md`)

### Security

- Updated the transitive `basic-ftp` dependency from `5.2.2` to `5.3.0` in `package-lock.json`, clearing the high-severity `GHSA-rp42-5vxx-qpwr` npm audit finding tracked in issue #893.

### Fixed

- Split the heavy `issue874-react-hooks-set-state-in-effect` lint regression into smaller tracked-file batches and gave each batch a dedicated 30-second timeout so `npm run test:coverage` no longer times out on one monolithic ESLint spawn under full-suite coverage load, resolving frontend issue #899.
- Increased PBKDF2 iteration count from 5,000 to 600,000 (OWASP minimum for PBKDF2-HMAC-SHA256) for new auth-storage envelopes while preserving reads of legacy v1 envelopes during rollout, hardening key derivation without forcing deploy-time logouts.
- Replaced `Buffer.from` with `TextEncoder` in `Login.test.tsx` `textBytes` helper for cross-platform Web API compatibility.
- Fixed incorrect `ApiError` constructor argument order in `employeeApi.ts` BWR export and BWR status update error paths: the third argument now correctly passes `normalizeApiErrorErrors(error.errors) ?? undefined` (errors array) instead of `response` (the Response object).
- Added JSON parse error boundary in `decryptPersistedAuthUser` so malformed `auth_user` storage values return `null` cleanly instead of throwing.
- Extracted `clearInvalidStoredUser` and `handleStoredUserError` private helpers in `LocalStorageAuthStorage` to eliminate duplicated remove-and-return-null patterns in `getUserSnapshot` and `getUser`.
- Clarified the auth-storage CSRF-missing warning message to explain the root cause.
- Replaced `seededAuthUser` module-scoped coupling in `App.test.tsx` with direct `mockGetCurrentUser.mockResolvedValue` calls in seed helpers, and replaced empty `waitFor(() => {})` with `Promise.resolve()`.
- Extracted `ROUTE_NAVIGATION_TIMEOUT_MS` constant in `App.test.tsx` to replace the repeated magic number `20000`.
- Replaced plaintext `localStorage.setItem` test setup in `useAuth.test.ts` with `await authStorage.setUser()` to exercise the actual encryption layer, and updated affected assertions to use `authStorage.getUser()`.
- Removed stale memoization from `NotificationPreferences` so translated preference labels now recompute correctly when the active Lingui locale changes, resolving frontend issue #878.
- Wrapped `authStorage.setUser()` persistence in a WebCrypto error boundary so rare PBKDF2/AES failures now log, clear stale `auth_user` state, and return cleanly instead of bubbling an unhandled rejection during login/bootstrap flows; includes focused regression coverage for issue #871.
- Resolved issue #874 by refactoring the remaining `react-hooks/set-state-in-effect` violations across list/detail loaders, dialog reset flows, and organizational-unit tree state derivation; restored the rule to `error` in `eslint.config.js` and added a focused lint regression test for the tracked files.
- Guarded auth-storage event and pageshow handlers with an in-memory `hasLogoutBarrierRef` check after `await authStorage.getUser()` to prevent an async race where an in-flight bootstrap `setUser()` clears the localStorage logout barrier (via `clearLogoutBarrier()`) before the stale-storage handler resumes, which caused a post-logout StorageEvent to restore the authenticated user.
- Stabilized the Lingui catalog sort: switched `lingui.config.cjs` from the default `orderBy: "message"` to `orderBy: "messageId"` so entries sharing the same translated text (e.g. the generic Cancel button and the `login.mfa.cancel` explicit-ID entry both translate to "Cancel") are ordered by their unique key rather than producing a non-deterministic oscillation between two orderings on successive `sync:purge` runs.
- Fixed all ProtectedRoute bootstrap tests broken by the async auth-storage migration: switched `beforeEach` from `vi.clearAllMocks()` to `vi.resetAllMocks()` to clear queued `mockResolvedValueOnce` implementations between tests, flushed both async levels of `authStorage.getUser()` before advancing fake timers so the stall-timeout is guaranteed to be registered, and restored real timers before the retry-bootstrap assertion to avoid incomplete PBKDF2 promise chains under fake scheduling.
- Replaced the `crypto-js`-based auth-storage envelope with native WebCrypto PBKDF2/AES-CBC/HMAC handling, updated auth bootstrap/login persistence for the new async storage path, preserved legacy cleartext reads during the migration, and removed the redundant `crypto-js` packages to close issue #868.
- Normalized employee-create POST payloads so non-leadership submissions omit the internal `management_level: 0` sentinel on the wire and match the API's optional create-field contract for onboarding-ready staff creation.
- Encrypted persisted `auth_user` localStorage state with a session-bound PBKDF2-derived AES/HMAC envelope, kept legacy cleartext reads for compatibility during rollout, and added focused coverage for encrypted auth bootstrap and login persistence to resolve the CodeQL clear-text storage finding tracked in issue #784.
- Standardized auth test fixtures and storage-event construction in `useAuth` coverage, aligned `SiteDetail` metadata date rendering with locale-aware `formatDate`, removed a redundant non-null timeout assertion in passkey browser helpers, and tightened Lingui guard tests with JSON import assertions, command/argument checks, and an appropriate unit-test timeout.
- Isolated the Lingui catalog guard's nested `sync:purge` environment from parent Vitest and npm runner variables, and refreshed the checked-in locale artifacts so the guard no longer reports false drift in CI while still catching real catalog changes.
- Added a Lingui catalog sync guard that re-runs the checked-in extract/compile flow during frontend test validation, restores the workspace afterward, and fails CI when new translatable strings were added without committing the resulting catalog updates.
- Stabilized `App` route test reliability by seeding `auth_user` localStorage fixture through the same `sanitizePersistedAuthUser` path the runtime uses, eliminating races on onboarding redirect assertions caused by stale or mismatched fixture shapes.
- Passkey browser credential prompts are now aborted via `AbortController` when the frontend safety timeout fires, so the browser dismisses the credential picker instead of letting it remain open until the browser timeout elapses after a frontend timeout.
- Fixed passkey WebAuthn wrapper timeout calculation so the frontend safety timeout is always the configured WebAuthn timeout plus a 5-second grace period, avoiding premature frontend aborts for longer server-specified timeouts.
- Passkey login now confirms the session with a follow-up GET /v1/me after the verify endpoint succeeds, aligning with the password login flow and catching silent session establishment failures.
- Passkey login and add-passkey buttons now show step-by-step progress so users can tell exactly where each flow is and whether the browser is waiting for their interaction: login uses challenge → browser prompt → verifying → confirming session, while add-passkey uses challenge → browser prompt → saving.
- Added step-by-step `[SecPal]` console diagnostics to the passkey login and registration flows so real-browser failures can be traced through DevTools.

### Added

- Added a Bewacherregister management panel to employee detail so authorized users can review BWR status and timestamps, generate the initial export, download the generated file, and move supported BWR states through the dedicated backend endpoints with inline validation feedback.
- Added a permission-gated Android provisioning UI with backend-issued enrollment session creation, QR display, status visibility, and revoke controls for Epic SecPal/.github#327.
- Added a live Playwright passkey proof that drives the real app.secpal.dev/api.secpal.dev stack through passkey registration, UI/API consistency checks, passkey removal, and a fresh email-first passkey login using a browser WebAuthn authenticator.
- Added browser passkey sign-in to the login flow, including the WebAuthn challenge client and focused frontend coverage for supported browsers and failure handling.
- Added passkey visibility to the settings page, including enrolled-passkey listing and an unsupported-browser notice that does not hide existing server-side passkey data.
- Added passkey enrollment to the settings page, including user-provided credential labels, browser WebAuthn registration, server-side verification, and focused frontend coverage for successful and failing enrollment flows.
- Added passkey removal to the settings page, including destructive controls for enrolled credentials, backend deletion, list refresh, and focused frontend coverage for successful and failing removal flows.
- Added the missing MFA enrollment slice to the settings page so disabled accounts can start TOTP setup, scan a QR code or use the manual setup key, confirm the authenticator code, and immediately receive one-time recovery codes.
- Added a reusable MFA QR-code component with browser-safe fallback messaging and focused component coverage so upcoming enrollment UI slices can render authenticator setup material without duplicating QR generation logic.
- Added PWA offline persistence security and privacy [audit document](PWA_OFFLINE_PERSISTENCE_AUDIT.md) covering all client-side storage mechanisms (localStorage, sessionStorage, IndexedDB, Cache API, Service Worker state) with 10 findings, issue overlap analysis, and prioritized remediation recommendations.
- Added a platform-aware frontend auth transport boundary that keeps browser/PWA flows on Sanctum session auth, sanitizes auth state before it enters React or local storage, and creates the explicit seam Android can later wire to a native bearer-token bridge without exposing raw tokens to JavaScript.
- Added the first MFA settings management slice with live status loading plus self-service recovery-code regeneration and MFA disablement flows for accounts that already have MFA enabled.
- Added the phase-1 browser-session MFA login challenge flow so the login page can pause after primary credentials, collect the second factor, and complete the session only after the backend challenge verification succeeds.

### Fixed

- Fixed passkey sign-in on browsers that reject discoverable WebAuthn requests without an `allowCredentials` list by retrying the flow with the entered email address, requesting an account-scoped challenge from the API, and showing an explicit prompt to enter an email address when that fallback is required.
- Hardened the passkey browser ceremony helpers so both registration and sign-in now fail with a deterministic timeout even when the browser ignores the supplied `AbortSignal`, and the settings page now re-fetches `/v1/me/passkeys` after successful enrollment so the UI reflects persisted server state instead of relying only on optimistic local state.
- Fixed passkey enrollment hanging on "Adding passkey..." by stripping null `authenticatorAttachment` values from `AuthenticatorSelectionCriteria`, picking only `id` and `name` from the `rp` object (omitting deprecated `icon: null`), and omitting empty `excludeCredentials` arrays before passing options to `navigator.credentials.create()`.
- Added an `AbortController` timeout safety net to both `getPasskeyAttestation` and `getPasskeyAssertion` so the WebAuthn ceremony is cancelled if the browser exceeds the server-specified timeout plus a 5-second grace period, preventing indefinite UI hangs.
- Added explicit `AbortError` handling in the passkey sign-in and passkey registration error paths so timed-out WebAuthn ceremonies show a clear "timed out" message instead of a raw abort error.
- Added a user-friendly cancellation message when the browser WebAuthn dialog is dismissed or denied during passkey registration.
- Fixed passkey browser login failing with "Resident credentials or empty allowCredentials lists are not supported" by omitting empty `allowCredentials` from the WebAuthn options, checking conditional-mediation availability with a safe fallback to `optional`, and surfacing a user-friendly message when passkey sign-in encounters an unsupported-browser or cancelled-ceremony error.
- Added the missing German translations for the remaining passkey action labels in Settings so add and remove flows no longer fall back to English in the shipped `de` locale.
- Removed a React `act(...)` warning from the `SettingsPage` passkey-removal test by wrapping the deferred `resolveDeletion` call in `act` and waiting for the post-deletion UI to settle, so the covered removal flow no longer leaks async state updates out of the test boundary.
- Completed the missing German Lingui translations for current passkey and Android provisioning UI so security and enrollment screens no longer fall back to English in the shipped `de` locale.
- Added the missing German translations for the EmployeeDetail "Confirm Onboarding" action and the onboarding sign-out failure message so those UI states no longer fall back to English.
- Bounded `ApplicationLayout` sign-out with an 8-second timeout so a hung logout request still clears local auth state and returns the browser user to the login screen.
- Bounded `OnboardingLayout` sign-out with an 8-second timeout so hung logout requests still clear local auth state and return the user to `/login`, while real API failures continue to show the inline retry message.
- Persisted the minimal employee lifecycle state in offline auth storage so pre-contract users are still redirected to `/onboarding` even when the full employee record is unavailable.
- Fixed a race condition in the `ApplicationLayout` logout handler where `logout()` was called before the API request; `logout()` now runs inside the `finally` block so authTransport.logout() can complete before local state is cleared.
- Replaced `<Trans>` component usage inside `<option>` elements in `EmployeeStatusOptions`, `EmployeeCreate` (contract type and org-unit placeholder), `SiteCreate`, `SiteEdit`, `ActivityLogList` (log-name filter), `CustomersPage` (status filter), `EmployeeList` (status filter), and `SitesPage` (type and status filters) with `_(msg\`...\`)`string calls to produce valid HTML, because`<Trans>`renders a wrapper element that is invalid inside`<option>` elements.
- Fixed remaining CodeQL "superfluous trailing arguments" alerts in `useAuth` tests by consolidating `otherKeyEvent`, `crossTabLoginEvent`, and `invalidJsonEvent` constructors to use the full `StorageEventInit` dictionary, removing all residual `Object.defineProperty` boilerplate and making the test file consistent throughout.
- Fixed a race condition in the `OnboardingLayout` sign-out handler where `logout()` was called before the API request; `logout()` and navigation to `/login` now happen only after a successful API logout call so local auth state is not prematurely cleared.
- Added a user-facing inline error message in `OnboardingLayout` when the sign-out API call fails; local auth state is preserved so the user can retry, and an inline alert notifies them the server request did not complete.
- Replaced invalid `<Trans>` component usage inside `<option>` elements in `EmployeeEdit` with `i18n._(msg\`...\`)` calls to produce valid HTML and avoid rendering issues with the organisational unit dropdown placeholder.
- Fixed inconsistent mock user `id` type (number vs string) in specific `useAuth.test.ts` assertions affected by sanitizer coercion; the updated expectations now reflect the sanitizer's string-coercion behavior.
- Fixed perpetual loading state in `CustomerDetail` when route `id` param is absent; `setLoading(false)` is now called on the early-return path.
- Replaced hardcoded `site(s)` pluralization in `CustomerDetail` with Lingui `<Plural>` for correct singular/plural handling.
- Extracted duplicated date-part computation in `EmployeeEdit.formatDateForDisplay` so `day`, `month`, and `year` are derived once before the locale branch.
- Fixed perpetual `fetchLoading` state in `EmployeeEdit` when `id` param is absent; `setFetchLoading(false)` is now called before the early return.
- Added user-visible error message in `EmployeeEdit` when the form is submitted without a route `id`; previously the submission silently no-oped.
- Replaced hardcoded locale-switched date validation error strings in `EmployeeEdit` with `i18n._(msg\`...\`)` calls so messages are properly translatable.
- Added targeted Android provisioning access-control regressions for hidden navigation and denied route access so the permission-gated provisioning UI in #751 stays covered end-to-end.

### Changed

- Strengthened repo-local Copilot governance for AI findings: frontend work now requires proof of defect before merging AI-generated fix PRs, treats green CI alone as insufficient evidence for semantic UI refactors, and documents the known guardrails around async ordering, `<option>` translation strings, and separated error state.
- Replaced raw Android provisioning rollout-channel and session-status enum values with human-readable labels and operator guidance, so stale, revoked, and already-used enrollment sessions are easier to interpret in the frontend UI.
- Aligned the frontend lint toolchain back to the ESLint 9 line so `eslint-plugin-react-hooks` no longer leaves the repository in an invalid peer-dependency state during installs.
- Made native-bridge login prefer the canonical `GET /v1/me` user payload immediately after authentication, so Android capability-gated navigation no longer depends on the potentially narrower token-login payload during first render.
- Refreshed the Lingui locale catalogs for the Android provisioning UI so the German navigation no longer falls back to the raw message id `62KQbc` in shipped builds.
- Aligned the frontend repo-local domain policy and validation script with the canonical Android artifact host `apk.secpal.app` so Android provisioning fixtures and runtime URLs pass governance checks.
- Strengthened Copilot governance: require test-impact analysis and same-commit test updates when a fix alters observable behavior, explicitly recommend `PREFLIGHT_RUN_TESTS=1` in preflight guidance for behavioral, security, or state-lifecycle changes, and mandate `--body-file` for programmatic PR creation to prevent shell escaping issues.
- Isolated authenticated `pre_contract` users into an onboarding-only shell, redirecting them away from normal app routes until activation and sending non-pre-contract users back to the canonical app entry when they hit `/onboarding`.
- Aligned the public onboarding completion flow with the current backend runtime by removing the unsupported profile-photo bootstrap field, submitting the documented JSON payload to `POST /v1/onboarding/complete`, and accepting the session-based completion response without a frontend token assumption
- Made browser-session login prefer the canonical `GET /v1/me` user payload immediately after authentication, so capability-gated navigation no longer comes up incomplete until the first manual refresh.
- Aligned MFA recovery-code placeholders, frontend fixtures, and service mocks with the canonical API payload shape of raw 8-character uppercase alphanumeric codes so the browser UI no longer teaches a grouped `XXXX-XXXX` format that differs from what the backend stores and returns.
- Made the checked-in Lingui `.po` catalogs the only frontend translation authority, removing the Translation.io-specific sync overlay so catalog maintenance now stays entirely repo-local.
- Refreshed the shipped MFA/login locale artifacts from the repo-local Lingui catalogs so the new MFA settings UI no longer falls back to raw Lingui message IDs in production.
- Removed the inset desktop content frame beneath the top navigation so the page surface now spans edge to edge without the previous side and bottom border effect.
- Clarified the repo-local branch-start and post-merge readiness workflow so new frontend work must start from a clean, updated local `main`, and post-merge cleanup now explicitly returns the repo to `main`, refreshes dependencies with `npm ci` where applicable, runs `npm run build` when available, and confirms a clean working tree
- Added a dedicated email-verification gate for protected routes, wired it to the backend resend-verification endpoint, and stopped surfacing the raw backend `Your email address is not verified.` error inside arbitrary app pages after login.
- Restored explicit repo-local Copilot governance by making TDD-first, quality-first, one-topic-per-PR, immediate issue creation for out-of-scope findings, and EPIC-plus-sub-issue requirements always-on again; the frontend runtime overlay now auto-loads repo-wide so these rules remain present while working
- Clarified the repo-local PR workflow so finished frontend work must be self-reviewed, committed, and pushed before any PR exists, and the first PR state must always be draft until the final PR-view self-review is clean
- Scoped the frontend zero-knowledge documentation to attachment contents only, clarifying in `README.md` and `docs/CRYPTO_ARCHITECTURE.md` that broader application data uses server-side encryption at rest and that file metadata is still visible to the server.
- Corrected the HKDF key-derivation documentation so `CRYPTO_ARCHITECTURE.md` matches the shipped frontend crypto code, which uses an empty HKDF `info` parameter for attachment file keys.
- Replaced the remaining `@secpal.app` auth-service test fixture emails in `authState.test.ts` and `authTransport.test.ts` with `@secpal.dev` so those tests follow the repository domain policy for non-production addresses.
- Aligned repo-local domain governance and validation with the renamed Android application identifier `app.secpal`, removing the old identifier-only exception from current policy text.
- Replaced the raw backend `Server Error` text on login failures with a controlled temporary-unavailable message when the login API returns a `5xx`, so browser and PWA users no longer see the uncaught backend error string on the live login screen.
- Replaced the remaining hand-written frontend auth response shapes with contract-aligned auth and MFA types under `@/types/api`, extended the auth API client to cover login MFA challenges plus the backend self-service MFA endpoints needed by the upcoming UI slices, updated the browser-session auth transport to surface the discriminated `authenticated | mfa_required` result, and added full unit coverage for all new API client methods and transport branches.

- Aligned the frontend browser-session auth contract with the backend UUID-based user payload so successful login, current-user bootstrap, persisted auth state, and onboarding handoff now accept valid string user IDs instead of incorrectly rejecting them as unsafe.
- Hardened the browser-session auth endpoint wiring so login, logout, CSRF bootstrapping, and `GET /v1/me` all build URLs from the same production-safe API resolver, which now requires an explicit absolute `VITE_API_URL` for every production deployment and fails fast on missing or relative API bases instead of guessing a host.
- Aligned repo-local domain governance and validation with the current split of `secpal.app` for the public homepage and real email addresses, `api.secpal.dev` for the API, and `app.secpal.dev` for the PWA, while keeping `app.secpal` as the Android-only application identifier
- Corrected the frontend production API fallback and related examples to use the canonical `https://api.secpal.dev` host.
- Separated customer and site feature visibility from assignment-mutation and cross-resource permissions, so only explicit collection access (`hasCustomerAccess` / `hasSiteAccess` or the matching read permission) unlocks those frontend areas and future custom roles cannot drift into implicit half-authorized states.
- Aligned customer and site feature gating with the backend collection policy by honoring explicit `hasCustomerAccess` and `hasSiteAccess` auth-context flags, so scoped-assignment users can enter the same areas the API intentionally exposes while users without any effective access continue to see the shared access-denied state.
- Clarified the employee status rules in the create and edit UI by showing the full valid status set (`Applicant`, `Pre-Contract`, `Active`, `On Leave`, `Terminated`) and by explaining inline that onboarding invitations are only available in `Pre-Contract`.
- Aligned the frontend auth client, integration tests, and migration guide with the canonical backend auth/self-service surface so browser sessions now use `POST /v1/auth/login`, `POST /v1/auth/logout`, and `GET /v1/me` instead of legacy or guessed paths
- Pinned frontend TypeScript back to the supported `5.9.x` line so `@typescript-eslint` linting no longer runs outside its declared compatibility range while the repository waits for official TypeScript 6 support

### Removed

- Removed the stale `pendingSync` field and index from the offline organizational-unit schema so the reduced IndexedDB surface no longer carries leftover generic sync metadata.

- Removed the stale sync-status translation entries from the Lingui catalogs so the frontend locale artifacts no longer carry messages for the deleted browser sync-status UI.

- Removed the stale `getPendingSyncUnits` helper and its dead organizational-unit store tests so the frontend no longer advertises an unused pending-sync browser path.

- Removed the unused `StorageQuotaIndicator` component and its dead test coverage so the frontend no longer ships that dormant browser-storage UI surface.

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

- Added a versioned `deploy/nginx/app.secpal.dev.conf` production baseline plus a `test:live:pwa-headers` smoke check so the live PWA host can enforce CSP, Permissions-Policy, HSTS, Referrer-Policy, framing protection, and correct `sw.js` / `manifest.webmanifest` header delivery under Nginx instead of relying on Apache-only `.htaccess` rules.
- Blocked the shipped Apache SPA fallback from answering `/v1/*`, `/sanctum/*`, and `/health*` with `index.html`, and documented the matching Nginx guard so API paths on `app.secpal.dev` now fail clearly instead of returning a misleading `200 text/html` shell.
- Added a live frontend smoke script for auth-route separation so deployments can automatically fail when `app.secpal.dev/v1/me` regresses to the SPA shell or `api.secpal.dev/v1/me` stops returning JSON.
- Hardened the browser/PWA response baseline by enforcing a production CSP without inline scripts, expanding `Permissions-Policy` and modern cross-origin headers, and serving `index.html`, `sw.js`, and `manifest.webmanifest` with update-safe cache rules so PWA security fixes propagate promptly.

- Reduced the shipped PWA client surface further by removing the dormant sync-status path from the runtime app shell and narrowing `SecPalDB` plus logout fallback cleanup to the currently supported offline tables so the frontend no longer ships the unused generic queue/cache runtime.

- Reduced the shipped PWA client surface further by stripping offline organizational-unit cache entries down to route/tree fields and removing dead manifest shortcuts that pointed to non-existent routes.

- Reduced shared-device post-logout bleed further by clearing stored notification preferences during logout cleanup, and added regression coverage for the IndexedDB table-clearing fallback when deleting `SecPalDB` is blocked.

- Minimized post-logout PWA persistence further by deleting `SecPalDB` instead of leaving cleared IndexedDB stores behind, reducing the service-worker offline auth cache to a bare `isAuthenticated` boolean, and preventing the logged-out sync-status UI from recreating offline session storage on the login screen.

- Tightened the PWA post-logout cleanup path so authenticated analytics state is disabled and cleared on logout, `/v1/auth/*` and `/v1/me` requests explicitly bypass browser caches, and offline logout regressions now cover both `/profile` and `/settings` to prevent stale protected content from reappearing.

- Tightened the PWA logout/offline privacy hardening by persisting an explicit logout barrier in local storage, scrubbing any stale `auth_user` payload that reappears after logout, and rejecting BFCache or cross-tab restoration paths until a fresh login writes a new authenticated state.

- Hardened PWA logout/offline privacy by synchronizing explicit auth state to the service worker, redirecting logged-out offline navigation away from protected routes such as `/profile`, and reconciling restored or cross-tab client state so previously viewed user data cannot remain readable after logout.

- Raised the frontend override floors for `brace-expansion` and `serialize-javascript` so `npm audit` now returns 0 vulnerabilities; the remaining install-time deprecation warnings still come from the upstream `vite-plugin-pwa` / `workbox-build` toolchain and remain documented as accepted build-time risk

- Pinned the transitive `picomatch` resolution to `2.3.2` for 2.x consumers and
  `4.0.4` for 4.x consumers via `overrides`, so the frontend no longer ships
  the vulnerable glob-matching releases flagged by Dependabot security alerts for
  CVE-2026-33672 / GHSA-3v7f-55p6-f55p; upstream major-version constraints remain
  unchanged while the patched releases are enforced in the lockfile and the alerts
  are tracked in #598
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

- Removed the unreachable inline error panel from `EmployeeEdit` that duplicated the full-screen error view already returned by the early-return guard, eliminating a logically dead conditional branch.
- Aligned the employee detail actions with the onboarding runtime workflow so HR/compliance users can confirm submitted onboarding dossiers via the dedicated admin endpoint and activation is only offered once the backend marks the employee `ready_for_activation`.
- Aligned the authenticated onboarding wizard with the documented runtime API surface so it now loads ordered templates from `/v1/onboarding/templates`, reuses existing submissions from `/v1/onboarding/submissions`, saves and submits through the backend's POST upsert flow with `form_template_id`, and no longer exposes the stale PATCH-only or file-upload paths that the current runtime does not provide.
- Replaced the protected-route startup dead-end on Android with a bounded auth-bootstrap recovery flow, so cached sessions no longer sit on an indefinite `Laden...` spinner when native session revalidation is slow or transiently fails; SecPal now shows an explicit retry/login recovery state and only clears auth immediately for real invalid-session errors.
- Stopped Android cached-session bootstrap from blocking protected routes when the native layer reports the device offline, so the shared frontend now checks native connectivity before `GET /v1/me` and preserves cached access instead of falling back into repeated recovery loops driven by stale `navigator.onLine` state.
- Disabled PWA service-worker registration inside the native Capacitor runtime and added native-runtime cleanup of stale browser service workers and cache storage so Android app updates no longer stay pinned to an outdated cached app shell that misses the injected native auth bridge.
- Retried transient login health-check failures before surfacing the "System not ready" blocker so Android startup races no longer leave the login screen latched in a false offline/configuration error state.
- Split frontend translation catalog maintenance into a local-only `npm run sync` flow and explicit `sync:translationio` commands, so contributors without a Translation.io API key no longer get noisy sync warnings while maintainers still have a fail-fast remote sync path.
- Replaced the remaining frontend documentation-only placeholder-domain references with `secpal.dev` / `app.secpal.dev` host examples and `secpal.app` email examples so the repo stays aligned with the SecPal domain policy outside runtime and test fixtures as well.
- Replaced the remaining non-SecPal frontend test fixtures with `secpal.dev` addresses and updated the login email placeholder to a SecPal domain. This keeps the repository aligned with the `secpal.app` / `secpal.dev` domain policy consistently.
- Filled the remaining generic German Lingui catalog gaps for employee status guidance so the frontend `de` locale no longer falls back to English for those UI strings.
- Updated the `activityLogApi` service tests to expect the configured absolute API URL, matching the current client behavior and restoring the targeted Vitest coverage for activity-log requests
- Surfaced backend `send_invitation` validation errors inline in the employee create form, showed onboarding-invitation availability reasons on employee detail pages, and aligned the terminate action with the backend by allowing it for `on_leave` employees as well as `active` ones.
- Replaced the authenticated wildcard app-route redirect to `/` with a dedicated not-found state, so unknown non-onboarding URLs now fail clearly while protected feature routes continue to use the shared access-denied UX
- distinguish temporary onboarding rate limits from invalid or expired invitation links in the onboarding completion flow, keep form-level `429` feedback inline instead of collapsing into the invalid-link screen, and surface a dedicated retry state when token validation is temporarily throttled
- Centralized frontend UI capabilities for low-privilege users so scope-only accounts stay in self-service areas and direct navigation to elevated feature routes now resolves through one shared capability guard instead of mixed ad hoc checks
- Applied the centralized low-privilege capability model to the main application navigation so management links stay hidden unless the user has the matching feature access
- Hid customer, site, and employee create/update/delete or status-transition CTAs unless the centralized UI capability model grants the matching action, so low-privilege users no longer see misleading management buttons inside accessible pages
- Harmonized low-privilege frontend route handling outside onboarding: hidden management areas now resolve to the shared in-app not-found state when users cannot discover the feature at all, create/edit routes inside known features keep the explicit access-denied state when the action itself is forbidden, and the legacy `/organizational-units` path now redirects authorized users to the canonical `/organization` route
- Aligned the employee create UI and API types with the invite-enabled backend flow by adding `send_invitation` to the create payload and surfacing persisted onboarding invitation delivery status on employee detail pages
- Aligned the frontend employee create payload type with the shared contract by making `EmployeeFormData.position` mandatory, matching the existing required create-form validation and backend/runtime expectations (fixes #578)
- Made the employee create form fail loudly instead of silently by adding Catalyst-aligned submit summaries, inline field errors, first-invalid-field focus, clearer required-field guidance for Date of Birth, Organizational Unit, Status, Contract Type, and the Leadership Position/Management Level relationship, plus structured handling for API validation errors
- Synchronized the employee create Lingui catalogs and finalized the shipped German validation and helper copy so the recent form-usability messages are present in both source and compiled locale bundles
- Replaced the incomplete `public/logo-light.svg` and `public/logo-dark.svg` placeholder contents with valid SVG logo assets that render the canonical frontend light and dark branding outputs correctly
- Moved the local Lighthouse CI CLI to on-demand `npx` execution so regular frontend installs no longer pull the deprecated `@lhci/cli` dependency chain that emitted `rimraf`, `glob@7`, and `inflight` warnings during pre-push installs
- Aligned `eslint` and `@eslint/js` with the `eslint-plugin-react-hooks` peer range by moving both packages back to the latest compatible 9.x line (`9.39.4`), so `npm ls` no longer reports an invalid frontend lint dependency tree; documented in `docs/KNOWN_ISSUES.md` that the global `minimatch: >=10.2.4` override is intentional and confirmed compatible with ESLint 9 by CI
- Replaced the deprecated PWA service-worker build setting `inlineDynamicImports` with `codeSplitting: false` via the plugin's custom SW build hook so `npm run build` no longer emits the Vite 8 deprecation warning
- Stabilized several interaction-heavy frontend tests by reusing the shared test i18n instance, mocking lazy dialog and listbox edges, and making async form/upload assertions deterministic in Vitest
- Hardened the `EmployeeCreate` success-path test to wait for loaded organizational-unit options and async navigation, reducing full-suite timeout flakiness
- Hardened additional full-suite-sensitive submit flows in `Login`, `ApplicationLayout`, and `CustomerCreate` tests to reduce timing-dependent Vitest failures

### Added

- Offline sync queue retry scheduling now persists `nextRetryAt` timestamps so pending operations can wait for their backoff window instead of retrying immediately on every local processing pass
- Sync status UI now surfaces the next scheduled offline retry time and hides the manual sync trigger while pending operations are still in their backoff window
- `.github/instructions/react-typescript.instructions.md` - targeted React and strict TypeScript guidance for frontend source and test files
- `.github/instructions/github-workflows.instructions.md` - targeted workflow and Dependabot guidance for GitHub automation files in this repo
- `.github/instructions/org-shared.instructions.md` — org-wide Copilot principles (TDD, quality gates, PR protocol); `applyTo: "**"` auto-loading was later removed during governance context cleanup
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

- **OfflineIndicator no longer blocks app interaction** (#283)
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

- **Centralized API Wrapper with Session Expiry for All Requests** (#263)
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
  - Production mode uses `https://api.secpal.dev` as fallback
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
