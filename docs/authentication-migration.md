<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Authentication Migration: localStorage to httpOnly Cookies

**Status:** Completed
**Migration Date:** November 2025
**Related Epic:** [#208](https://github.com/SecPal/frontend/issues/208)

## Overview

SecPal has migrated from localStorage-based token storage to httpOnly cookie-based authentication using Laravel Sanctum SPA mode. This change significantly improves security by protecting authentication tokens from XSS (Cross-Site Scripting) attacks.

### What Changed

**Before (Insecure):**

```typescript
// ❌ OLD: Token stored in localStorage (accessible to JavaScript)
localStorage.setItem("auth_token", response.token);

// ❌ OLD: Manual Authorization header
headers: {
  Authorization: `Bearer ${localStorage.getItem("auth_token")}`;
}
```

**After (Secure):**

```typescript
// ✅ NEW: httpOnly cookie set by backend (NOT accessible to JavaScript)
// Backend sets: Set-Cookie: laravel_session=...; HttpOnly; Secure; SameSite=Lax

// ✅ NEW: Credentials automatically included
fetch(url, {
  credentials: "include", // Sends cookies automatically
});
```

## Security Benefits

### 1. **XSS Protection**

- **httpOnly cookies** cannot be accessed by JavaScript, even if an attacker injects malicious code
- Tokens are **never exposed** to the frontend application code
- **localStorage vulnerability eliminated** - no token available to steal via `localStorage.getItem()`

### 2. **CSRF Protection**

- Laravel Sanctum provides built-in CSRF token protection
- CSRF tokens rotate automatically for security
- Double-submit cookie pattern protects against CSRF attacks

### 3. **Secure Cookie Attributes**

```http
Set-Cookie: laravel_session=...;
  HttpOnly;           // JavaScript cannot access
  Secure;             // HTTPS only (production)
  SameSite=Lax;       // Prevents most CSRF attacks
  Path=/;             // Available across application
  Max-Age=7200;       // 2-hour session lifetime
```

## Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant Frontend
    participant Backend
    participant Database

    Note over Browser,Database: Login Flow
    Browser->>Frontend: User submits login form
    Frontend->>Backend: GET /sanctum/csrf-cookie
    Backend-->>Frontend: Set-Cookie: XSRF-TOKEN=...
    Frontend->>Backend: POST /v1/auth/token<br/>(email, password, X-XSRF-TOKEN header)
    Backend->>Database: Verify credentials
    Backend-->>Frontend: Set-Cookie: laravel_session=...; HttpOnly<br/>Response: { user: {...} }
    Frontend->>Browser: Update UI (user logged in)

    Note over Browser,Database: Authenticated Request
    Browser->>Frontend: User requests protected resource
    Frontend->>Backend: GET /v1/user/profile<br/>(credentials: include, cookies sent automatically)
    Backend->>Database: Validate session
    Backend-->>Frontend: 200 OK { data: {...} }

    Note over Browser,Database: Logout Flow
    Browser->>Frontend: User clicks logout
    Frontend->>Backend: POST /v1/auth/logout<br/>(X-XSRF-TOKEN header, cookies)
    Backend->>Database: Revoke session
    Backend-->>Frontend: Set-Cookie: laravel_session=deleted; Max-Age=0<br/>204 No Content
    Frontend->>Browser: Update UI (user logged out)
```

### CSRF Token Flow

1. **Before first state-changing request:** Frontend calls `/sanctum/csrf-cookie`
2. **Backend sets XSRF-TOKEN cookie** (readable by JavaScript)
3. **Frontend reads XSRF-TOKEN** from cookie via `getCsrfTokenFromCookie()`
4. **Frontend includes token** in `X-XSRF-TOKEN` header for POST/PUT/PATCH/DELETE requests
5. **Backend validates token** matches session token
6. **On 419 response:** Frontend automatically refreshes CSRF token and retries

## Local Development Setup

### Prerequisites

- Backend API configured with Sanctum SPA mode (see backend PR-1, PR-2)
- CORS configured to allow credentials from frontend domain
- Environment variables properly set

### Environment Configuration

**Frontend `.env.local`:**

```env
# Development API endpoint
VITE_API_URL=http://api.secpal.test

# No token-related variables needed anymore!
# ❌ OLD: VITE_AUTH_TOKEN_KEY (removed)
```

**Backend `.env`:**

```env
# Sanctum Configuration
SANCTUM_STATEFUL_DOMAINS=localhost:5173,secpal.app,www.secpal.app
SESSION_DOMAIN=localhost
SESSION_SECURE_COOKIE=false  # true in production
SESSION_DRIVER=cookie

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://secpal.app
```

### Running Locally

1. **Start backend API:**

   ```bash
   cd api/
   ddev start
   ```

2. **Start frontend dev server:**

   ```bash
   cd frontend/
   npm run dev
   # Dev server runs on http://localhost:5173
   ```

3. **Verify cookie settings in browser DevTools:**
   - Login to application
   - Open DevTools → Application → Cookies → `http://localhost:5173`
   - Verify `laravel_session` cookie exists with `HttpOnly` attribute
   - Verify `XSRF-TOKEN` cookie exists (readable, no HttpOnly)

## API Changes for Developers

### Authentication API

**Login:**

```typescript
import { login } from "./services/authApi";

// CSRF token is fetched automatically
const response = await login({
  email: "user@secpal.app",
  password: "SecurePassword123!",
});

// Response contains ONLY user data (no token!)
console.log(response.user); // { id: 1, name: "User", email: "..." }

// ✅ Session cookie set by backend automatically
// ✅ No manual token storage needed
```

**Logout:**

```typescript
import { logout } from "./services/authApi";

// Revokes current session
await logout();

// ✅ Backend clears session cookie automatically
```

**Logout All Devices:**

```typescript
import { logoutAll } from "./services/authApi";

// Revokes ALL sessions for current user
await logoutAll();
```

### Making Authenticated Requests

**Automatic (Recommended):**

```typescript
import { fetchWithCsrf } from "./services/csrf";

// For state-changing requests (POST, PUT, PATCH, DELETE)
const response = await fetchWithCsrf("https://api.secpal.app/v1/secrets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ title: "My Secret" }),
});

// ✅ credentials: include added automatically
// ✅ X-XSRF-TOKEN header added automatically
// ✅ 419 retry handled automatically
```

**Manual (Advanced):**

```typescript
// For GET requests (no CSRF protection needed)
const response = await fetch("https://api.secpal.app/v1/secrets", {
  credentials: "include", // REQUIRED: Sends cookies
  headers: {
    Accept: "application/json",
  },
});

// ⚠️ No Authorization header needed!
```

### CSRF Token Management

**Automatic handling (recommended):**

```typescript
// Just use fetchWithCsrf - it handles everything
await fetchWithCsrf(url, { method: "POST", body: data });
```

**Manual handling (if needed):**

```typescript
import { fetchCsrfToken, getCsrfTokenFromCookie } from "./services/csrf";

// Fetch CSRF token before state-changing requests
await fetchCsrfToken();

// Get token from cookie
const csrfToken = getCsrfTokenFromCookie();

// Include in request header
fetch(url, {
  method: "POST",
  credentials: "include",
  headers: {
    "X-XSRF-TOKEN": csrfToken,
  },
});
```

## Removed Code

The following patterns are **no longer used** and have been removed:

### localStorage Token Storage

```typescript
// ❌ REMOVED: Manual token storage
localStorage.setItem("auth_token", token);
localStorage.getItem("auth_token");
localStorage.removeItem("auth_token");
```

### Authorization Header

```typescript
// ❌ REMOVED: Bearer token authorization
headers: {
  Authorization: `Bearer ${token}`;
}
```

### Token in Login Response

```typescript
// ❌ OLD Response:
{
  "user": { "id": 1, "name": "User" },
  "token": "1|abcdef123456..."  // REMOVED
}

// ✅ NEW Response:
{
  "user": { "id": 1, "name": "User" }
  // Token in httpOnly cookie instead
}
```

## Testing

### Unit Tests

```bash
# Run auth-related tests
npm test -- --testNamePattern="auth"

# Run CSRF tests
npm test -- --testNamePattern="csrf"

# Run integration tests
npm test tests/integration/
```

### Integration Tests

**Cookie Authentication:**

- `tests/integration/auth/cookieAuth.test.ts`
- Tests complete login/logout flow with cookies
- Verifies no token in localStorage
- Verifies credentials: include in requests

**CSRF Protection:**

- `tests/integration/auth/csrfProtection.test.ts`
- Tests CSRF token handling for POST/PUT/PATCH/DELETE
- Tests automatic 419 retry logic
- Tests error scenarios

### Manual Testing Checklist

- [ ] Login with valid credentials → Session cookie set
- [ ] Navigate to protected page → Request includes session cookie
- [ ] Refresh page → Session persists (cookie still valid)
- [ ] Logout → Session cookie cleared
- [ ] Try authenticated request after logout → 401 Unauthorized
- [ ] Login → Logout → Login again → Works correctly
- [ ] Open DevTools → Verify `laravel_session` has `HttpOnly` attribute
- [ ] Verify `XSRF-TOKEN` cookie readable by JavaScript (no HttpOnly)

## Troubleshooting

### Issue: 401 Unauthorized on Authenticated Requests

**Symptoms:** Requests to protected endpoints return 401 even after successful login.

**Causes:**

1. `credentials: "include"` missing from fetch call
2. CORS not configured to allow credentials on backend
3. Session cookie domain mismatch

**Solutions:**

```typescript
// ✅ Always include credentials
fetch(url, {
  credentials: "include", // CRITICAL!
});
```

```php
// Backend: config/cors.php
'supports_credentials' => true,
'allowed_origins' => [
    'http://localhost:5173',
    'https://secpal.app',
],
```

### Issue: 419 CSRF Token Mismatch

**Symptoms:** POST/PUT/PATCH/DELETE requests return 419.

**Causes:**

1. CSRF token not included in request header
2. CSRF token expired
3. Session mismatch

**Solutions:**

```typescript
// ✅ Use fetchWithCsrf for automatic CSRF handling
import { fetchWithCsrf } from "./services/csrf";

await fetchWithCsrf(url, {
  method: "POST",
  body: JSON.stringify(data),
});
// Automatically includes X-XSRF-TOKEN header
// Automatically retries on 419
```

### Issue: Cookies Not Set in Development

**Symptoms:** No `laravel_session` cookie appears in DevTools after login.

**Causes:**

1. SANCTUM_STATEFUL_DOMAINS not including `localhost:5173`
2. CORS not configured correctly
3. Browser blocking third-party cookies

**Solutions:**

```env
# Backend .env
SANCTUM_STATEFUL_DOMAINS=localhost:5173,secpal.app
SESSION_DOMAIN=localhost
```

```typescript
// Frontend: Verify API URL matches backend domain
console.log(import.meta.env.VITE_API_URL);
// Should be: http://api.secpal.test (if using DDEV)
```

### Issue: Session Expires Too Quickly

**Symptoms:** User logged out after a few minutes of inactivity.

**Causes:**

1. Session lifetime too short
2. `expire_on_close` set to `true`

**Solutions:**

```php
// Backend: config/session.php
'lifetime' => 120, // 2 hours (in minutes)
'expire_on_close' => false,
```

### Issue: Login Works but Subsequent Requests Fail

**Symptoms:** Login succeeds, but next API call returns 401.

**Causes:**

1. Forgetting to include `credentials: "include"` in fetch
2. Using different API base URLs (cookie domain mismatch)

**Solutions:**

```typescript
// ✅ Centralize API base URL
import { getApiBaseUrl } from "./config";

fetch(`${getApiBaseUrl()}/v1/resource`, {
  credentials: "include",
});
```

### Issue: CSRF Token Not Found in Cookie

**Symptoms:** `getCsrfTokenFromCookie()` returns `null`.

**Causes:**

1. `/sanctum/csrf-cookie` not called before login
2. Backend CSRF cookie not set
3. Cookie blocked by browser

**Solutions:**

```typescript
// ✅ Always fetch CSRF token first
import { fetchCsrfToken } from "./services/csrf";

await fetchCsrfToken(); // Sets XSRF-TOKEN cookie
// Now login or make state-changing request
```

## Browser Compatibility

### Supported Browsers

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Cookie Requirements

All supported browsers must:

- Allow first-party cookies (required for authentication)
- Support `SameSite=Lax` attribute
- Support `credentials: "include"` in Fetch API

### Known Limitations

- **Safari Private Mode:** May block cookies by default (user must enable)
- **Firefox Enhanced Tracking Protection:** May block third-party cookies (first-party works fine)
- **Brave Shields:** May block cookies (user can whitelist domain)

## Production Considerations

### HTTPS Required

```env
# Backend production .env
SESSION_SECURE_COOKIE=true  # REQUIRED in production
SANCTUM_STATEFUL_DOMAINS=secpal.app,www.secpal.app
```

### Domain Configuration

```env
# Backend production .env
SESSION_DOMAIN=.secpal.app  # Allows subdomains
APP_URL=https://secpal.app
FRONTEND_URL=https://secpal.app
```

### Security Headers

Backend should set:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Migration Checklist

For developers migrating existing code:

- [ ] Remove all `localStorage` token operations
- [ ] Remove all `Authorization: Bearer` headers
- [ ] Add `credentials: "include"` to all authenticated fetch calls
- [ ] Use `fetchWithCsrf()` for POST/PUT/PATCH/DELETE requests
- [ ] Update tests to not expect tokens in responses
- [ ] Update tests to verify cookies instead of localStorage
- [ ] Update API documentation to reflect new auth flow
- [ ] Test login/logout flow end-to-end
- [ ] Verify CSRF protection works for all state-changing endpoints
- [ ] Test session persistence across page refreshes

## Additional Resources

- [Laravel Sanctum SPA Authentication](https://laravel.com/docs/sanctum#spa-authentication)
- [OWASP: Token Storage Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html#token-storage-on-client-side)
- [MDN: credentials option](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#sending_a_request_with_credentials_included)
- [MDN: Set-Cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- Backend Implementation: SecPal/api#209, #210, #208
- Epic Issue: [#208](https://github.com/SecPal/frontend/issues/208)

## Support

If you encounter issues not covered in this guide:

1. Check browser DevTools → Network tab → Verify cookies in requests
2. Check browser DevTools → Application → Cookies → Verify cookie attributes
3. Review backend logs for CORS or session errors
4. Create GitHub issue with reproduction steps

---

**Last Updated:** November 23, 2025
**Maintainer:** SecPal Team
