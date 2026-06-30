<!--
SPDX-FileCopyrightText: 2025-2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# SecPal Frontend

[![Quality Gates](https://github.com/SecPal/frontend/actions/workflows/quality.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/quality.yml)
[![CodeQL](https://github.com/SecPal/frontend/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/codeql.yml)
[![PR Size](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml)
[![codecov](https://codecov.io/gh/SecPal/frontend/branch/main/graph/badge.svg)](https://codecov.io/gh/SecPal/frontend)
[![License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

React/TypeScript frontend for SecPal — operations software for German private security services.

## Product Scope

The current frontend ships the browser and PWA surfaces for SecPal's workforce operations flows:

- authenticated browser sessions with httpOnly cookie auth, MFA, and passkeys
- onboarding and activation flows for pre-contract users
- customer, site, employee, and organizational-unit management
- profile/settings, activity logs, and Android provisioning
- installable PWA behavior with service-worker updates and guarded offline support

Legacy Secrets-era password-vault content has been removed from the current route surface and is no longer described in this README.

## Runtime and Deployment

Important operational entry points for the current app:

- `app.secpal.dev` is the canonical live frontend host
- `https://api.secpal.dev` is the canonical API origin for production builds
- browser sessions use Laravel Sanctum SPA auth with CSRF bootstrapping
- production deployments must preserve the SPA routing and header hardening documented below

Current operational references:

- [docs/deployment-spa-routing.md](docs/deployment-spa-routing.md) - Apache/Nginx SPA routing, security headers, and `VITE_API_URL` requirements
- [PWA_OFFLINE_PERSISTENCE_AUDIT.md](PWA_OFFLINE_PERSISTENCE_AUDIT.md) - active offline-storage audit and follow-up issue mapping
- [CONTRIBUTING.md](CONTRIBUTING.md) - local workflow, preflight usage, and PR rules
- [SECURITY.md](SECURITY.md) - vulnerability reporting and security process

### Customer-Owned Browser Web Push Rollout

- Browser Web Push only works over HTTPS from the selected frontend deployment domain.
- The service worker must be served and registered from the same origin and scope as the deployed app.
- Supported browser rollout currently assumes a current Chrome, Edge, Firefox, or Safari release with Web Push and service-worker support.
- Registrations are tied to the signed-in browser profile plus the selected deployment domain, so changing domains, service-worker scope, site data, or signing out can require re-enabling notifications.
- The current frontend surface is intentionally limited to truthful backend-backed browser delivery state; category-by-category notification preferences are not part of the server contract yet.

#### Live Browser Web Push Smoke

Use the deployment-facing Playwright smoke to prove the real browser registration lifecycle against the selected HTTPS deployment:

```bash
export PLAYWRIGHT_BASE_URL="https://frontend-your-workspace.preview.secpal.dev"
# Required when the API host cannot be derived from the selected frontend host.
export PLAYWRIGHT_API_BASE_URL="https://api-your-workspace.preview.secpal.dev"
# Required for live browser notification permission on deployment-facing HTTPS targets.
export CHROME_PATH="/usr/bin/chromium"

# Required for non-preview live targets such as app.secpal.dev.
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="password"

npm run test:e2e:live:web-push
```

Required deployment and operator prerequisites:

- `PLAYWRIGHT_BASE_URL` must point to the exact HTTPS frontend deployment you want to verify; the smoke refuses local HTTP targets.
- `CHROME_PATH` must point to a stable system Chrome/Chromium binary; the bundled Playwright Chromium snapshot denies notification permission on live HTTPS targets.
- The smoke runs in a headed persistent Chromium profile because deployment-facing Web Push subscription creation is rejected in Playwright's default ephemeral browser context. On headless Linux hosts, `npm run test:e2e:live:web-push` auto-starts `/usr/bin/Xvfb` when available.
- The selected deployment must serve an active same-origin service worker for the app shell.
- `GET /v1/bootstrap?client_platform=browser` must publish `notification_channels.web_push` with browser runtime metadata for that deployment.
- The test user must be able to authenticate with browser-session login on the selected deployment.
- For non-canonical hosts, set `PLAYWRIGHT_API_BASE_URL` explicitly so the smoke can reach the matching API deployment.
- Run the smoke in desktop Chromium; the script already pins `--project=chromium` because notification permission and push diagnostics are collected there.

What the smoke proves:

- bootstrap metadata publication for `notification_channels.web_push`
- granted browser notification permission under HTTPS with a same-origin service worker
- authenticated `PUT /v1/me/notification-installations/{installationId}` registration
- sign-out driven cleanup that hits the canonical `DELETE /v1/me/notification-installations/{installationId}` path and clears local browser push state

The smoke fails with explicit diagnostics when bootstrap metadata is missing, the service worker/origin requirements are not met, or the registration/delete requests are rejected by the selected deployment.

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

This project uses `src/ui` as the canonical shadcn/Radix/Lucide layer for
application UI components.

**shadcn metadata:** `components.json` pins the `new-york` style, TypeScript
React output, Tailwind v4 CSS entry at `src/index.css`, the `zinc` base color,
Lucide icons, and the canonical aliases (`@/ui`, `@/components`, `@/lib`,
`@/hooks`, `@/lib/utils`).
**Components:** Shared primitives, shell composition, route-specific prefixed
helpers, and canonical `cn` live in `src/ui`. Production code must not import
deprecated `src/components` UI wrappers, route-local UI barrels, or shared
compatibility aliases; `tests/legacy-ui-guardrails.test.ts` keeps that
inventory at zero.
**Routing:** React Router v7 with client-side navigation
**Typography:** Inter font family
**Icons:** Lucide React
**License:** AGPL-3.0-or-later
**Documentation:** [`src/ui/MIGRATION.md`](src/ui/MIGRATION.md)

## 📋 Prerequisites

- Node.js `^22.19.0 || >=24.0.0` (Node 22.19+ or 24+; `.nvmrc` pins major `22`; CI uses Node 22)
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
- **AI Instructions**: [AGENTS.md](AGENTS.md) - authoritative AI development guidelines
- **Copilot Compatibility Mirror**: [.github/copilot-instructions.md](.github/copilot-instructions.md) - compatibility path for tools that auto-load GitHub Copilot instructions

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
- [api](https://github.com/SecPal/api) - Laravel backend

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/SecPal/frontend/issues)
- **Security:** See [SECURITY.md](SECURITY.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

**Maintained by:** SecPal Team
