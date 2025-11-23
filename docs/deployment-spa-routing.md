<!--
SPDX-FileCopyrightText: 2025 SecPal
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

**File:** `public/.htaccess`

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On

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

For Nginx servers, add this to your server block:

```nginx
server {
  listen 80;
  server_name app.secpal.dev;
  root /var/www/app.secpal.dev;
  index index.html;

  # SPA routing: Serve index.html for all routes
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
```

**Deployment Steps:**

1. Build the production bundle:

   ```bash
   npm run build
   ```

2. Copy files to server:

   ```bash
   scp -r dist/* user@server:/var/www/app.secpal.dev/
   ```

3. Reload Nginx:

   ```bash
   sudo nginx -t  # Test config
   sudo systemctl reload nginx
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

- `VITE_API_URL` - Backend API URL (e.g., `https://api.secpal.app`)

**Example (.env.production):**

```env
VITE_API_URL=https://api.secpal.app
```

**Load environment:**

```bash
# Production build
VITE_API_URL=https://api.secpal.app npm run build

# Or use .env.production file
npm run build
```

---

## Security Checklist

Before deploying to production:

- ✅ HTTPS enabled (Let's Encrypt, Certbot)
- ✅ Security headers configured (`.htaccess` includes them)
- ✅ CORS configured on backend (API must allow frontend domain)
- ✅ `VITE_API_URL` points to production API
- ✅ No `.env` files committed to Git
- ✅ Service Worker registered (PWA functionality)
- ✅ CSP headers if needed (restrict script sources)

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

5. **API connectivity:**
   - Login should work ✅
   - API requests should succeed ✅
   - Check CORS headers in Network tab ✅

---

## Common Issues

### Issue: Blank Page After Deployment

**Cause:** Base URL mismatch (e.g., deployed to subdirectory)

**Solution:** Set `base` in `vite.config.ts`:

```typescript
export default defineConfig({
  base: "/app/", // If deployed to example.com/app/
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

### Issue: Service Worker Not Updating

**Cause:** Browser caching old service worker

**Solution:**

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or unregister SW in DevTools: Application → Service Workers → Unregister

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
