<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Static strict CSP

`index.html` carries the shared CSP baseline for Web, PWA, Capacitor Android,
and future Capacitor iOS builds. It permits only external same-origin scripts
and styles, denies script and style attributes, and contains no unsafe source,
nonce, hash, SSI placeholder, or inline executable content.

Vite development is not a distributable surface and injects imported CSS
through a development-only style element. The serve-only Vite HTML transform
therefore removes the static CSP meta before the development client runs.
Production builds and previews retain the strict meta unchanged, and the
transform fails fast if the expected source policy is missing or duplicated.

The root `CSPProvider` configures Base UI with `disableStyleElements`. SecPal
code must not create style or script elements or use JSX `style`, `element.style`,
`cssText`, inline event handlers, `eval`, or `javascript:` URLs. Base UI may set
individual layout properties required for accessible positioning; this narrow
library-internal behavior is accepted only while browser tests report no CSP
violation and Base UI creates no style element.

The production artifact contract verifies that external CSS contains the
shadcn/Base UI open and closed animation rules and the reduced-motion media
query. It also scans every shipped JavaScript chunk and the service worker for
Radix package identifiers, `eval`, and `new Function`. The Chromium audit uses
a `MutationObserver` during representative interactions so transient script or
style element injection cannot disappear before the final DOM assertion.

Web edge delivery may add a stricter header policy, `frame-ancestors`, reporting,
and deployment-specific connection restrictions. It must not rewrite HTML or
weaken this baseline. CSP reporting infrastructure and customer-specific edge
policy are deliberately outside the frontend build.
