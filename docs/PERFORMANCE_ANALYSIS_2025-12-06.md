<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Analysis - app.secpal.dev

> Historical analysis document: this file captures a 2025 performance investigation snapshot and should not be treated as the current frontend optimization plan.

**Date:** 2025-12-06
**Test Target:** <https://app.secpal.dev>
**Tool:** Playwright + Lighthouse CI

---

## 📊 Current Performance Metrics

### Desktop (Chromium) - ✅ GOOD

| Metric                             | Result      | Target  | Status      |
| ---------------------------------- | ----------- | ------- | ----------- |
| **Performance Score**              | 90-95%      | >90%    | ✅ PASS     |
| **Accessibility**                  | 100%        | >90%    | ✅ PASS     |
| **Best Practices**                 | 100%        | >90%    | ✅ PASS     |
| **LCP** (Largest Contentful Paint) | 1244ms      | <2500ms | ✅ PASS     |
| **CLS** (Cumulative Layout Shift)  | 0.00004     | <0.1    | ✅ PASS     |
| **TBT** (Total Blocking Time)      | **419.5ms** | <200ms  | ❌ **FAIL** |

### Mobile - ⚠️ Tests Skipped

- Lighthouse requires Chromium with CDP (Chrome DevTools Protocol)
- Mobile emulation tests not compatible with playwright-lighthouse

---

## 🚨 Critical Issue: Total Blocking Time

### Problem

**TBT: 419.5ms** (210% of target value)

**What is TBT?**

- Measures time when main thread is blocked (>50ms tasks)
- Prevents interactivity (clicks, scrolling, input)
- Main cause: Too much JavaScript at load time

**Impact:**

- User Experience: Delayed feedback on interactions
- Mobile Performance: Even worse (slower CPUs)
- SEO: Negatively affects Google Core Web Vitals

---

## 🎯 Optimization Roadmap (Prioritized)

### 1️⃣ **HIGHEST PRIORITY: Code Splitting**

**Goal:** TBT <200ms

#### Problem

- Current: All routes in initial bundle
- Font files loaded synchronously (4x Inter fonts)
- Large dependencies not lazy-loaded

#### Actions

##### A. Route-Based Code Splitting

```typescript
// src/App.tsx - BEFORE
import SecretList from "./pages/Secrets/SecretList";
import SecretDetail from "./pages/Secrets/SecretDetail";
import Organization from "./pages/Organization";

// AFTER - Lazy Loading
const SecretList = lazy(() => import("./pages/Secrets/SecretList"));
const SecretDetail = lazy(() => import("./pages/Secrets/SecretDetail"));
const Organization = lazy(() => import("./pages/Organization"));
```

##### B. Font Loading Optimization

```typescript
// src/main.tsx - BEFORE (loaded in JavaScript bundle)
import "@fontsource/inter";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

// AFTER - Loaded via CSS @import (reduces main bundle size)
// In index.css:
@import url("@fontsource/inter/400.css");
@import url("@fontsource/inter/500.css");
@import url("@fontsource/inter/600.css");
@import url("@fontsource/inter/700.css");
// Note: @fontsource packages include font-display: swap by default
```

##### C. Large Dependencies Lazy Loading

```typescript
// Example: Markdown Renderer, PDF Viewer, etc.
const MarkdownPreview = lazy(() => import("./components/MarkdownPreview"));
```

**Expected Improvement:**

- TBT: 419ms → ~180ms (-55%)
- Initial Bundle: -30-40%

---

### 2️⃣ **HIGH PRIORITY: Tree Shaking & Bundle Analysis**

#### Run Analysis

```bash
# Vite Build Report
npm run build -- --mode analyze

# Bundle Visualizer
npx vite-bundle-visualizer
```

#### To Check

- [ ] Are all Lingui locales bundled? (only `de` and `en` needed)
- [ ] Crypto Libraries: Only import used algorithms
- [ ] Moment.js / date-fns: Check for smaller alternatives
- [ ] Lodash: Named imports instead of barrel imports

