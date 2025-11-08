<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Known Issues

This document tracks known issues that are outside our direct control and require upstream fixes.

## npm Deprecation Warnings

### Status: Tracked, Awaiting Upstream Fix

When running `npm ci` or fresh `npm install`, you may see deprecation warnings for the following packages:

```text
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.
  Do not use it. Check out lru-cache if you want a good and tested way to coalesce
  async requests by a key value, which is much more comprehensive and powerful.

npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported

npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead

npm warn deprecated source-map@0.8.0-beta.0: The work that was done in this beta
  branch won't be included in future versions
```

### Root Cause

These are **transitive dependencies** from:

- `vite-plugin-pwa@1.1.0` → `workbox-build@7.3.0` → `glob@7.2.3` → `inflight@1.0.6`
- `vite-plugin-pwa@1.1.0` → `workbox-build@7.3.0` → `sourcemap-codec@1.4.8`
- `@lingui/cli@5.5.2` → `source-map@0.8.0-beta.0`

### Impact Assessment

- **Security**: ✅ No known CVEs
- **Memory Leak** (`inflight`): ⚠️ Potential issue, but workbox-build usage is limited to build-time only
- **Functionality**: ✅ All features work correctly
- **Build Process**: ✅ No impact on build or runtime

### Why We Can't Fix This Directly

1. **`workbox-build@7.3.0`** is the latest version and still uses these deprecated packages
2. **`vite-plugin-pwa@1.1.0`** is the latest version and depends on `workbox-build@7.3.0`
3. **npm overrides** would force untested versions that could break the build process
4. **Forking/patching** violates our maintenance principles (would need ongoing updates)

### What We're Doing

- ✅ Monitoring upstream repositories for updates
- ✅ Testing new versions as they're released
- ✅ Documented in this file for team awareness
- ⏳ Waiting for `workbox-build` v8.x or `vite-plugin-pwa` v2.x

### Upstream Issues

- [GoogleChrome/workbox#3252](https://github.com/GoogleChrome/workbox/issues/3252) - Tracking deprecated dependencies
- [vite-pwa/vite-plugin-pwa#854](https://github.com/vite-pwa/vite-plugin-pwa/issues/854) - Workbox 8.x support

### Workaround for Clean CI Logs

If these warnings are causing CI noise, you can suppress them:

```bash
npm ci 2>&1 | grep -v "npm warn deprecated"
```

**Note:** We recommend **NOT** suppressing warnings to ensure visibility of new issues.

### When This Will Be Resolved

> **Note:** The following estimates are speculative and based on current upstream development activity; actual release dates may vary significantly.

Expected resolution timeline:

- **Q1 2026**: `workbox@8.x` likely to drop `glob@7` and `inflight`
- **Q2 2026**: `vite-plugin-pwa@2.x` likely to adopt `workbox@8.x`

We will update dependencies as soon as stable versions are available.

---

**Last Updated**: 2025-11-08
**Reviewed By**: SecPal Team
**Status**: Accepted Risk (Non-Critical)
