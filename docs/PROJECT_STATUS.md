<!-- SPDX-FileCopyrightText: 2025 SecPal -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Project Status - SecPal Frontend

**Last Updated**: 2025-11-06
**Branch**: `main`
**Version**: Pre-Release (Development)

---

## 🎯 Current Milestone: PWA Infrastructure Epic (#64) - ✅ COMPLETED

### ✅ Completed Phases

#### Phase 1: Foundation

- ✅ Basic React setup with TypeScript
- ✅ Routing and navigation
- ✅ TailwindCSS 4.1 integration
- ✅ Dark mode support
- ✅ i18n with Lingui (English + German)

#### Phase 2: Core PWA Features (PR #88)

- ✅ **IndexedDB Integration with Dexie.js**
  - Database schema (guards, sync queue, API cache)
  - Full TypeScript type safety
  - 12 comprehensive tests
- ✅ **Offline Detection UI**
  - Real-time online/offline indicator
  - User feedback for connectivity status
- ✅ **PWA App Shortcuts**
  - Quick actions from home screen/taskbar
  - Predefined shortcuts for common tasks

#### Phase 3: Advanced PWA Features (PR #90) - ✅ **MERGED 2025-11-04**

- ✅ **Background Sync API**
  - Workbox Background Sync integration
  - Exponential backoff retry (1s → 2s → 4s → 8s → 16s)
  - Max 5 retry attempts with 24-hour retention
  - Batch processing of pending operations
  - Status tracking: pending → synced/error
  - 15 comprehensive tests
- ✅ **Sync Status Indicator UI**
  - Real-time display with Dexie React Hooks
  - Auto-sync when device comes online
  - Manual sync trigger button
  - Last sync timestamp
  - Error messages with retry info
  - 9 comprehensive tests
- ✅ **Flexible Configuration System**
  - `src/config.ts` for multi-tenant deployments
  - Environment variable overrides (VITE_API_URL)
  - Centralized retry/timeout configuration
  - Auth header management
- ✅ **Domain Strategy**
  - Production: `api.secpal.app`
  - Demo/Testing: `api.secpal.dev`
  - On-Premise: Customer-specific URLs

---

## 📊 Current Statistics

### Code Quality

- **Test Coverage**: **131 tests passing** (+67 from Phase 3)
- **TypeScript**: 0 errors (strict mode enabled)
- **ESLint**: 0 warnings
- **REUSE Compliance**: 3.3 ✅
- **Code Formatting**: Prettier + markdownlint ✅

### Test Distribution

- PWA Features (Notifications, Share, Analytics): 46 tests
- API Cache & Sync Logic: 30 tests
- Database Operations: 18 tests (+6 from analytics table)
- UI Components: 37 tests (+15 from NotificationPreferences)

### Dependencies

- React 18.3.1
- TypeScript (strict mode)
- Dexie.js 4.2.1 + dexie-react-hooks 4.2.0
- Lingui 5.5.2 (i18n)
- TailwindCSS 4.1
- Vite 6.0.7
- Vitest 4.0.6
- VitePWA 0.21.x (Push Notifications, Share Target)

#### Phase 3: PWA Phase 3 Features (Issue #67) - ✅ **COMPLETED 2025-11-06**

- ✅ **Push Notifications**
  - `useNotifications` hook with permission management
  - Service Worker notification display
  - `NotificationPreferences` component (Catalyst UI)
  - LocalStorage persistence for preferences
  - 4 notification categories support
  - 13 comprehensive tests
- ✅ **Share Target API**
  - PWA manifest share_target configuration
  - `useShareTarget` hook for URL parameter parsing
  - Support for text, URLs, images, PDFs, documents
  - Automatic URL cleanup after processing
  - 11 comprehensive tests
- ✅ **Offline Analytics**
  - `OfflineAnalytics` singleton with IndexedDB
  - Automatic sync when online (5-minute intervals)
  - Session ID generation and user tracking
  - 6 event types: page_view, button_click, form_submit, error, performance, feature_usage
  - Statistics API and 30-day retention
  - 22 comprehensive tests
- ✅ **IndexedDB Schema v2**
  - Analytics table with indexes
  - Automatic migration from v1 to v2
  - Breaking change handled gracefully

