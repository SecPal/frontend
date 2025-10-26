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
