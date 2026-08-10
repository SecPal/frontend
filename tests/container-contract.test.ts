// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("frontend container source contract", () => {
  it("keeps source-imported test helpers inside the container build context", () => {
    const dockerignore = readRepoFile(".dockerignore");
    const authContextTest = readRepoFile("src/contexts/AuthContext.test.tsx");
    const useAuthTest = readRepoFile("src/hooks/useAuth.test.ts");

    expect(dockerignore).toMatch(/^tests$/mu);
    expect(authContextTest).toContain('from "../testUtils/serializedWebLocks"');
    expect(useAuthTest).toContain('from "../testUtils/serializedWebLocks"');
  });

  it("pins exact multi-architecture Debian base image manifests", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain(
      "node:22.22.2-bookworm-slim@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e"
    );
    expect(dockerfile).toContain(
      "nginxinc/nginx-unprivileged:1.30.4-trixie@sha256:679387908ea95d6d8de12952cd15d6b351258054a992d2106d3b6aa12659d87d"
    );
    expect(dockerfile).toContain(
      "COPY package.json package-lock.json .npmrc ./"
    );
    expect(dockerfile).toContain("RUN npm run build:web");
    expect(dockerfile).toMatch(
      /RUN find \/usr\/share\/nginx\/html \/usr\/share\/licenses\/secpal-frontend[^]*-type f -exec chmod 0444[^]*&& chmod 0444[^]*&& chmod 0555 \/etc\/nginx\/snippets \/usr\/local\/bin\/secpal-entrypoint/u
    );
    expect(dockerfile).toContain(
      "chmod 0555 /etc/nginx/snippets /usr/local/bin/secpal-entrypoint"
    );
    expect(dockerfile).toContain("USER 101:101");
    expect(dockerfile).toContain("EXPOSE 8080");
    expect(dockerfile).not.toContain(
      "--chown=101:101 /app/dist/ /usr/share/nginx/html/"
    );
    expect(dockerfile).not.toMatch(/alpine|:latest/iu);
  });

  it("keeps Nginx a read-only static server without CSP or edge behavior", () => {
    const securityHeaders = readRepoFile("docker/security-headers.conf");
    const nginxConfig = `${readRepoFile("docker/nginx.conf")}\n${readRepoFile(
      "docker/default.conf"
    )}\n${securityHeaders}`;

    expect(nginxConfig).toContain("listen 8080;");
    expect(nginxConfig).toContain("listen [::]:8080;");
    expect(nginxConfig).toContain("server_name _;");
    expect(nginxConfig).toContain("/tmp/secpal-runtime/runtime-config.js");
    expect(nginxConfig).toContain("location = /health/live");
    expect(nginxConfig).toContain("try_files $uri $uri/ /index.html;");
    expect(nginxConfig).toMatch(
      /location ~\* \\\.md\$[^}]*default_type text\/markdown;/u
    );
    expect(nginxConfig).not.toMatch(
      /proxy_pass|fastcgi_pass|ssi\s+on|sub_filter|Content-Security-Policy|Strict-Transport-Security|ssl_certificate|listen\s+(?:80|443)\b/iu
    );
    expect(securityHeaders).toContain("X-Content-Type-Options");
    expect(securityHeaders).toContain("Referrer-Policy");
    expect(securityHeaders).toContain("X-Frame-Options");
    expect(securityHeaders).toContain("Permissions-Policy");

    for (const directive of [
      "pid",
      "client_body_temp_path",
      "proxy_temp_path",
      "fastcgi_temp_path",
      "uwsgi_temp_path",
      "scgi_temp_path",
    ]) {
      expect(nginxConfig).toMatch(new RegExp(`${directive}\\s+/tmp/`, "u"));
    }
  });

  it("validates and atomically writes only the runtime API origin", () => {
    const entrypoint = readRepoFile("docker/secpal-entrypoint.sh");

    expect(entrypoint).toContain("set -eu");
    expect(entrypoint).toContain("umask 077");
    expect(entrypoint).toContain("SECPAL_API_URL");
    expect(entrypoint).toContain("/tmp/secpal-runtime");
    expect(entrypoint).toContain("ensure_private_directory");
    expect(entrypoint).toContain("mv");
    expect(entrypoint).toContain('exec "$@"');
    expect(entrypoint).not.toMatch(/\beval\b|\bsource\b|envsubst|sed\b/u);
  });

  it("runs the real hardened image contract and container browser in CI", () => {
    const packageJson = readRepoFile("package.json");
    const browserTest = readRepoFile("tests/e2e/container.spec.ts");
    const browserRunner = readRepoFile("scripts/container-browser.sh");
    const browserConfig = readRepoFile("playwright.container.config.ts");
    const smokeTest = readRepoFile("scripts/container-smoke.sh");
    const workflow = readRepoFile(".github/workflows/frontend-container.yml");

    expect(packageJson).toContain('"test:container"');
    expect(packageJson).toContain(
      '"test:e2e:container": "bash ./scripts/container-browser.sh"'
    );
    expect(browserRunner).toContain(
      "secpal.dev/test-role=frontend-container-browser"
    );
    expect(browserRunner).toContain("docker rm --force");
    expect(browserRunner).toContain("--publish 127.0.0.1::8080");
    expect(browserRunner).toContain("SECPAL_CONTAINER_BASE_URL");
    expect(browserRunner).not.toContain("docker ps --all");
    expect(browserRunner).not.toContain("127.0.0.1:4176");
    expect(browserRunner).toContain("container-test-image-tag.mjs");
    expect(browserRunner).toMatch(
      /SECPAL_CONTAINER_SKIP_BUILD[^]*docker build[^]*elif ! docker image inspect/u
    );
    expect(smokeTest).toContain("container-test-image-tag.mjs");
    expect(smokeTest).toContain('"https://localhost"');
    expect(smokeTest).toContain('"https://127.0.0.1"');
    expect(smokeTest).toContain('"https://[::1]"');
    expect(browserConfig).toContain("process.env.SECPAL_CONTAINER_BASE_URL");
    expect(browserConfig).not.toContain("webServer:");
    expect(browserTest).toContain("process.env.SECPAL_CONTAINER_BASE_URL");
    expect(browserTest).not.toContain("127.0.0.1:4176");
    expect(browserTest).toContain('page.on("request"');
    expect(browserTest).toContain('["fetch", "xhr"]');
    expect(browserTest).not.toContain("startsWith(apiOrigin)");
    expect(browserTest).toContain("new URL(requestUrl).origin");
    expect(smokeTest).toContain("--read-only");
    expect(smokeTest).toContain("--cap-drop=ALL");
    expect(smokeTest).toContain("no-new-privileges:true");
    expect(smokeTest).toContain("Nginx snippets directory mode is not 0555");
    expect(smokeTest).toContain(
      "Nginx security headers are not readable by the runtime user"
    );
    expect(smokeTest).toMatch(
      /docker restart "\$CONTAINER_A"[^]*PORT_A=\$\(container_port "\$CONTAINER_A"\)[^]*wait_for_live "\$CONTAINER_A" "\$PORT_A"/u
    );
    expect(smokeTest).toContain("source maps");
    expect(smokeTest).toContain("SECPAL_API_URL");
    expect(workflow).toContain("name: Frontend Container");
    expect(workflow).toContain("name: Container Contract");
    expect(workflow).toContain('node-version: "22.22.2"');
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toMatch(
      /packages:\s*write|id-token:\s*write|docker\s+push|buildx\s+--push/iu
    );
  });

  it.each(["scripts/container-smoke.sh", "scripts/container-browser.sh"])(
    "%s reports the rejected container platform",
    (script) => {
      const unsupportedPlatform = "linux/riscv64";
      const result = spawnSync("bash", [script], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SECPAL_CONTAINER_PLATFORM: unsupportedPlatform,
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `ERROR: unsupported container platform: ${unsupportedPlatform}`
      );
    }
  );

  it("validates the smoke platform before allocating temporary resources", () => {
    const temporaryRoot = mkdtempSync(
      path.join(tmpdir(), "secpal-invalid-platform-")
    );

    try {
      const result = spawnSync("bash", ["scripts/container-smoke.sh"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SECPAL_CONTAINER_PLATFORM: "linux/riscv64",
          TMPDIR: temporaryRoot,
        },
      });

      expect(result.status).toBe(1);
      expect(readdirSync(temporaryRoot)).toEqual([]);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
