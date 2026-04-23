<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# SecPal Frontend

[![Quality Gates](https://github.com/SecPal/frontend/actions/workflows/quality.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/quality.yml)
[![CodeQL](https://github.com/SecPal/frontend/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/codeql.yml)
[![PR Size](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml)
[![codecov](https://codecov.io/gh/SecPal/frontend/branch/main/graph/badge.svg)](https://codecov.io/gh/SecPal/frontend)
[![License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

React/TypeScript frontend for SecPal — operations software for German private security services.

## 📱 Progressive Web App (PWA)

SecPal is an **offline-first PWA** providing seamless experience regardless of network connectivity.

**Core Features:**

- 📴 **Offline Support**: Service Worker with intelligent caching strategies
- 📲 **Installable**: Add to home screen on mobile/desktop
- 🔄 **Auto-Updates**: Automatic service worker updates
- 🌐 **Network Detection**: Real-time online/offline status monitoring
- 💾 **Smart Caching**: NetworkFirst for API, CacheFirst for static assets

**Phase 3 Features (Issue #67):**

- 🔔 **Push Notifications**: Permission management, Service Worker integration, preference UI
- 📤 **Share Target API**: Receive shared content (text, URLs, images, PDFs, documents) from other apps
- 📊 **Offline Analytics**: Privacy-first event tracking with IndexedDB persistence
  - **⚠️ Note**: Backend sync not yet implemented. Analytics events are tracked and stored locally in IndexedDB but are not currently sent to a server. Events are marked as "synced" locally for development/testing purposes only. Production implementation will require an analytics backend endpoint (Issue #101).

**Using PWA Features:**

```tsx
// Push Notifications
import { useNotifications } from "@/hooks/useNotifications";

const { permission, requestPermission, showNotification } = useNotifications();

// Share Target API
import { useShareTarget } from "@/hooks/useShareTarget";

const { sharedData, clearSharedData } = useShareTarget();

// Offline Analytics
import { getAnalytics } from "@/lib/analytics";

try {
  const analytics = getAnalytics();
  await analytics.trackPageView("/dashboard", "Dashboard");
  await analytics.trackClick("submit-button", { form: "login" });
} catch (error) {
  // Handle analytics not available (older browsers)
  console.warn("Analytics not supported:", error);
}
```

See the project's `CONTRIBUTING.md` for development guides and testing instructions.

## 🔐 Client-Side File Encryption

SecPal implements **end-to-end client-side file encryption** for file attachments using the Web Crypto API with **AES-GCM-256**. Attachment contents are encrypted on the client before upload, giving those files a **zero-knowledge** path where the backend cannot decrypt file contents.

Employee and tenant data outside attachment contents use server-side encryption at rest, not zero-knowledge encryption, and attachment metadata such as filenames and sizes remains visible to the server.

**Key Features:**

- 🔒 **Zero-Knowledge File Contents**: Backend cannot decrypt attachment contents
- 🔑 **AES-GCM-256**: Industry-standard authenticated encryption
- 🧬 **HKDF-SHA-256**: Secure key derivation per file
- ✅ **Integrity Verification**: SHA-256 checksums detect tampering
- 📱 **Share Target Integration**: Encrypt files shared from other apps
- 🔄 **Background Sync**: Automatic retry on network failures
- 📊 **Progress Tracking**: Real-time upload status with queue management

**Usage Example:**

```tsx
import { encryptFile, deriveFileKey } from "@/lib/crypto/encryption";
import { uploadEncryptedAttachment } from "@/services/secretApi";

// Encrypt and upload a file
const fileData = new Uint8Array(await file.arrayBuffer());
const fileKey = await deriveFileKey(masterKey, file.name);
const encrypted = await encryptFile(fileData, fileKey);

await uploadEncryptedAttachment(secretId, encrypted, {
  filename: file.name,
  type: file.type,
  size: file.size,
  checksum: await calculateChecksum(fileData),
});
```

**Security Documentation:**

For comprehensive security details, threat model, and cryptographic guarantees, see:

📘 **[CRYPTO_ARCHITECTURE.md](docs/CRYPTO_ARCHITECTURE.md)** - Complete encryption architecture documentation

**Implementation Status:**

- ✅ Phase 1: Crypto Utilities (PR #177, merged 19.11.2025)
- ✅ Phase 2: ShareTarget Integration (PR #178, merged 19.11.2025)
- ✅ Phase 3: Upload Integration (PR #187, merged 21.11.2025)
- ✅ Phase 4: Download & Decryption (PR #188, merged 21.11.2025)
- ✅ Phase 5: Security Audit & Documentation (PR #190, merged 22.11.2025)

## 🔒 Authentication (httpOnly Cookies)

SecPal uses **httpOnly cookie-based authentication** with Laravel Sanctum SPA mode for enhanced security. This protects authentication tokens from XSS attacks.

**Security Benefits:**

- 🛡️ **XSS Protection**: httpOnly cookies not accessible to JavaScript
- 🔐 **CSRF Protection**: Sanctum CSRF token validation for state-changing requests
- ✅ **Secure Attributes**: Cookies use `Secure`, `SameSite=Lax` in production
- 🚫 **No localStorage**: Tokens never stored in localStorage (no XSS exposure)

**Authentication Flow:**

```typescript
import { login, logout } from "@/services/authApi";

// Login (CSRF token fetched automatically)
const response = await login({
  email: "user@secpal.app",
  password: "SecurePassword123!",
});
// Response: { user: { id, name, email } }
// Session cookie set by backend (httpOnly, not accessible to JS)

// Logout (revokes session)
await logout();
```

**Making Authenticated Requests:**

```typescript
import { fetchWithCsrf } from "@/services/csrf";

// For state-changing requests (POST, PUT, PATCH, DELETE)
const response = await fetchWithCsrf("https://api.secpal.dev/v1/secrets", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "My Secret" }),
});
// ✅ credentials: include added automatically
// ✅ X-XSRF-TOKEN header added automatically
// ✅ 419 retry handled automatically

// For GET requests (no CSRF needed)
const response = await fetch("https://api.secpal.dev/v1/secrets", {
  credentials: "include", // REQUIRED: Sends cookies
});
```

**Migration from localStorage:**

Previous versions used localStorage for token storage, which was vulnerable to XSS attacks. The migration to httpOnly cookies significantly improves security.

📘 **[docs/authentication-migration.md](docs/authentication-migration.md)** - Complete migration guide with troubleshooting

**Implementation Status:**

- ✅ Backend PR-1: Sanctum SPA Configuration & CORS Setup (SecPal/api#209, merged 22.11.2025)
- ✅ Backend PR-2: CSRF Token Endpoint & Security Hardening (SecPal/api#210, merged 23.11.2025)
- ✅ Backend PR-3: Tests & API Documentation Update (SecPal/api#208, merged 23.11.2025)
- ✅ Frontend PR-1: localStorage Removal & httpOnly Cookie Migration (#210, merged 23.11.2025)
- ✅ Frontend PR-2: CSRF Token Handling & Request Interceptor (#211, merged 23.11.2025)
- ✅ Frontend PR-3: Integration Tests & Developer Documentation (#212, current PR)

## 🔐 Secret Management (Password Vault UI)

SecPal provides a comprehensive **password vault UI** with encrypted storage, file attachments, and sharing capabilities.

**Features (Phases 1-3 Complete):**

- 📋 **Secret List & Detail Views**: Browse, search, and filter secrets with grid/list toggle
  - Search by title, filter by tags/expiration status
  - Pagination (20 items/page)
  - Password show/hide toggle
  - Expiration badges, attachment count, shared indicator
- ✏️ **Create/Edit Forms**: Full CRUD operations with validation
  - Title, username, password, URL, notes fields
  - Client-side validation
  - Loading states and error handling
- 📎 **File Attachments**: Upload, download, preview encrypted files
  - Drag-and-drop upload with file validation (10MB max)
  - Image preview with zoom controls (50%-200%)
  - PDF preview in modal
  - File type validation (images, PDFs, documents)
  - Download with automatic decryption

**Usage Example:**

```tsx
import { SecretList } from "@/pages/Secrets/SecretList";
import { SecretDetail } from "@/pages/Secrets/SecretDetail";

// List all secrets
<SecretList />

// View secret details
<SecretDetail secretId="uuid" />
```

**Implementation Status:**

- ✅ Phase 1: Secret List & Detail Views (PR #197, merged 22.11.2025)
- ✅ Phase 2: Secret Create/Edit Forms (PR #198, merged 22.11.2025)
- ✅ Phase 3: File Attachments UI Integration (PR #200, merged 22.11.2025)
- 🔜 Phase 4: Secret Sharing UI (Issue #195)
- 🔜 Phase 5: Offline Support & PWA Integration (Issue #196)

## 🌍 Internationalization (i18n)

SecPal supports multiple languages using [Lingui](https://lingui.dev/) with checked-in `.po` catalogs.

**Supported Languages:**

- 🇬🇧 English (source)
- 🇩🇪 German (Deutsch)

**Translation Management:**

```bash
# Extract translatable strings from source code
npm run lingui:extract

# Compile translation catalogs for production
npm run lingui:compile

# Extract and compile the checked-in `.po` catalogs
npm run sync

# Extract, compile, and remove unused translations
npm run sync:purge

# Verify that the checked-in catalogs are fully in sync
npm run i18n:check
```

**Workflow:**

The checked-in Lingui `.po` catalogs are the source of truth. Update source strings with `npm run sync` or `npm run sync:purge`, then review and edit the resulting `.po` files directly or in a gettext editor such as POedit.
Use `npm run i18n:check` before opening a PR when you touched translatable strings; the frontend test suite runs the same guard in CI so stale catalogs cannot merge silently.

**Adding Translations:**

```tsx
import { Trans } from "@lingui/react/macro";

// Simple text
<Trans>Hello World</Trans>

// With variables
<Trans>Welcome, {userName}</Trans>
```

## 🎨 UI Components & Design System

This project uses [**Catalyst UI Kit**](https://catalyst.tailwindui.com/) by [Tailwind Labs](https://tailwindcss.com/plus) for its application UI components.

**Components:** 27 production-ready React components
**Routing:** React Router v7 with client-side navigation
**Typography:** Inter font family (optimized for Catalyst)
**Icons:** Heroicons (16×16 and 20×20)
**License:** [Tailwind Plus License](https://tailwindcss.com/plus/license)
**Documentation:** [Catalyst Docs](https://catalyst.tailwindui.com/docs)

## 📋 Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git with GPG signing configured

## 🚀 Getting Started

### Clone Repository

```bash
cd ~/code/SecPal
git clone https://github.com/SecPal/frontend.git
cd frontend
```

### Install Dependencies

```bash
npm install
```

### Setup Pre-Commit Hooks

```bash
./scripts/setup-pre-commit.sh
```

## 🛠️ Development

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Type checking
npm run typecheck

# Format code
npm run format

# Check formatting
npm run format:check
```

### Pre-Push Validation

**Before every push**, run the preflight script:

```bash
# Fast mode (no tests, ~30s)
./scripts/preflight.sh

# With tests (~2-5 min)
PREFLIGHT_RUN_TESTS=1 ./scripts/preflight.sh
```

⚡ **Performance:** Tests are skipped by default for faster workflow. Tests always run in CI.

This runs:

- ✅ Prettier formatting check
- ✅ Markdownlint
- ✅ REUSE compliance
- ✅ ESLint
- ✅ TypeScript type checking
- ⏭️ Tests (skipped by default, run in CI)
- ✅ PR size validation (≤600 lines)

## 📁 Project Structure

```text
frontend/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom hooks
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── types/          # TypeScript types
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Root component
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── tests/              # Test files
├── .github/            # GitHub workflows and templates
├── scripts/            # Build and utility scripts
└── package.json        # Dependencies and scripts
```

## 🧪 Testing Guidelines

- **Coverage target:** 80%+ for new code, 100% for critical paths
- **TDD mandatory:** Write failing test first, implement, refactor
- Use `@testing-library/react` for component testing
- Mock API calls with MSW (Mock Service Worker)
- Test user-visible behavior, not implementation

## 🔒 Security

- **Secret scanning:** Enabled with push protection
- **Dependabot:** Daily security updates (04:00 CET)
- **SAST:** CodeQL analysis on pull requests
- **Never commit:** API keys, passwords, tokens, `.env` files

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## 📝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Quick Links:**

- **TDD Workflow**: [docs/development/TDD_WORKFLOW.md](docs/development/TDD_WORKFLOW.md) - Learn how to practice Test-Driven Development with Git verification
- **Copilot Instructions**: [.github/copilot-instructions.md](.github/copilot-instructions.md) - AI development guidelines

**Key Requirements:**

- Test-Driven Development (TDD) is **mandatory** - tests must be written before implementation
- PRs must be ≤600 lines (excluding generated files)
- One PR = one topic (no mixing features/fixes/docs)
- All commits must be GPG-signed

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions/fixes
- `chore/` - Maintenance
- `spike/` - Exploration (no TDD required, cannot merge to main)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add user authentication
fix: resolve memory leak in dashboard
docs: update API integration guide
test: add tests for login form
```

## 🤖 Automation

This repository uses automated project board management. Issues and PRs are automatically added to the [SecPal Roadmap](https://github.com/orgs/SecPal/projects/1) with status based on labels and PR state.

**Quick Start:**

```bash
# Create issue (auto-added to project board)
gh issue create --label "enhancement" --title "..."

# Draft PR workflow (recommended)
gh pr create --draft --body "Closes #123"  # → 🚧 In Progress
gh pr ready <PR>                            # → 👀 In Review
gh pr merge <PR> --squash                   # → ✅ Done
```

See [Project Automation docs](https://github.com/SecPal/.github/blob/main/docs/workflows/PROJECT_AUTOMATION.md) for details.

## 📜 License

**AGPL-3.0-or-later** - See [LICENSE](LICENSE) for details.

This project is REUSE 3.3 compliant. All files contain SPDX license headers.

## 🔗 Related Repositories

- [Contracts](https://github.com/SecPal/contracts) - OpenAPI 3.1 specifications
- [.github](https://github.com/SecPal/.github) - Organization-wide settings and documentation
- API - Laravel backend (planned)

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/SecPal/frontend/issues)
- **Security:** See [SECURITY.md](SECURITY.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

**Maintained by:** SecPal Team
**Last Updated:** October 2025
