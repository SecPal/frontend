# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: CC0-1.0

ARG NODE_IMAGE=docker.io/library/node:26.10.0-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2
ARG NGINX_IMAGE=docker.io/nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6
FROM ${NODE_IMAGE} AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
ARG SOURCE_DATE_EPOCH
RUN npm run build:web

FROM ${NGINX_IMAGE} AS runtime

ARG SECPAL_IMAGE_REVISION=unknown
ARG SECPAL_IMAGE_VERSION=0.0.1

LABEL org.opencontainers.image.title="SecPal Frontend" \
      org.opencontainers.image.description="Unprivileged static reference server for the SecPal frontend" \
      org.opencontainers.image.source="https://github.com/SecPal/frontend" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.revision="${SECPAL_IMAGE_REVISION}" \
      org.opencontainers.image.version="${SECPAL_IMAGE_VERSION}"

USER root

# The qualified 30-package inventory includes curl's dependencies; reject drift.
RUN printf '%s\n' 'https://dl-cdn.alpinelinux.org/alpine/v3.24/main' > /etc/apk/repositories \
    && apk add --no-cache zlib=1.3.2-r1 curl=8.22.0-r0 \
    && awk -F: '$1 == "P" { p = $2 } $1 == "V" { print p "=" $2 }' /lib/apk/db/installed > /tmp/secpal-apk-inventory \
    && LC_ALL=C sort -o /tmp/secpal-apk-inventory /tmp/secpal-apk-inventory \
    && test "$(sha256sum /tmp/secpal-apk-inventory)" = '4b642855523dca331b91a71bc2054654cfbdd005d681b2400f3403fd2eaeb208  /tmp/secpal-apk-inventory' \
    && rm /tmp/secpal-apk-inventory \
    && rm -rf /usr/share/nginx/html

COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY --from=build /app/LICENSE /usr/share/licenses/secpal-frontend/LICENSE
COPY --from=build /app/LICENSES/ /usr/share/licenses/secpal-frontend/LICENSES/
COPY --chmod=0444 docker/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=0444 docker/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0444 docker/security-headers.conf /etc/nginx/snippets/secpal-security-headers.conf
COPY --chmod=0555 docker/health-live.sh /usr/local/bin/secpal-health-live
COPY --chmod=0555 docker/secpal-entrypoint.sh /usr/local/bin/secpal-entrypoint
RUN find /usr/share/nginx/html /usr/share/licenses/secpal-frontend \
      -type d -exec chmod 0555 {} + \
    && find /usr/share/nginx/html /usr/share/licenses/secpal-frontend \
      -type f -exec chmod 0444 {} + \
    && chmod 0444 \
      /etc/nginx/nginx.conf \
      /etc/nginx/conf.d/default.conf \
      /etc/nginx/snippets/secpal-security-headers.conf \
    && chmod 0555 /etc/nginx/snippets /usr/local/bin/secpal-entrypoint

USER 101:101

EXPOSE 8080
STOPSIGNAL SIGTERM

# Declarative recommendation; OCI consumers explicitly configure this same probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD /usr/local/bin/secpal-health-live

ENTRYPOINT ["/usr/local/bin/secpal-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