**Total Impact**: 67 new tests, 131 tests passing

---

## 🚀 Next Steps

### Feature Development

PWA Infrastructure Epic (#64) is now complete! Next priorities:

---

## 🐛 Known Issues

### Current

- None (all Copilot review comments addressed)

### Technical Debt

- Consider splitting large PR (1287 lines) into smaller focused PRs in future
- Evaluate Lingui macro compatibility with Vitest for better i18n testing

---

## 📋 Recent Changes

### PR #XX - PWA Phase 3 Features (In Progress 2025-11-06)

**Scope**: Issue #67 - Complete PWA Infrastructure Epic

**Features Implemented**:

1. **Push Notifications** (useNotifications + NotificationPreferences)
2. **Share Target API** (useShareTarget + manifest config)
3. **Offline Analytics** (OfflineAnalytics singleton + IndexedDB)

**Key Decisions**:

- Use Catalyst Design System for all UI (NotificationPreferences)
- IndexedDB schema v2 with automatic migration
- Privacy-first analytics (no external tracking, local storage only)
- 5-minute periodic sync for analytics (balance between freshness and battery)
- Support for DDEV development (secpal-api.ddev.site)
- Comprehensive testing guide (PWA_PHASE3_TESTING.md)

**Statistics**:

- 10 new files (7 implementation + 3 test files)
- 3 modified files (config, db, testing guide)
- 67 new tests (+105% test coverage increase)
- 131 total tests passing
- ~1500 lines of new code

**Lessons Learned**:

- Complete English translation BEFORE PR creation
- Review all changes locally before pushing
- Test IndexedDB migrations thoroughly
- Document on-premise configuration flexibility
- Catalyst components provide excellent accessibility out-of-box

---

### PR #90 - Background Sync API (Merged 2025-11-04)

**Commits**:

1. Initial implementation with Workbox Background Sync
2. Fixed 6 initial Copilot review comments
3. Changed test domains to secpal.dev
4. Fixed 6 remaining Copilot comments (config references)

**Key Decisions**:

- Use centralized config for retry logic (maintainability)
- Technical error messages not localized (debug info, not user-facing)
- Auto-sync only on online status change (not on every pendingOps update)
- Pragmatic i18n: `<Trans>` for UI, plain strings for errors

---

## 🔐 Security & Compliance

### Authentication

- Bearer token support via localStorage
- `getAuthHeaders()` helper for all API calls
- Token injection in sync operations

### REUSE Compliance

- All files have SPDX headers
- License compatibility checked
- 96/96 files compliant

### Data Privacy

- Local-first architecture (IndexedDB)
- No telemetry/tracking (yet)
- Offline-first design
- User data stays on device until synced

---

## 📚 Documentation

### Available Documentation

- `CHANGELOG.md` - Detailed version history
- `README.md` - Project overview and setup
- `DEVELOPMENT.md` - Development guidelines
- JSDoc comments on all functions
- Inline code comments for complex logic

### Planned Documentation

- API Integration Guide
- Deployment Guide (on-premise)
- User Manual (end-user facing)
- Architecture Decision Records (ADRs)

---

## 🤝 Contributing

### Quality Standards

- ✅ TDD mandatory (tests before implementation)
- ✅ ≥80% code coverage
- ✅ TypeScript strict mode
- ✅ Signed commits
- ✅ REUSE 3.3 compliance
- ✅ Copilot review comments addressed

### Review Process

1. Create feature branch
2. Implement with tests
3. Address Copilot comments
4. Self-review before push
5. PR review by maintainers
6. Merge to main

---

## 🎓 Key Learnings from PR #90

1. **Config Management**: Centralized configuration is critical for multi-tenant apps
2. **Domain Strategy**: Separate domains for prod/demo/test prevents confusion
3. **Auto-Sync**: Be careful with useEffect dependencies to avoid infinite loops
4. **i18n Strategy**: Pragmatic approach - translate UI, not technical error messages
5. **Code Review**: Always review Copilot comments before pushing
6. **Testing**: Live queries (Dexie React Hooks) need careful test setup

---

**Status**: 🟢 Ready for Phase 3 continuation
**Next Session**: Implement Push Notifications or continue with next priority feature
