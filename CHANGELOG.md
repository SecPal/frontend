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
