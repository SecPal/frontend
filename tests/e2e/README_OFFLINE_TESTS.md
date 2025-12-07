# E2E Tests - Offline Functionality

## Overview

Comprehensive end-to-end tests for SecPal's offline-first PWA capabilities using Playwright.

## Test Files

### `offline.spec.ts`
Complete offline functionality test suite covering:
- **Offline Data Viewing**: Verifies cached data is displayed when offline
- **Navigation**: Tests SPA routing between pages while offline
- **Mutation Blocking**: Ensures create/edit/delete operations are blocked offline with clear warnings
- **Cache Consistency**: Validates data consistency between online and offline modes
- **Service Worker**: Tests PWA service worker behavior
- **Error Handling**: Ensures no failed mutation attempts when offline

### `organization.spec.ts`
Organization page integration tests including cache verification.

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Only Offline Tests
```bash
npx playwright test offline
```

### Specific Test
```bash
npx playwright test offline.spec.ts -g "should display cached organizational units"
```

### With UI (Debug Mode)
```bash
npx playwright test offline --ui
```

### Headed Mode (See Browser)
```bash
npx playwright test offline --headed
```

## Test Utilities

### `offline-helpers.ts`
Helper functions for offline testing:

- `goOffline(page)` - Set browser to offline mode
- `goOnline(page)` - Restore online mode
- `precachePage(page, url)` - Pre-cache a page by visiting it
- `clearAllCaches(page)` - Clear SW cache and IndexedDB
- `waitForServiceWorker(page)` - Wait for SW to be ready
- `getCachedOrgUnitsCount(page)` - Get cached org units from IndexedDB
- `getCachedSecretsCount(page)` - Get cached secrets from IndexedDB
- `simulateSlowNetwork(page)` - Simulate slow 3G conditions
- `blockApiEndpoint(page, pattern)` - Block specific API calls

## Test Scenarios

### 1. Offline Data Viewing
```typescript
// Visit page online to cache data
await page.goto("/organization");
await page.waitForLoadState("networkidle");

// Go offline
await page.context().setOffline(true);

// Reload - should show cached data
await page.reload();
await expect(page.getByText(/You're offline/i)).toBeVisible();
```

### 2. Offline Navigation
```typescript
// Pre-cache multiple pages
await precachePages(page, ["/organization", "/secrets"]);

// Go offline
await goOffline(page);

// Navigate between pages
await page.goto("/organization");
await page.goto("/secrets");
// Both should work from cache
```

### 3. Mutation Blocking
```typescript
await goOffline(page);

// Open create dialog
await page.getByRole("button", { name: /Create/i }).click();

// Should show warning
await expect(
  page.getByText(/not possible while offline/i)
).toBeVisible();

// Button should be disabled
await expect(page.getByRole("button", { name: /Save/i })).toBeDisabled();
```

### 4. Cache Consistency
```typescript
// Load data online
await page.goto("/organization");
const onlineData = await page.textContent("body");

// Go offline and reload
await goOffline(page);
await page.reload();
const offlineData = await page.textContent("body");

// Should show same data
expect(offlineData).toContain(/* key content */);
```

## CI Integration

Tests run automatically in CI with:
- Chromium only (consistent performance)
- 2 retries on failure
- HTML + JSON reports
- Screenshots on failure
- Video on first retry

## Debugging Failed Tests

### 1. View HTML Report
```bash
npx playwright show-report
```

### 2. Run with Trace
```bash
npx playwright test offline --trace on
```

Then view trace:
```bash
npx playwright show-trace trace.zip
```

### 3. Debug Specific Test
```bash
npx playwright test offline.spec.ts -g "cache consistency" --debug
```

### 4. Check Screenshots
Failed tests automatically save screenshots to `test-results/`

## Common Issues

### Service Worker Not Activating
- Ensure `npm run build` was run before tests
- Check if SW registration happens in dev mode
- Verify `vite.config.ts` has PWA plugin configured

### Navigation Fails Offline
- Check `navigateFallback` in workbox config
- Ensure lazy chunks are in `globPatterns`
- Verify Service Worker caching strategy

### Cache Inconsistency
- Ensure mutations update IndexedDB immediately
- Check `organizationalUnitApi.ts` has cache updates
- Verify cache helper functions convert data correctly

### Flaky Tests
- Increase `waitForTimeout` for slow CI environments
- Use `waitForLoadState("networkidle")` instead of fixed timeouts
- Add retry logic for network-dependent operations

## Best Practices

1. **Pre-cache First**: Always visit pages online before testing offline
2. **Wait for SW**: Use `waitForServiceWorker()` before offline tests
3. **Clear Between Tests**: Use `clearAllCaches()` to avoid test pollution
4. **Verify Indicators**: Always check offline warning banners appear
5. **Test Edge Cases**: Test navigation to uncached pages
6. **Real Data**: Tests work better with actual organizational units

## Future Improvements

- [ ] Add tests for background sync when coming back online
- [ ] Test conflict resolution for concurrent edits
- [ ] Verify cache expiration and cleanup
- [ ] Test offline mutation queueing (if implemented)
- [ ] Add performance metrics for offline vs online
- [ ] Test IndexedDB quota exceeded scenarios

## Related Documentation

- [Playwright Docs](https://playwright.dev/)
- [Issue #327](../../docs/ISSUE327_IMPLEMENTATION_SUMMARY.md) (if exists)
- [PWA Offline Architecture](../../docs/PWA_OFFLINE_ARCHITECTURE.md) (if exists)
