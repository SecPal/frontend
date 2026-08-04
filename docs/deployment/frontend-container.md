<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Frontend Container

The SecPal frontend image is an unprivileged static reference server for the
existing production Web/PWA artifact. It does not contain Node.js and does not
rewrite HTML, JavaScript, CSS, the service worker, or any other build output at
startup.

The same immutable image is intended for every deployment. A deployment
selects its API origin only when the container starts.

## Build

Build the local image from the repository root:

```bash
docker build -t secpal-frontend:local .
```

The build stage uses the repository's complete `npm run build:web` pipeline,
including TypeScript, Vite's PWA `injectManifest` build, dependency SBOM, third-
party notices, and license artifacts. It does not introduce a second
container-specific application build.

## Published Image Identity

The only official image is:

```text
ghcr.io/secpal/frontend
```

The only canonical trust, deployment, update, and rollback identity is the OCI
index digest:

```text
ghcr.io/secpal/frontend@sha256:<oci-index-digest>
```

Each successful publisher run creates exactly one discovery tag:

```text
build-<source-sha>-<run-id>-<run-attempt>
```

The discovery tag locates the output of one workflow attempt. It is not a
deployment contract, rollback contract, or trust anchor. It is also not
technically immutable against another registry writer with sufficient
permissions. Consumers must record and use the verified OCI index digest.

The publisher runs only after a push to `main`, always rebuilds the selected
source commit, and publishes exactly `linux/amd64` and `linux/arm64`. The build
uses the commit timestamp for `org.opencontainers.image.created` and combines
the package version with the full source commit as
`<package-version>+git.<source-sha>`.

For both platforms the workflow verifies all OCI labels, a non-empty BuildKit
SPDX SBOM, and `mode=max` provenance bound to the exact source commit and
repository build context. It hashes the exact OCI index response bytes,
compares the result and the registry `Docker-Content-Digest` header with the
Buildx digest, runs the complete container and Chromium contracts against the
digest reference, and creates a GitHub Artifact Attestation for that digest.
The attestation verification binds the repository, publisher workflow,
`refs/heads/main`, source commit, signer commit, and GitHub-hosted runner.

This image contains only the browser Web/PWA artifact. It does not publish
Android or iOS artifacts. Its Nginx runtime remains an unprivileged `101:101`
static reference server without Node.js; deployments supply `SECPAL_API_URL`
only when the container starts. TLS termination and public-edge controls remain
deployment responsibilities.

Frontend image publication is implemented but not yet operationally verified.
After merge, operators must record the successful publisher run and complete
the package linkage, public-visibility, anonymous digest-pull, final discovery
snapshot, and final attestation checks. Digest consumption in
`SecPal/deployment` remains a separate follow-up, so Phase C remains in
progress.

## Run

`SECPAL_API_URL` is required and must be one exact ASCII HTTPS origin. Paths,
trailing slashes, user information, queries, fragments, whitespace, control
characters, quotes, backslashes, shell syntax, port `0`, and ports above
`65535` are rejected. Internationalized hostnames must be provided as ASCII
Punycode.

```bash
docker run --rm \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  -e SECPAL_API_URL=https://api.example.com \
  -p 8080:8080 \
  secpal-frontend:local
```

The image runs as fixed user and group `101:101`, listens over HTTP on port
`8080`, and writes only beneath `/tmp`. The `/tmp` mount does not need execute
permission. A missing, loopback, or otherwise invalid API origin fails startup
before Nginx runs, without reflecting the supplied value in logs.

The entrypoint validates the origin, creates private runtime and Nginx
directories, atomically writes `/tmp/secpal-runtime/runtime-config.js`, checks
the static Nginx configuration, and then replaces itself with Nginx. The file
has this deterministic shape:

```javascript
window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({
  apiBaseUrl: "https://api.example.com",
});
```

The neutral artifact contains the same external file with `apiBaseUrl: null`.
The application resolves API configuration in this order:

1. validated native runtime override;
2. validated Web runtime configuration;
3. explicit build, preview, or development configuration;
4. known SecPal live and Polyscope preview mappings;
5. fail closed for an unknown production host.

Changing the API origin requires a container restart, not an image rebuild.

## Endpoints and Routing

- `GET /health/live` returns HTTP 200 and `{"status":"ok"}` without checking
  the API.
- `GET /runtime-config.js` serves only the startup-generated file from `/tmp`.
- `/v1`, `/sanctum`, and every `/health` path except `/health/live` return 404.
- Existing static files are served directly.
- Other application routes fall back to `index.html` for React Router.

The container has no API proxy, TLS, ACME, tenant routing, rate limiting, WAF,
or public-edge behavior. Frontend container traffic is expected to be
terminated and protected by the deployment edge. The container deliberately
does not emit a Content Security Policy header: the immutable `index.html`
retains the shared static strict CSP for Web, PWA, and Capacitor. A public edge
may add a stricter policy without changing the artifact.

## Cache Contract

| Resource                                   | Cache-Control                         |
| ------------------------------------------ | ------------------------------------- |
| `/`, `/index.html`                         | `no-cache, no-store, must-revalidate` |
| `/runtime-config.js`                       | `no-cache, no-store, must-revalidate` |
| `/sw.js`                                   | `no-cache, no-store, must-revalidate` |
| `/document-language.js`, `/theme-color.js` | `no-cache, no-store, must-revalidate` |
| `/manifest.webmanifest`                    | `no-cache, must-revalidate`           |
| `/source-offer.json`                       | `no-cache, must-revalidate`           |
| hashed `/assets/**`                        | `public, max-age=31536000, immutable` |
| `/health/live`                             | `no-store`                            |

`runtime-config.js` is excluded from both the Workbox precache manifest and
generic script runtime caching. It is fetched from the network on every app
load so an old customer configuration cannot be served offline.

## Orchestrator Assumptions

Docker and Kubernetes-compatible runtimes should preserve these settings:

- `runAsNonRoot: true` with UID/GID `101`;
- `readOnlyRootFilesystem: true`;
- `allowPrivilegeEscalation: false`;
- drop every Linux capability;
- provide a non-executable tmpfs or memory-backed `emptyDir` at `/tmp`;
- expose container port `8080` over HTTP;
- use `/health/live` as the liveness endpoint;
- pass `SECPAL_API_URL` as ordinary non-secret deployment configuration.

Docker Compose and complete Kubernetes manifests are intentionally deferred to
deployment integration work.

## Base Image Updates

The Dockerfile pins both a complete version tag and its multi-architecture
manifest digest. To update a pin:

1. select an exact supported Debian Node patch release and an exact Debian
   `nginxinc/nginx-unprivileged` release;
2. inspect the registry manifest with
   `docker buildx imagetools inspect <image>:<tag>`;
3. confirm that amd64 and arm64 are present and record the top-level index
   digest, not an architecture-specific child manifest;
4. update the tag and digest together;
5. run `npm run test:container` and `npm run test:e2e:container`.

Pull-request CI continues to build and validate the image locally without
registry credentials or write effects. Registry publication occurs only in the
push-triggered publisher after merge to `main`.
