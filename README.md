<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# SecPal Frontend

[![Quality Gates](https://github.com/SecPal/frontend/actions/workflows/quality.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/quality.yml)
[![CodeQL](https://github.com/SecPal/frontend/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/codeql.yml)
[![PR Size](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml/badge.svg)](https://github.com/SecPal/frontend/actions/workflows/pr-size.yml)
[![License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

React/TypeScript frontend for the SecPal platform.

## 📱 Progressive Web App (PWA)

SecPal is an **offline-first PWA** providing seamless experience regardless of network connectivity.

**Features:**

- 📴 **Offline Support**: Service Worker with intelligent caching strategies
- 📲 **Installable**: Add to home screen on mobile/desktop
- 🔄 **Auto-Updates**: Automatic service worker updates
- 🌐 **Network Detection**: Real-time online/offline status monitoring
- 💾 **Smart Caching**: NetworkFirst for API, CacheFirst for static assets

## 🌍 Internationalization (i18n)

SecPal supports multiple languages using [Lingui](https://lingui.dev/) and [Translation.io](https://translation.io/).

**Supported Languages:**

- 🇬🇧 English (source)
- 🇩🇪 German (Deutsch)

**Translation Management:**

```bash
# Extract translatable strings from source code
npm run lingui:extract

# Compile translation catalogs for production
npm run lingui:compile

# Sync with Translation.io (requires TRANSLATION_IO_API_KEY in .env.local)
npm run sync

# Sync and remove unused translations
npm run sync:purge
```

**Setup Translation.io (Optional):**

Translation.io integration is optional. For local development, you can edit `.po` files directly.

To enable Translation.io sync:

1. Get a free API key from [Translation.io](https://translation.io/)
2. Create `.env.local` in the frontend directory
3. Add: `TRANSLATION_IO_API_KEY=your_key_here`

**Adding Translations:**

```tsx
import { Trans } from "@lingui/macro";

// Simple text
<Trans>Hello World</Trans>

// With variables
<Trans>Welcome, {userName}</Trans>
```

**Translation Service:** This project uses [Translation.io](https://translation.io/) for collaborative translation management. Translation.io provides a free, unlimited account for open-source projects. Thank you, Translation.io! 🙏

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
./scripts/preflight.sh
```

This runs:

- ✅ Prettier formatting check
- ✅ Markdownlint
- ✅ REUSE compliance
- ✅ ESLint
- ✅ TypeScript type checking
- ✅ Vitest test suite
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
