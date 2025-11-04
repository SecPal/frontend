<!-- SPDX-FileCopyrightText: 2025 SecPal -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Project Status - SecPal Frontend

**Last Updated**: 2025-11-04
**Branch**: `main`
**Version**: Pre-Release (Development)

---

## 🎯 Current Milestone: PWA Infrastructure Epic (#64)

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

- **Test Coverage**: 70 tests passing
- **TypeScript**: 0 errors (strict mode enabled)
- **ESLint**: 0 warnings
- **REUSE Compliance**: 3.3 ✅
- **Code Formatting**: Prettier + markdownlint ✅

### Test Distribution

- API Cache & Sync Logic: 30 tests
- Database Operations: 12 tests
- UI Components: 22 tests
- Hooks & Utilities: 6 tests

### Dependencies

- React 18.3.1
- TypeScript (strict mode)
- Dexie.js 4.2.1 + dexie-react-hooks 4.2.0
- Lingui 5.5.2 (i18n)
- TailwindCSS 4.1
- Vite 6.0.7
- Vitest 4.0.6

---

## 🚀 Next Steps

### Phase 3 Remaining (Epic #64)

#### 1. Push Notifications

**Priority**: High
**Status**: Not Started
**Description**: Server-sent notifications for important events

- Web Push API integration
- Service Worker push handlers
- User notification preferences
- Notification scheduling

**Acceptance Criteria**:

- [ ] User can enable/disable notifications
- [ ] Notifications work when app is closed
- [ ] Proper permission handling
- [ ] Notification badges on app icon

#### 2. Share Target API

**Priority**: Medium
**Status**: Not Started
**Description**: Allow users to share content to SecPal

- Manifest share_target configuration
- Handle incoming shared data
- Process shared text/files
- Integration with existing entities

**Acceptance Criteria**:

- [ ] App appears in system share menu
- [ ] Can receive text/links
- [ ] Can receive files/images
- [ ] Proper error handling

#### 3. Offline Analytics

**Priority**: Low
**Status**: Not Started
**Description**: Track analytics events while offline

- Queue analytics events in IndexedDB
- Batch send when online
- Basic usage metrics
- Privacy-preserving design

**Acceptance Criteria**:

- [ ] Events captured while offline
- [ ] Automatic sync when online
- [ ] Minimal storage footprint
- [ ] GDPR compliant

---

## 🐛 Known Issues

### Current

- None (all Copilot review comments addressed)

### Technical Debt

- Consider splitting large PR (1287 lines) into smaller focused PRs in future
- Evaluate Lingui macro compatibility with Vitest for better i18n testing

---

## 📋 Recent Changes

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

**Lessons Learned**:

- Always check Copilot comments BEFORE pushing
- Test auto-sync behavior carefully (race conditions)
- Keep useEffect dependencies minimal but correct
- Document domain strategy explicitly

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
