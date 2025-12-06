<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Web Vitals Monitoring & Thresholds

Comprehensive Web Vitals tracking with threshold monitoring and development-time warnings.

## Features

### ✅ Automatic Metric Collection

All Core Web Vitals are automatically collected:

- **LCP** (Largest Contentful Paint) - Loading performance
- **CLS** (Cumulative Layout Shift) - Visual stability
- **INP** (Interaction to Next Paint) - Responsiveness
- **FCP** (First Contentful Paint) - Perceived load speed
- **TTFB** (Time to First Byte) - Server response time

### ✅ Performance Thresholds

Thresholds aligned with [Google's Core Web Vitals](https://web.dev/articles/vitals) and Lighthouse CI:

| Metric | Good    | Needs Improvement | Poor    |
| ------ | ------- | ----------------- | ------- |
| LCP    | < 2.5s  | 2.5s - 4s         | > 4s    |
| CLS    | < 0.1   | 0.1 - 0.25        | > 0.25  |
| INP    | < 200ms | 200ms - 500ms     | > 500ms |
| FCP    | < 1.8s  | 1.8s - 3s         | > 3s    |
| TTFB   | < 800ms | 800ms - 1.8s      | > 1.8s  |

### ✅ Development Warnings

In **development mode**, poor metrics trigger console warnings:

```console
⚠️ Performance Warning: LCP (5000ms) exceeds threshold
{
  metric: "LCP",
  value: 5000,
  rating: "poor",
  threshold: { good: 2500, needsImprovement: 4000 }
}
```

**Production builds**: Warning code is tree-shaken away (zero runtime cost).

### ✅ Metrics Export API

Collect metrics for dashboards or analysis:

```typescript
import {
  getPerformanceMetrics,
  clearPerformanceMetrics,
} from "@/lib/webVitals";

// Get all collected metrics
const metrics = getPerformanceMetrics();

// Clear metrics (e.g., for new measurement session)
clearPerformanceMetrics();
```

## Usage

### Automatic Initialization

Web Vitals tracking is automatically initialized in `main.tsx`:

```typescript
import { initWebVitals } from "./lib/webVitals";

initWebVitals();
```

No additional setup required!

### Analytics Integration

Metrics are automatically sent to analytics via `analytics.trackPerformance()`:

```typescript
analytics.trackPerformance("LCP", 2000, {
  id: "lcp-123",
  rating: "good",
  delta: 2000,
  navigationType: "navigate",
});
```

### Accessing Metrics

```typescript
import { getPerformanceMetrics } from '@/lib/webVitals';

// Example: Display metrics in a dashboard
function PerformanceDashboard() {
  const metrics = getPerformanceMetrics();

  return (
    <div>
      {metrics.map((metric) => (
        <div key={metric.id}>
          <strong>{metric.name}:</strong> {metric.value}
          <span className={metric.rating}>{metric.rating}</span>
        </div>
      ))}
    </div>
  );
}
```

## Implementation Details

### Threshold Configuration

Thresholds are defined in `src/lib/webVitals.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  INP: { good: 200, needsImprovement: 500 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
} as const;
```

These values are **aligned with** [`lighthouserc.cjs`](../../lighthouserc.cjs) assertions.

### Development vs. Production

```typescript
// Development: Warnings are logged
if (import.meta.env.DEV && rating !== "good") {
  console.warn("⚠️ Performance Warning: ...");
}

// Production: Code is removed by tree-shaking
// Zero runtime cost!
```

### Testing

Three test files cover all functionality:

1. **`webVitals.test.ts`** - Core functionality, metrics collection
2. **`webVitals.dev.test.ts`** - Development warnings, threshold validation
3. **`analytics.test.ts`** - Analytics integration

Run tests:

```bash
npm test src/lib/webVitals
```

## Integration with Lighthouse CI

This feature complements the [Lighthouse CI workflow](../.github/workflows/lighthouse.yml):

- **Lighthouse CI**: Automated performance audits on every PR
- **Web Vitals Tracking**: Real-time monitoring in production
- **Development Warnings**: Immediate feedback during development

All three use the **same thresholds** for consistency.

## Related

- Issue: [#310 - Web Vitals monitoring expansion](https://github.com/SecPal/frontend/issues/310)
- Parent EPIC: [#307 - Automated Performance Monitoring & Testing](https://github.com/SecPal/frontend/issues/307)
- Lighthouse CI: [`.github/workflows/lighthouse.yml`](../.github/workflows/lighthouse.yml)
- Configuration: [`lighthouserc.cjs`](../../lighthouserc.cjs)

## References

- [Web Vitals by Google](https://web.dev/articles/vitals)
- [Core Web Vitals](https://web.dev/articles/vitals#core-web-vitals)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [web-vitals library](https://github.com/GoogleChrome/web-vitals)
