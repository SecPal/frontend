<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Quick Wins - Code Splitting

**Goal:** Reduce TBT from 419ms to <200ms
**Effort:** 2-3 hours
**Impact:** HIGH

---

## 🎯 Step 1: Implement Route-Based Code Splitting (30min)

### File: `src/App.tsx`

```typescript
// Add at top
import { lazy, Suspense } from "react";

// Replace all direct imports with lazy()
const SecretList = lazy(() => import("./pages/Secrets/SecretList"));
const SecretCreate = lazy(() => import("./pages/Secrets/SecretCreate"));
const SecretDetail = lazy(() => import("./pages/Secrets/SecretDetail"));
const Organization = lazy(() => import("./pages/Organization"));
const ShareTarget = lazy(() => import("./pages/ShareTarget"));

// Wrap routes with Suspense
<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    {/* ... existing routes ... */}
  </Routes>
</Suspense>
```

### Create Loading Component

```typescript
// src/components/RouteLoader.tsx
export const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
);
```

**Test:**

```bash
npm run build
# Check dist/ - should see multiple JS chunks now
npm run test:e2e:staging
# Verify TBT improvement
```

---

## 🎯 Step 2: Optimize Font Loading (20min)

### File: `src/main.tsx`

```typescript
// REMOVE these lines:
import "@fontsource/inter";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
```

### File: `src/index.css`

```css
/* Add at TOP - Reduces main JS bundle size */
/* Note: @import is synchronous but @fontsource includes font-display: swap */
@import url("@fontsource/inter/400.css");
@import url("@fontsource/inter/500.css");
@import url("@fontsource/inter/600.css");
@import url("@fontsource/inter/700.css");
```

**Test:**

```bash
npm run dev
# Open DevTools → Network → Fonts should load async
```

---

## 🎯 Step 3: Bundle Analysis (15min)

```bash
# Install analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  // ... existing plugins
  visualizer({
    open: true,
    gzipSize: true,
    brotliSize: true,
  }),
]

# Build and open report
npm run build
# Opens stats.html automatically
```

**Look for:**

- Large dependencies (>100KB)
- Duplicate packages
- Unused code

---

## 🎯 Step 4: Lazy Load Heavy Components (30min)

Identify and lazy-load:

```typescript
// Components that are NOT shown immediately
const MarkdownPreview = lazy(() => import("./components/MarkdownPreview"));
const FileUploadDialog = lazy(() => import("./components/FileUploadDialog"));
const ShareDialog = lazy(() => import("./components/ShareDialog"));

// Use with Suspense
{showDialog && (
  <Suspense fallback={<div>Loading...</div>}>
    <ShareDialog {...props} />
  </Suspense>
)}
```

---

## 🎯 Step 5: Verify Improvements (15min)

```bash
# Run full performance test
npm run test:e2e:staging

# Check metrics
# TBT should be <200ms now
# Initial JS bundle should be smaller

# Commit if successful
git add .
git commit -m "perf: implement code splitting to reduce TBT"
```

---

## 📊 Expected Results

| Metric            | Before | After  | Improvement |
| ----------------- | ------ | ------ | ----------- |
| TBT               | 419ms  | ~180ms | -57%        |
| Initial JS        | ~800KB | ~500KB | -38%        |
| Performance Score | 90%    | 95%+   | +5%         |

---

## ⚠️ Common Issues

### 1. "Cannot find module" errors

**Solution:** Check import paths, ensure all lazy imports use default exports

### 2. Suspense boundary errors

**Solution:** Wrap each lazy component separately, not the entire route tree

### 3. Font flashing (FOIT/FOUT)

**Solution:** Ensure `font-display: swap` is set correctly

---

## 🔍 Debugging

```typescript
// Log when components load
const SecretList = lazy(() => {
  console.log("Loading SecretList chunk...");
  return import("./pages/Secrets/SecretList");
});
```

Check DevTools Network tab → Filter by "JS" → See chunk loads

---

**Time Budget:** 2-3 hours
**Review:** Run tests before committing
**Document:** Update PERFORMANCE_ANALYSIS with results
