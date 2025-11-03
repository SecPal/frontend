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

- **Catalyst Setup Completion**: Production-ready configuration
  - React Router v7 for client-side navigation with SPA routing
  - Inter font family integration via @fontsource/inter (weights 400-700)
  - Heroicons icon library (@heroicons/react) for UI consistency
  - Updated Link component for React Router integration
  - Tailwind @theme configuration with Inter and font features
  - Demo routes (Home, About) showcasing routing capabilities
  - Updated tests for new router-based structure

- **Catalyst UI Kit integration**: All 27 Catalyst components
  - Components: Alert, Avatar, Badge, Button, Checkbox, Combobox, Dialog, Dropdown, Input, Select, Table, etc.
  - Dependencies: `@headlessui/react`, `motion`, `clsx`
  - Documentation reference in README
  - SPDX license headers for REUSE compliance

### Fixed

- Pre-push hook no longer fails with exit code 1 when [Unreleased] is the last CHANGELOG section
- Project automation now triggers on label changes for issues AND pull requests (labeled event)

### Added (Previous)

- Initial repository setup
- React + TypeScript + Vite configuration
- Testing setup with Vitest and React Testing Library
- REUSE 3.3 compliance
- Pre-commit and pre-push quality gates

[unreleased]: https://github.com/SecPal/frontend/commits/main
