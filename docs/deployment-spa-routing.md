<!--
SPDX-FileCopyrightText: 2025-2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Deployment Guide - SPA Configuration

This guide explains how to deploy the SecPal frontend as a Single Page Application (SPA) on various hosting providers.

## Problem: 404 Errors on Page Refresh

When deploying a React SPA, users get 404 errors when refreshing the page on any route other than `/`.

**Why does this happen?**

1. User navigates to `/secrets` in the browser → React Router handles it ✅
2. User refreshes the page (F5) → Browser requests `/secrets` from the server ❌
3. Server has no file called `/secrets` → 404 Error

**Solution:** Configure the web server to serve `index.html` for all routes, allowing React Router to handle routing client-side.

---

## Apache Configuration (Uberspace, Shared Hosting)

The `.htaccess` file in `public/` handles SPA routing for Apache servers.

It also now carries the baseline browser hardening for the shipped PWA:

- enforcing a production CSP without inline scripts
- explicitly denying unused browser capabilities via `Permissions-Policy`
- setting `COOP` / `CORP` and related response headers consistently
- keeping `index.html`, `sw.js`, and `manifest.webmanifest` on short cache rules so security and PWA updates land quickly

**File:** `public/.htaccess`

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On

   # Never rewrite API/framework endpoints into the SPA shell.
   RewriteRule ^(?:v1|sanctum)(?:/|$) - [R=404,L]
   RewriteRule ^health(?:/|$) - [R=404,L]

  # Don't rewrite files or directories that actually exist
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Rewrite everything else to index.html
  RewriteRule . /index.html [L]
</IfModule>
```

**Deployment Steps (Uberspace):**

1. Build the production bundle:

   ```bash
   npm run build
   ```

2. Upload `dist/` contents to your document root (e.g., `/var/www/virtual/<user>/app.secpal.dev/`):

   ```bash
   rsync -avz --delete dist/ <user>@<host>.uberspace.de:/var/www/virtual/<user>/app.secpal.dev/
   ```

3. Verify `.htaccess` is present:

   ```bash
   ssh <user>@<host>.uberspace.de "ls -la /var/www/virtual/<user>/app.secpal.dev/.htaccess"
   ```

4. Test routing:
   - Visit `https://app.secpal.dev/` → Should load ✅
   - Visit `https://app.secpal.dev/secrets` → Should load ✅
   - Refresh on `/secrets` → Should NOT show 404 ✅

**Troubleshooting:**

- **404 still appears:** Check if `mod_rewrite` is enabled: `a2enmod rewrite` (requires server admin)
- **Internal Server Error:** Check Apache error logs: `tail -f ~/logs/error_log`
- **`.htaccess` not working:** Verify `AllowOverride All` is set in Apache config (Uberspace has this by default)

---

## Nginx Configuration

`app.secpal.dev` currently runs behind Nginx, so treat the versioned config in
`deploy/nginx/app.secpal.dev.conf` as the source of truth for production header
hardening and keep it aligned with the live VPS site file.

The file already covers:

- the production CSP and `Permissions-Policy`
- `Strict-Transport-Security`, `Referrer-Policy`, and framing protection
- explicit `404` handling for `/v1/*`, `/sanctum/*`, and `/health*`
- exact-match delivery rules for `/`, `/index.html`, `/sw.js`, and `/manifest.webmanifest`
- the manifest MIME fix (`application/manifest+json`) and update-safe cache headers

Use this file as your site config or merge its contents into the live server block:

```bash
sudo install -D -m 0644 deploy/nginx/app.secpal.dev.conf /etc/nginx/sites-available/app.secpal.dev.conf
sudo ln -sf /etc/nginx/sites-available/app.secpal.dev.conf /etc/nginx/sites-enabled/app.secpal.dev.conf
sudo nginx -t
sudo systemctl reload nginx
```

**Deployment Steps:**

1. Build the production bundle:

   ```bash
   npm run build
   ```

2. Deploy the built assets to the Nginx document root configured in
   `deploy/nginx/app.secpal.dev.conf` (adjust the path to match your server):

   ```bash
   rsync -av --delete dist/ /home/secpal/code/SecPal/frontend/dist/
   ```

3. Install or update the versioned Nginx site config:

   ```bash
   sudo install -D -m 0644 deploy/nginx/app.secpal.dev.conf /etc/nginx/sites-available/app.secpal.dev.conf
   sudo ln -sf /etc/nginx/sites-available/app.secpal.dev.conf /etc/nginx/sites-enabled/app.secpal.dev.conf
   ```

4. Reload Nginx:

   ```bash
   sudo nginx -t  # Test config
   sudo systemctl reload nginx
   ```

5. Verify the deployed headers:

   ```bash
   npm run test:live:pwa-headers
   ```

---

## Vercel / Netlify

These platforms auto-detect SPAs and configure routing automatically.

**Vercel:**

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Deploy ✅ (automatic SPA routing)

**Netlify:**

1. Create `public/_redirects` file:

   ```text
   /*    /index.html   200
   ```

2. Deploy via Git or CLI:

   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

---

## Docker / Kubernetes

**Dockerfile with Nginx:**

```dockerfile
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf:**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## Environment Variables

**Build-time variables** (set before `npm run build`):

- `VITE_API_URL` - Backend API URL as an absolute origin (for example `https://api.secpal.dev` or `https://api.customer.example`)

**Example (.env.production):**

```env
VITE_API_URL=https://api.secpal.dev
```

