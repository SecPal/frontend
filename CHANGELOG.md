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