**Example:**

```typescript
// ❌ BAD - Bundle includes all of lodash
import _ from "lodash";
_.debounce(fn, 300);

// ✅ GOOD - Only debounce included
import debounce from "lodash/debounce";
debounce(fn, 300);
```

---

### 3️⃣ **MEDIUM PRIORITY: Image Optimization**

#### Already Implemented ✅

- `LazyImage` Component with Intersection Observer
- But: Check if consistently used

#### To Check

- [ ] Replace all `<img>` with `<LazyImage>`
- [ ] WebP format for all images
- [ ] Responsive images with `srcset`

```tsx
<LazyImage
  src="/assets/logo.png"
  srcSet="/assets/logo-small.webp 320w,
          /assets/logo-medium.webp 768w,
          /assets/logo-large.webp 1280w"
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="SecPal Logo"
/>
```

---

### 4️⃣ **MEDIUM PRIORITY: Service Worker Optimization**

#### Current State

- PWA with injectManifest strategy
- Caching present

#### Improvements

- [ ] **Precaching:** Only critical assets (<1MB)
- [ ] **Runtime Caching:** API responses with Stale-While-Revalidate
- [ ] **Background Sync:** Failed requests retry

```typescript
// sw.ts
registerRoute(
  ({ url }) => url.pathname.startsWith("/v1/"),
  new StaleWhileRevalidate({
    cacheName: "api-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);
```

---

### 5️⃣ **LOW PRIORITY: Third-Party Scripts**

#### To Check

- [ ] Analytics: Only track critical events
- [ ] Web Vitals: Already optimized ✅
- [ ] External dependencies: Consider local copies

---

## 📈 Performance Monitoring Setup

### Lighthouse CI (already implemented ✅)

- Runs on every PR
- Performance Budget: 90%
- TBT Warning currently active

### Still to Implement

- [ ] **Real User Monitoring (RUM):** Collect real user data
- [ ] **Performance Dashboards:** Track trends over time
- [ ] **Alerting:** Warn on performance regression

---

## 🔄 Next Steps (Priority)

### This Week

1. ✅ Performance test against `.dev` completed
2. ✅ **Route-based Code Splitting implemented**
3. 🔄 Bundle Analysis

### Next Week

1. Font Loading optimization
2. Tree Shaking improvements
3. LazyImage Audit

### Later

1. Service Worker Optimization
2. RUM Setup

---

## 📝 Testing Checklist

After each optimization:

```bash
# 1. Local Performance Test
npm run test:e2e:staging

# 2. Check Lighthouse CI Report
npm run lighthouse:ci

# 3. Compare Bundle Size
npm run build
# → Compare dist/ size with before
```

**Success Criteria:**

- TBT <200ms ✅
- Initial Bundle <500KB (gzipped) ✅
- LCP <2.5s ✅
- Performance Score >90% ✅

---

## 🛠️ Tools & Resources

### Installed

- ✅ Lighthouse CI (`lighthouserc.cjs`)
- ✅ Playwright Performance Tests (`tests/e2e/performance.spec.ts`)
- ✅ Web Vitals Tracking (`src/lib/webVitals.ts`)

### To Install

```bash
npm install --save-dev vite-plugin-visualizer
npm install --save-dev rollup-plugin-analyzer
```

### Useful Links

- [Lighthouse Score Calculator](https://googlechrome.github.io/lighthouse/scorecalc/)
- [Web Vitals](https://web.dev/articles/vitals)
- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [React.lazy()](https://react.dev/reference/react/lazy)

---

## 📈 Historical Performance

| Date       | TBT   | LCP    | Score | Notes                           |
| ---------- | ----- | ------ | ----- | ------------------------------- |
| 2025-12-06 | 419ms | 1244ms | 90%   | Baseline - before optimizations |

**Note:** Update this table after each optimization

---

**Generated by:** GitHub Copilot
**Reviewed by:** [Your Name]
**Status:** 🔄 IN PROGRESS
