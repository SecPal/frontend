<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Secret Management Frontend - Phase 3: File Attachments UI Integration (Display)** (#194, Part of #191) - **MERGED 22.11.2025**
  - `AttachmentUpload.tsx` component with drag-and-drop and file validation
  - `AttachmentPreview.tsx` modal for images and PDFs with zoom controls
  - Integration of `AttachmentList` component in `SecretDetail.tsx`
  - Download, delete, and preview handlers with master key management
  - File size limits (10MB) and type validation (images, PDFs, documents)
  - Security: Blocks executable files, validates MIME types
  - 21 new unit tests (547 total tests passing)
  - Coverage: 87.95% (exceeds 80% requirement)
  - Part of Secret Management Epic #191 (Phase 3/5)

- **Secret Management Frontend - Phase 2: Secret Create/Edit Forms** (#193, Part of #191) - **MERGED 22.11.2025**
  - `SecretForm.tsx` reusable form component with validation
  - `SecretCreate.tsx` page for creating new secrets
  - `SecretEdit.tsx` page for editing existing secrets
  - API service extensions: `createSecret()`, `updateSecret()`
  - Client-side validation and error handling
  - Password show/hide toggle for security
  - 28 new unit tests (all passing)
  - Routing: `/secrets/new` and `/secrets/:id/edit`
  - Part of Secret Management Epic #191 (Phase 2/5)

- **Secret Management Frontend - Phase 1: Secret List & Detail Views** (#192, Part of #191) - **MERGED 22.11.2025**
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