`VITE_API_URL` is mandatory for production builds. Do not use `/`, `/api`, or any other relative value in production, because that allows `/v1/*` and `/sanctum/*` requests to fall back to the SPA host when the web server is misrouted.

**Load environment:**

```bash
# Production build
VITE_API_URL=https://api.secpal.dev npm run build

# Or use .env.production file
npm run build
```

---

## Security Checklist

Before deploying to production:

- ✅ HTTPS enabled (Let's Encrypt, Certbot)
- ✅ Security headers configured (`.htaccess` includes them)
- ✅ CORS configured on backend (API must allow frontend domain)
- ✅ `VITE_API_URL` is an absolute API origin for the current deployment (never a relative path)
- ✅ No `.env` files committed to Git
- ✅ Service Worker registered (PWA functionality)
- ✅ CSP, permissions, and modern cross-origin headers enabled
- ✅ `index.html`, `sw.js`, and `manifest.webmanifest` use short cache rules

---

## Testing Deployment

After deployment, test these scenarios:

1. **Direct navigation:**
   - Visit `/` → Should load homepage ✅
   - Visit `/secrets` directly → Should load secrets page ✅
   - Visit `/login` directly → Should load login page ✅

2. **Refresh test:**
   - Navigate to `/secrets` in the browser
   - Press F5 (refresh)
   - Should stay on `/secrets`, NOT show 404 ✅

3. **404 handling:**
   - Visit `/non-existent-page` → Should show app's 404 page (not server's) ✅

4. **Static assets:**
   - Check browser DevTools Network tab
   - JS/CSS files should load with `200` status ✅
   - Images should load ✅

5. **Security headers:**
   - Check `Content-Security-Policy`, `Permissions-Policy`, and `Cross-Origin-*` headers on `/` ✅
   - Check `Cache-Control` and `Service-Worker-Allowed` on `/sw.js` ✅
   - Check `Content-Type: application/manifest+json` and `Cache-Control` on `/manifest.webmanifest` ✅

6. **API connectivity:**
   - Login should work ✅
   - API requests should succeed ✅
   - Check CORS headers in Network tab ✅
   - Check `https://app.secpal.dev/v1/me` no longer returns `200 text/html`; it must fail clearly on the app host and succeed only on `https://api.secpal.dev/v1/me` ✅

---

## Common Issues

### Issue: Blank Page After Deployment

**Cause:** Base URL mismatch (e.g., deployed to subdirectory)

**Solution:** Set `base` in `vite.config.ts`:

```typescript
export default defineConfig({
  base: "/app/", // If deployed to app.secpal.dev/app/
  // ...
});
```

### Issue: API Requests Fail (CORS)

**Cause:** Backend not configured to allow frontend domain

**Solution:** Update backend CORS config (`api/config/cors.php`):

```php
'allowed_origins' => [
    'https://app.secpal.dev',
],
```

### Issue: Production Build Uses the Wrong API Host

**Cause:** `VITE_API_URL` is missing, relative, or points at the wrong origin.

**Solution:** Set `VITE_API_URL` to the absolute API origin for that deployment before building. Examples:

```bash
VITE_API_URL=https://api.secpal.dev npm run build
VITE_API_URL=https://api.customer.example npm run build
```

The frontend now fails fast on invalid production values instead of silently falling back to the SPA host.

### Issue: API Routes Return the SPA HTML Shell

**Cause:** Frontend rewrites catch `/v1/*`, `/sanctum/*`, or `/health*` and serve `index.html` instead of failing or proxying.

**Solution:** Keep explicit guards ahead of the SPA fallback so API/framework paths never hit the app shell.

For Apache/Uberspace:

```apache
RewriteRule ^(?:v1|sanctum)(?:/|$) - [R=404,L]
RewriteRule ^health(?:/|$) - [R=404,L]
```

For Nginx:

```nginx
location ~ ^/(v1|sanctum)(/|$) {
   return 404;
}

location ~ ^/health(/|$) {
   return 404;
}
```

### Issue: Service Worker Not Updating

**Cause:** Browser caching old service worker

**Solution:**

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or unregister SW in DevTools: Application → Service Workers → Unregister

The shipped config now sets `Cache-Control: no-cache, no-store, must-revalidate` on `sw.js` and `no-cache, must-revalidate` on `manifest.webmanifest`; if updates still lag, check your CDN or reverse proxy for overrides.

### Issue: `.htaccess` Rules Not Applied

**Cause:** `AllowOverride` not enabled in Apache config

**Solution:** Contact hosting support to enable `AllowOverride All` for your directory.

---

## Monitoring

After deployment, monitor:

- **Error logs:** Check server logs for 404/500 errors
- **Browser console:** Check for JavaScript errors
- **Network tab:** Verify API requests succeed
- **Performance:** Use Lighthouse to audit PWA score

**Uberspace logs:**

```bash
# Error log
tail -f ~/logs/error_log

# Access log
tail -f ~/logs/access_log
```

---

## Related Documentation

- [README.md](../README.md) - Project overview and setup
- [vite.config.ts](../vite.config.ts) - Build configuration
- [public/.htaccess](../public/.htaccess) - Apache rewrite rules
- [Laravel Sanctum SPA Auth](https://laravel.com/docs/sanctum#spa-authentication)

---

## Support

If you encounter deployment issues:

1. Check this guide's **Troubleshooting** section
2. Review [GitHub Issues](../../issues)
3. Create a new issue with deployment logs and error details
