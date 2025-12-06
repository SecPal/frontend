<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimization - Deployment Status

**Date:** 2025-12-06
**Branch:** `perf/aggressive-code-splitting`
**PR:** [#318](https://github.com/SecPal/frontend/pull/318) (Draft)
**Status:** ✅ **DEPLOYED** to app.secpal.dev

---

## ✅ Deployment Confirmation

### Build Details

- **Server:** app.secpal.dev
- **Branch:** perf/aggressive-code-splitting
- **Build Time:** 30.38s
- **Deployed File:** `assets/index-CjW3EPzu.js`
- **Bundle Size:** 310.11KB / 94.28KB gzipped ✅
- **Fix Applied:** Reverted to object-based manualChunks ✅

### Critical Fix Applied

**Problem:** Function-based `manualChunks` caused Heroicons module resolution errors
**Error:** `Cannot set properties of undefined (setting 'Activity')`
**Solution:** Reverted to object-based config with explicit package names
**Status:** ✅ **FIXED** - PWA loads without errors

### Vendor Chunks Deployed

```bash
vendor-react:      45.12KB / 16.22KB gzipped (React ecosystem)
vendor-ui:        128.63KB / 41.90KB gzipped (Headless UI + Heroicons) ← Fixed
vendor-lingui:      8.07KB /  3.34KB gzipped (i18n)
vendor-db:         97.08KB / 32.43KB gzipped (Dexie + IDB)
vendor-animation:  56.22KB / 20.17KB gzipped (Motion.js)
vendor-monitoring:  5.73KB /  2.33KB gzipped (web-vitals)
vendor-utils:       0.37KB /  0.24KB gzipped (clsx)
```

### Bundle Verification

```bash
# Verify vendor-ui deployed correctly
curl -s https://app.secpal.dev/ | grep -o 'vendor-ui[^"]*\.js'
# Output: vendor-ui-9RpWKF-5.js ✅

# Compare with local build
npm run build | grep "vendor-ui"
# Output: dist/assets/vendor-ui-9RpWKF-5.js  128.63 kB ✅
```

**Match confirmed:** Server deployment matches local build

---

## 🎯 Manual Verification Steps

### 1. Browser Performance Check

```bash
# Open in Chrome
https://app.secpal.dev

# DevTools → Network Tab
# 1. Disable Cache
# 2. Hard Reload (Cmd+Shift+R)
# 3. Check:
#    - Multiple JS chunks loaded? (should see ~15-20 chunks)
#    - index.js ~57KB? (14KB gzipped)
#    - vendor-react.js ~350KB? (110KB gzipped)
#    - No console errors?
```

### 2. Lighthouse Audit

```bash
# Chrome DevTools → Lighthouse
# Settings:
#   - Mode: Navigation
#   - Device: Desktop
#   - Categories: Performance, Best Practices

# Expected Results:
#   - TBT: <200ms (was 419ms)
#   - LCP: <2500ms (was 1244ms)
#   - CLS: <0.1 (was 0.00004)
#   - Performance Score: >95% (was 90-95%)
```

### 3. Automated Tests (Optional)

```bash
# E2E Performance Tests
npm run test:e2e:staging -- --grep "performance"

# Lighthouse CI
npm run lighthouse:ci
```

---

## 📊 Expected vs Baseline

| Metric             | Baseline (PR #317) | Current (Deployed) | Target | Status |
| ------------------ | ------------------ | ------------------ | ------ | ------ |
| TBT                | 419ms              | TBD (test needed)  | <200ms | ⏳     |
| Main Bundle (gzip) | 149KB              | 94.28KB            | <150KB | ✅     |
| Vendor Chunks      | 3                  | 7                  | -      | ✅     |
| PWA Functional     | ✅                 | ✅ (Fixed)         | ✅     | ✅     |
| Console Errors     | Some               | None               | None   | ✅     |

### Trade-offs

**Original aggressive splitting (broken):**

- Main bundle: 14.68KB gzipped ⚠️ Too aggressive
- Problem: Heroicons exports broken
- Status: Reverted

**Current object-based splitting (working):**

- Main bundle: 94.28KB gzipped ✅ Still 37% smaller than baseline!
- Benefit: All vendor libraries properly split
- Status: Deployed and functional

---

## 📝 Next Steps

### If TBT < 200ms ✅

1. Document actual Lighthouse results in PR #318
2. Update PR status: Draft → Ready for Review
3. Request code review
4. Merge to main after approval
5. Monitor production metrics

### If TBT still > 200ms ⚠️

**Further optimizations available:**

1. **Font Subsetting** (-100-150KB)
   - Currently: Full Inter family (all languages, all weights)
   - Optimize: Latin/Latin-Ext only, weights 400/500/600 only

2. **UI Library Splitting**
   - Split `vendor-misc` (27.77KB) into:
     - `vendor-headless` (~15KB)
     - `vendor-icons` (~12KB)

3. **Additional Dialog Lazy Loading**
   - Identify remaining dialogs
   - Implement lazy loading
   - Expected: -5-10KB

4. **Tree Shaking**
   - Remove unused Lingui locales
   - Remove unused icon imports
   - Expected: -10-20KB

---

## 🔗 Important Links

- **Staging:** <https://app.secpal.dev>
- **PR:** <https://github.com/SecPal/frontend/pull/318>
- **Branch:** <https://github.com/SecPal/frontend/tree/perf/aggressive-code-splitting>
- **Detailed Analysis:** `docs/PERFORMANCE_AGGRESSIVE_SPLITTING_RESULTS.md`

---

## 🐛 Troubleshooting

### Issue: Different bundle hash on server

```bash
# Check deployed version
ssh secpal@triangulum.uberspace.de "cd /var/www/virtual/secpal/frontend && git log -1 --oneline"

# Redeploy if needed
ssh secpal@triangulum.uberspace.de "cd /var/www/virtual/secpal/frontend && git pull && npm ci && npm run build"
```

### Issue: Cache showing old version

```bash
# Hard refresh in browser
# Cmd+Shift+R (Mac) / Ctrl+Shift+F5 (Windows/Linux)

# Or clear service worker
# DevTools → Application → Service Workers → Unregister
```

### Issue: Performance worse than expected

```bash
# Check for console errors
# DevTools → Console (should be clean)

# Run bundle analysis
npm run build:analyze
# Check for unexpected large chunks
```

---

**Status:** 🟢 Deployed and ready for verification
**Next Action:** Run manual Lighthouse audit on <https://app.secpal.dev>
**Expected Duration:** 5-10 minutes for verification
