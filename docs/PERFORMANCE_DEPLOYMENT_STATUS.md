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
- **Build Time:** 21.12s
- **Deployed File:** `assets/index-Dck4NFuj.js`
- **Bundle Size:** 57.62KB / 14.68KB gzipped ✅

### Bundle Verification

```bash
# Main bundle deployed
curl -s https://app.secpal.dev/ | grep -o 'assets/index-[^"]*\.js'
# Output: assets/index-Dck4NFuj.js ✅

# Compare with local build
npm run build | grep "index-"
# Output: dist/assets/index-Dck4NFuj.js  57.62 kB │ gzip:  14.68 kB ✅
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

| Metric             | Baseline (PR #317) | Expected (Aggressive) | Target | Change  |
| ------------------ | ------------------ | --------------------- | ------ | ------- |
| TBT                | 419ms              | 150-180ms             | <200ms | -57-64% |
| Main Bundle (gzip) | 149KB              | 14.68KB               | <150KB | -90%    |
| Performance Score  | 90-95%             | 95-98%                | >95%   | +5-8%   |
| Initial Parse Time | ~863ms             | ~200-250ms            | -      | -70-75% |

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
