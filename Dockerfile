# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: CC0-1.0

FROM node:22.22.2-bookworm-slim@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
ARG SOURCE_DATE_EPOCH
RUN npm run build:web

FROM nginxinc/nginx-unprivileged:1.30.4-trixie@sha256:679387908ea95d6d8de12952cd15d6b351258054a992d2106d3b6aa12659d87d AS runtime

ARG SECPAL_IMAGE_REVISION=unknown
ARG SECPAL_IMAGE_VERSION=0.0.1

LABEL org.opencontainers.image.title="SecPal Frontend" \
      org.opencontainers.image.description="Unprivileged static reference server for the SecPal frontend" \
      org.opencontainers.image.source="https://github.com/SecPal/frontend" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution" \
      org.opencontainers.image.revision="${SECPAL_IMAGE_REVISION}" \
      org.opencontainers.image.version="${SECPAL_IMAGE_VERSION}"

USER root

RUN rm -rf /usr/share/nginx/html

COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY --from=build /app/LICENSE /usr/share/licenses/secpal-frontend/LICENSE
COPY --from=build /app/LICENSES/ /usr/share/licenses/secpal-frontend/LICENSES/
COPY --chmod=0444 docker/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=0444 docker/default.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0444 docker/security-headers.conf /etc/nginx/snippets/secpal-security-headers.conf
COPY --chmod=0555 docker/secpal-entrypoint.sh /usr/local/bin/secpal-entrypoint
RUN find /usr/share/nginx/html /usr/share/licenses/secpal-frontend \
      -type d -exec chmod 0555 {} + \
    && find /usr/share/nginx/html /usr/share/licenses/secpal-frontend \
      -type f -exec chmod 0444 {} + \
    && chmod 0444 \
      /etc/nginx/nginx.conf \
      /etc/nginx/conf.d/default.conf \
      /etc/nginx/snippets/secpal-security-headers.conf \
    && chmod 0555 /usr/local/bin/secpal-entrypoint

USER 101:101

EXPOSE 8080
STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/local/bin/secpal-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
