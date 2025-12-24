# Description

Optimizes pre-push hook by:
1. **Making dependency installation conditional** - skip `pnpm install` if `node_modules` exists (saves 3+ minutes!)
2. **Making test execution conditional** - tests already skipped, but now configurable via `PREFLIGHT_RUN_TESTS=1`

## Problem

Pre-push hook took 3+ minutes because:
- `pnpm install --frozen-lockfile` ran unconditionally (even when dependencies up-to-date)
- Tests were hard-coded to skip (not configurable)

## Solution

- Skip dependency install if `node_modules` exists
- Force reinstall via: `PREFLIGHT_FORCE_INSTALL=1 git push`
- Apply same pattern to npm and yarn sections
- Make test skip configurable via `PREFLIGHT_RUN_TESTS=1` (consistent with API repo)

## Impact

**Before:** ~3-5 minutes (install + quality gates)
**After:** ~10-30 seconds (quality gates only)
**Improvement:** ~85% faster! 🚀

Tests still run in CI, so quality is maintained.

## Related

- API PR: #420 (same optimization pattern)
- Part of monorepo-wide pre-push hook optimization

## Checklist

- [x] Code follows project style
- [x] Documentation updated
- [x] Tested locally
- [x] No breaking changes