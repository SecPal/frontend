// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { load } from "js-yaml";
import { describe, it, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

interface WorkflowUsesReference {
  reference: string;
  reviewComment: string | undefined;
}

interface WorkflowSource {
  path: string;
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getWorkflowSources(): WorkflowSource[] {
  const workflowFiles = execFileSync("git", ["ls-files", ".github/workflows"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /\.ya?ml$/u.test(file));

  return workflowFiles.map((workflowFile) => ({
    path: workflowFile,
    source: readRepoFile(workflowFile),
  }));
}

function getReviewComments(
  lines: string[],
  references: string[]
): Array<string | undefined> {
  const remainingReferences = [...references];

  return lines.flatMap((line, index) => {
    const referenceIndex = remainingReferences.findIndex(
      (reference) =>
        /^\s*(?:-\s*)?uses:\s*|[,{]\s*uses:\s*/u.test(line) &&
        line.includes(reference)
    );

    if (referenceIndex === -1) {
      return [];
    }

    remainingReferences.splice(referenceIndex, 1);
    const inlineComment = line.match(/\s#\s*(.*)$/u)?.[1]?.trim();

    return [
      inlineComment ||
        lines[index - 1]?.match(/^\s*#\s*(.*?)\s*$/u)?.[1]?.trim(),
    ];
  });
}

function getWorkflowUsesReferencesFromSource(
  workflow: string
): WorkflowUsesReference[] {
  const lines = workflow.split("\n");
  const document = load(workflow);

  if (!isRecord(document) || !isRecord(document.jobs)) {
    return [];
  }

  const references = Object.values(document.jobs).flatMap((job) => {
    if (!isRecord(job)) {
      return [];
    }

    const reusableWorkflowReference =
      typeof job.uses === "string" ? [job.uses] : [];
    const stepReferences = Array.isArray(job.steps)
      ? job.steps.flatMap((step) =>
          isRecord(step) && typeof step.uses === "string" ? [step.uses] : []
        )
      : [];

    return [...reusableWorkflowReference, ...stepReferences];
  });

  const reviewComments = getReviewComments(lines, references);

  return references.map((reference, index) => ({
    reference,
    reviewComment: reviewComments[index],
  }));
}

function getWorkflowUsesReferences(): WorkflowUsesReference[] {
  return getWorkflowSources().flatMap(({ source }) =>
    getWorkflowUsesReferencesFromSource(source)
  );
}

function expectVersionAtLeast(
  actualVersion: string | undefined,
  minimumVersion: string
): void {
  expect(actualVersion).toMatch(/^\d+\.\d+\.\d+$/u);
  expect(minimumVersion).toMatch(/^\d+\.\d+\.\d+$/u);

  const actualParts = actualVersion!.split(".").map(Number);
  const minimumParts = minimumVersion.split(".").map(Number);
  const comparison = actualParts.reduce(
    (result, part, index) =>
      result === 0 ? Math.sign(part - minimumParts[index]) : result,
    0
  );

  expect(comparison).toBeGreaterThanOrEqual(0);
}

function getIndentedSection(text: string, sectionName: string): string {
  const lines = text.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim() === `${sectionName}:`
  );

  if (startIndex === -1) {
    return "";
  }

  const sectionIndent = lines[startIndex].match(/^ */)?.[0].length ?? 0;
  const sectionLines = [lines[startIndex]];

  for (const line of lines.slice(startIndex + 1)) {
    const lineIndent = line.match(/^ */)?.[0].length ?? 0;

    if (line.trim() !== "" && lineIndent <= sectionIndent) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

function expectWarningFreeShippedNginxConfigSyntax(nginxConfig: string): void {
  expect(nginxConfig).toMatch(/^\s*http2\s+on;$/mu);
  expect(nginxConfig).not.toMatch(/^\s*listen\b[^#;\n]*\bhttp2\b[^;\n]*;$/mu);
  expect(nginxConfig).not.toMatch(/^\s*ssi_types\s+text\/html;$/mu);
}

function expectStrictBuildAssets(distRoot: string): void {
  const assetRoot = path.join(distRoot, "assets");
  const assetNames = readdirSync(assetRoot);
  const stylesheet = assetNames
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(path.join(assetRoot, name), "utf8"))
    .join("\n");
  const scripts = [
    readFileSync(path.join(distRoot, "sw.js"), "utf8"),
    ...assetNames
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(path.join(assetRoot, name), "utf8")),
  ];

  expect(stylesheet).toMatch(/data-open\\:animate-in\[data-open\]/u);
  expect(stylesheet).toMatch(/data-closed\\:animate-out\[data-closed\]/u);
  expect(stylesheet).toContain("@keyframes enter");
  expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  expect(scripts.length).toBeGreaterThan(1);

  for (const script of scripts) {
    expect(script).not.toMatch(/@radix-ui|radix-ui/iu);
    expect(script).not.toMatch(/\beval\s*\(|\bnew\s+Function\s*\(/u);
  }
}

/**
 * Build Configuration and Source Verification Tests
 *
 * These tests verify that the required source files and build configuration
 * are present and contain the expected directives. They read repo source
 * files directly, except for focused regressions that intentionally run a
 * real build to verify emitted output paths.
 */
describe("Build Configuration and Source Verification", () => {
  it("loads the neutral external runtime configuration before the application module", () => {
    const indexHtml = readRepoFile("index.html");
    const document = new JSDOM(indexHtml).window.document;
    const runtimeScript = document.querySelector(
      'script[src="/runtime-config.js"]'
    );
    const applicationScript = document.querySelector(
      'script[type="module"][src="/src/main.tsx"]'
    );
    const runtimeConfig = readRepoFile("public/runtime-config.js");

    expect(runtimeScript).not.toBeNull();
    expect(applicationScript).not.toBeNull();
    expect(runtimeScript!.compareDocumentPosition(applicationScript!)).toBe(
      document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(runtimeConfig).toContain("apiBaseUrl: null");
    expect(runtimeConfig).not.toMatch(/https?:\/\//u);
  });

  it("excludes runtime-config.js from precache and runtime script caches", () => {
    const viteConfig = readRepoFile("vite.config.ts");
    const serviceWorker = readRepoFile("src/sw.ts");

    expect(viteConfig).toContain('"runtime-config.js"');
    expect(serviceWorker).toContain('pathname !== "/runtime-config.js"');
  });
  it("keeps the hooks diagnostic SPDX copyright year current", () => {
    const diagnosticScript = readRepoFile("scripts/diagnose-hooks.sh");

    expect(diagnosticScript).toContain(
      "# SPDX-FileCopyrightText: 2025-2026 SecPal Contributors"
    );
  });

  it("keeps the Vite environment declarations SPDX copyright year current", () => {
    const viteEnvironmentDeclarations = readRepoFile("src/vite-env.d.ts");

    expect(viteEnvironmentDeclarations).toContain(
      "// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors"
    );
  });

  it("keeps the hooks diagnostic command literal without suppressing ShellCheck", () => {
    const diagnosticScript = readRepoFile("scripts/diagnose-hooks.sh");

    expect(diagnosticScript).toContain(
      'echo "     env -i HOME=\\$HOME TERM=\\$TERM bash --norc --noprofile"'
    );
  });

  it("keeps the Apache SPA routing file in the build inputs", () => {
    expect(existsSync(path.join(repoRoot, "public/.htaccess"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "index.html"))).toBe(true);

    const htaccess = readRepoFile("public/.htaccess");
    expect(htaccess).toContain("RewriteEngine On");
    expect(htaccess).toContain("RewriteRule . /index.html [L]");
  });

  it("ships Android Digital Asset Links for passkey trust on app.secpal.dev", () => {
    expect(existsSync(path.join(repoRoot, "config/assetlinks.json"))).toBe(
      true
    );

    const assetLinks = JSON.parse(
      readRepoFile("config/assetlinks.json")
    ) as Array<{
      relation: string[];
      target: {
        namespace: string;
        package_name: string;
        sha256_cert_fingerprints: string[];
      };
    }>;

    expect(assetLinks).toEqual([
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "app.secpal",
          sha256_cert_fingerprints: [
            "C3:E9:FD:07:69:F3:34:9B:B0:B0:56:BA:E6:69:47:23:40:E1:CB:28:66:26:DE:30:C9:C9:FA:F9:5F:1E:47:B5",
          ],
        },
      },
    ]);
  });

  it("ships a versioned Nginx config for app.secpal.dev", () => {
    expect(
      existsSync(path.join(repoRoot, "deploy/nginx/app.secpal.dev.conf"))
    ).toBe(true);

    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(nginxConfig).toContain("server_name app.secpal.dev;");
    expect(nginxConfig).toContain("try_files $uri $uri/ /index.html;");
    expect(nginxConfig).toContain("location ~ ^/(v1|sanctum)(/|$)");
    expect(nginxConfig).toContain("location ~ ^/health(/|$)");
  });

  it("keeps vite-plugin-static-copy configured for .htaccess", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("vite-plugin-static-copy");
    expect(viteConfig).toContain('src: "public/.htaccess"');
    expect(viteConfig).toContain('dest: "."');
  });

  it("runs release-build artifact checks separately from the parallel CI suite", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      "test:ci":
        "vitest run --silent=passed-only --exclude tests/build.test.ts --exclude tests/shadcn-provenance.test.ts && npm run --ignore-scripts test:ci:release-builds",
      "pretest:ci:release-builds": "npm run test:pr-size-advisory",
      "test:ci:release-builds":
        "vitest run tests/build.test.ts --silent=passed-only --maxWorkers=1 --no-file-parallelism && vitest run tests/shadcn-provenance.test.ts --silent=passed-only --maxWorkers=1 --no-file-parallelism",
      "test:coverage:ci":
        "vitest run --coverage --silent=passed-only --exclude tests/build.test.ts --exclude tests/shadcn-provenance.test.ts && npm run --ignore-scripts test:ci:release-builds",
    });
  });

  it("forwards custom Vite output directories to the build artifact and SBOM", () => {
    const distRoot = mkdtempSync(path.join(tmpdir(), "secpal-build-output-"));
    const safeEnv = { ...process.env, VITE_APP_SURFACE: "web" };
    delete safeEnv.NODE_V8_COVERAGE;

    try {
      execFileSync(
        "npm",
        ["run", "build", "--", "--outDir", distRoot, "--base", "/custom/"],
        {
          cwd: repoRoot,
          stdio: "pipe",
          env: safeEnv,
        }
      );

      expect(existsSync(path.join(distRoot, "index.html"))).toBe(true);
      expect(existsSync(path.join(distRoot, "dependencies.spdx.json"))).toBe(
        true
      );
      expect(
        existsSync(path.join(distRoot, "THIRD-PARTY-DEPENDENCY-NOTICES.md"))
      ).toBe(true);
      const dependencyNotices = readFileSync(
        path.join(distRoot, "THIRD-PARTY-DEPENDENCY-NOTICES.md"),
        "utf8"
      );
      expect(dependencyNotices).toContain("@fontsource/inter");
      expect(dependencyNotices).toContain("## tailwindcss@");
      expect(dependencyNotices).toContain("SIL Open Font License");
      expect(dependencyNotices).toContain(
        "Copyright 2016 The Inter Project Authors"
      );
      for (const workboxPackage of [
        "workbox-core",
        "workbox-precaching",
        "workbox-routing",
        "workbox-strategies",
      ]) {
        expect(dependencyNotices).toContain(`## ${workboxPackage}@`);
      }
      expect(readFileSync(path.join(distRoot, "sw.js"), "utf8")).toContain(
        "THIRD-PARTY-DEPENDENCY-NOTICES.md"
      );
      expect(existsSync(path.join(distRoot, "THIRD-PARTY-NOTICES.md"))).toBe(
        true
      );
      expect(existsSync(path.join(distRoot, "LICENSES/MIT.txt"))).toBe(true);
      expect(readFileSync(path.join(distRoot, "index.html"), "utf8")).toContain(
        'src="/custom/'
      );
      const builtHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
      const document = new JSDOM(builtHtml).window.document;
      const csp = document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      );

      expect(csp).not.toBeNull();
      expect(
        csp!.compareDocumentPosition(document.querySelector("script")!)
      ).toBe(document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);
      expect(csp!.getAttribute("content")).toBe(
        "default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; form-action 'self'; frame-src 'none'; img-src 'self' data: blob:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; worker-src 'self'"
      );
      expect(document.querySelectorAll("style")).toHaveLength(0);
      expect(
        [...document.querySelectorAll("script")].every(
          (script) => script.src && script.textContent?.trim() === ""
        )
      ).toBe(true);
      expect(
        [...document.querySelectorAll("*")].flatMap((element) =>
          [...element.attributes].filter((attribute) =>
            /^on/iu.test(attribute.name)
          )
        )
      ).toHaveLength(0);
      expect(builtHtml).not.toMatch(
        /nonce=|csp-nonce|<!--#|unsafe-inline|unsafe-eval|unsafe-hashes/iu
      );
      expect(document.querySelector('link[rel="stylesheet"]')).not.toBeNull();
      expect(document.querySelector("script[src]")).not.toBeNull();
      const runtimeConfigScript = document.querySelector(
        'script[src$="/runtime-config.js"]'
      );
      const applicationModule = document.querySelector('script[type="module"]');
      expect(runtimeConfigScript).not.toBeNull();
      expect(applicationModule).not.toBeNull();
      expect(
        runtimeConfigScript!.compareDocumentPosition(applicationModule!)
      ).toBe(document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);
      expectStrictBuildAssets(distRoot);

      const referencedNotificationIcons = [
        "src/hooks/useNotifications.ts",
        "src/sw.ts",
      ].flatMap((sourcePath) =>
        Array.from(
          readRepoFile(sourcePath).matchAll(
            /["'](\/pwa-[^"']+\.(?:png|svg))["']/gu
          ),
          (match) => match[1]
        )
      );

      expect(referencedNotificationIcons.length).toBeGreaterThan(0);
      for (const iconPath of new Set(referencedNotificationIcons)) {
        expect(existsSync(path.join(distRoot, iconPath.slice(1)))).toBe(true);
      }
    } finally {
      rmSync(distRoot, { recursive: true, force: true });
    }
    // This covers the full release build path (typecheck, Vite/PWA build, and
    // SBOM generation). It can exceed 60 seconds under full-suite load, so
    // retain a load-tolerant timeout without changing lightweight test defaults.
  }, 120_000);

  it("emits the strict CSP artifact contract for the Android surface", () => {
    const distRoot = mkdtempSync(path.join(tmpdir(), "secpal-android-output-"));
    const safeEnv = {
      ...process.env,
      VITE_APP_SURFACE: "android-native",
    };
    delete safeEnv.NODE_V8_COVERAGE;

    try {
      execFileSync(
        "npm",
        ["run", "build:android", "--", "--outDir", distRoot],
        {
          cwd: repoRoot,
          stdio: "pipe",
          env: safeEnv,
        }
      );

      const builtHtml = readFileSync(path.join(distRoot, "index.html"), "utf8");
      const document = new JSDOM(builtHtml).window.document;
      const csp = document.querySelector(
        'meta[http-equiv="Content-Security-Policy"]'
      );

      expect(csp?.getAttribute("content")).toBe(
        "default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; form-action 'self'; frame-src 'none'; img-src 'self' data: blob:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; worker-src 'self'"
      );
      expect(document.querySelectorAll("style")).toHaveLength(0);
      expect(
        [...document.querySelectorAll("script")].every(
          (script) => script.src && script.textContent?.trim() === ""
        )
      ).toBe(true);
      expect(
        [...document.querySelectorAll("*")].flatMap((element) =>
          [...element.attributes].filter((attribute) =>
            /^on/iu.test(attribute.name)
          )
        )
      ).toHaveLength(0);
      expect(builtHtml).not.toMatch(
        /nonce=|csp-nonce|<!--#|unsafe-inline|unsafe-eval|unsafe-hashes/iu
      );
      expect(document.querySelector('link[rel="stylesheet"]')).not.toBeNull();
      expect(document.querySelector("script[src]")).not.toBeNull();
      const runtimeConfigScript = document.querySelector(
        'script[src$="/runtime-config.js"]'
      );
      const applicationModule = document.querySelector('script[type="module"]');
      expect(runtimeConfigScript).not.toBeNull();
      expect(applicationModule).not.toBeNull();
      expect(
        runtimeConfigScript!.compareDocumentPosition(applicationModule!)
      ).toBe(document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING);
      expectStrictBuildAssets(distRoot);
      expect(existsSync(path.join(distRoot, "sw.js"))).toBe(true);
      expect(existsSync(path.join(distRoot, "dependencies.spdx.json"))).toBe(
        true
      );
      expect(
        existsSync(path.join(distRoot, "THIRD-PARTY-DEPENDENCY-NOTICES.md"))
      ).toBe(true);
      expect(existsSync(path.join(distRoot, "THIRD-PARTY-NOTICES.md"))).toBe(
        true
      );
    } finally {
      rmSync(distRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it("sets timeout-minutes on every runnable workflow job", () => {
    const workflowSources = getWorkflowSources();

    expect(workflowSources.length).toBeGreaterThan(0);

    for (const workflow of workflowSources) {
      const document = load(workflow.source);

      expect(isRecord(document), workflow.path).toBe(true);
      if (!isRecord(document)) {
        continue;
      }

      expect(isRecord(document.jobs), workflow.path).toBe(true);
      if (!isRecord(document.jobs)) {
        continue;
      }

      for (const [jobName, job] of Object.entries(document.jobs)) {
        const jobLocation = `${workflow.path}:jobs.${jobName}`;

        expect(isRecord(job), jobLocation).toBe(true);
        if (!isRecord(job)) {
          continue;
        }

        if (typeof job.uses === "string") {
          expect(job, jobLocation).not.toHaveProperty("timeout-minutes");
          continue;
        }

        expect(job, jobLocation).toHaveProperty("runs-on");
        expect(job, jobLocation).toHaveProperty("timeout-minutes");
      }
    }
  });

  it("pins every GitHub Actions workflow reference to an immutable commit SHA", () => {
    const references = getWorkflowUsesReferences();

    expect(references.length).toBeGreaterThan(0);
    for (const { reference } of references) {
      expect(reference).toMatch(/@[0-9a-f]{40}$/u);
    }
  });

  it("extracts workflow references from named and unnamed action steps", () => {
    const workflow = `
jobs:
  test:
    steps:
      - uses: actions/checkout@main
      - name: Setup Node.js
        uses: actions/setup-node@v7
      - { name: Flow checkout, uses: actions/checkout@main }
`;

    expect(
      getWorkflowUsesReferencesFromSource(workflow).map(
        ({ reference }) => reference
      )
    ).toEqual([
      "actions/checkout@main",
      "actions/setup-node@v7",
      "actions/checkout@main",
    ]);
  });

  it("associates review comments with each repeated workflow reference", () => {
    const workflow = `
jobs:
  test:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
`;

    expect(getWorkflowUsesReferencesFromSource(workflow)).toEqual([
      {
        reference: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        reviewComment: "v7",
      },
      {
        reference: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
        reviewComment: undefined,
      },
    ]);
  });

  it("keeps the reviewed version or branch next to every workflow reference", () => {
    const references = getWorkflowUsesReferences();

    expect(references.length).toBeGreaterThan(0);
    for (const { reference, reviewComment } of references) {
      expect(reviewComment, reference).toMatch(
        /^(?:main|v\d+(?:\.\d+)*)(?:\b|;)/u
      );
    }
  });

  it("runs the required UI and CSP check for every pull request", () => {
    const workflow = readRepoFile(".github/workflows/ui-csp.yml");
    const pullRequestTrigger = getIndentedSection(workflow, "pull_request");

    expect(pullRequestTrigger).not.toContain("paths:");
    expect(getIndentedSection(workflow, "jobs")).toContain("strict-csp:");
  });

  it("keeps the package-lock root license aligned with package.json", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      license: string;
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages?: Record<string, { license?: string }>;
    };

    expect(packageLock.packages?.[""]?.license).toBe(packageJson.license);
  });

  it("declares Chai for Vitest's assertion package", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages: Record<
        string,
        {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      >;
    };

    const expectedChaiRange =
      packageLock.packages["node_modules/@vitest/expect"]?.dependencies?.chai;

    expect(expectedChaiRange).toBeDefined();
    expect(packageJson.devDependencies?.chai).toBe(expectedChaiRange);
    expect(packageLock.packages[""]?.devDependencies?.chai).toBe(
      expectedChaiRange
    );
    expect(packageLock.packages["node_modules/chai"]).toBeDefined();
  });

  it("keeps the July 2026 dependency remediations upgradeable", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      dependencies?: Record<string, string>;
      overrides?: Record<string, string>;
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages: Record<string, { version?: string }>;
    };

    expect(packageJson.dependencies?.["react-router"]).toMatch(/^\^/u);
    expect(packageJson.dependencies?.["react-router-dom"]).toBeUndefined();
    expect(packageJson.overrides?.["js-yaml"]).toMatch(/^>=/u);
    expect(
      packageLock.packages["node_modules/react-router-dom"]
    ).toBeUndefined();
    expectVersionAtLeast(
      packageLock.packages["node_modules/react-router"]?.version,
      "8.3.0"
    );
    expectVersionAtLeast(
      packageLock.packages["node_modules/js-yaml"]?.version,
      "5.2.2"
    );
  });

  it("keeps explicit dev and build scripts for every app surface", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts).toMatchObject({
      dev: "vite",
      "dev:web": "cross-env VITE_APP_SURFACE=web vite --mode web",
      "dev:android":
        "cross-env VITE_APP_SURFACE=android-native vite --mode android",
      "dev:android:mock":
        "cross-env VITE_APP_SURFACE=android-mock vite --mode android",
      "dev:ios": "cross-env VITE_APP_SURFACE=ios-native vite --mode ios",
      build:
        "cross-env VITE_APP_SURFACE=web node ./scripts/build-with-sbom.mjs",
      "build:web":
        "cross-env VITE_APP_SURFACE=web node ./scripts/build-with-sbom.mjs --mode web",
      "build:android":
        "cross-env VITE_APP_SURFACE=android-native node ./scripts/build-with-sbom.mjs --mode android",
      "build:android:mock":
        "cross-env VITE_APP_SURFACE=android-mock node ./scripts/build-with-sbom.mjs --mode preview",
      "build:ios":
        "cross-env VITE_APP_SURFACE=ios-native node ./scripts/build-with-sbom.mjs --mode ios",
      "build:analyze":
        "cross-env VITE_APP_SURFACE=web node ./scripts/build-with-sbom.mjs --mode analyze",
    });
  });

  it("commits per-surface mode env overrides", () => {
    const webEnv = readRepoFile(".env.web");
    const androidEnv = readRepoFile(".env.android");
    const iosEnv = readRepoFile(".env.ios");

    expect(webEnv).toContain("VITE_APP_SURFACE=web");
    expect(webEnv).toContain(
      "Web-targeted Vite mode builds must load the web app surface."
    );
    expect(androidEnv).toContain("VITE_APP_SURFACE=android-native");
    expect(androidEnv).toContain(
      "Android-targeted Vite mode builds must load the Android app surface."
    );
    expect(iosEnv).toContain("VITE_APP_SURFACE=ios-native");
    expect(iosEnv).toContain(
      "iOS-targeted Vite mode builds must load the iOS app surface."
    );
  });

  it("documents the app surface and shared UI source-of-truth contract", () => {
    const readme = readRepoFile("README.md");
    const envExample = readRepoFile(".env.example");

    for (const appSurface of [
      "web",
      "android-mock",
      "android-native",
      "ios-mock",
      "ios-native",
    ]) {
      expect(readme).toContain(appSurface);
      expect(envExample).toContain(appSurface);
    }

    expect(readme).toContain(
      "`frontend` is the source of truth for SecPal product design, UI, and UX"
    );
    expect(readme).toContain(
      "Android and future iOS repositories provide native OS integrations"
    );
    expect(readme).toContain("vite-plugin-pwa");
    expect(readme).toContain("Manifest");
    expect(readme).toContain("Service Worker");
    expect(readme).toContain("Workbox");
    expect(readme).toContain("src/ui");
    expect(readme).toContain("shadcn/Base UI");
    expect(readme).toContain("base-vega");
    expect(readme).toContain("lucide-react");
    expect(readme).toContain("Do not introduce visual rebuilds");
    expect(readme).toContain("npm run dev:android:mock");
    expect(readme).toContain("npm run build:android:mock");
    expect(readme).toContain("PLAYWRIGHT_APP_SURFACE=android-mock");
    expect(readme).toContain("workspace previews keep the deployed bundle");

    expect(envExample).toContain("VITE_APP_SURFACE=web");
    expect(envExample).toContain(
      "VITE_APP_SURFACE selects only the frontend surface contract"
    );
    expect(envExample).toContain(
      "Do not use it for secrets, capabilities, security gates, or auth behavior"
    );
  });

  it("keeps API URL examples on approved SecPal domains", () => {
    const envExample = readRepoFile(".env.example");
    const deploymentDoc = readRepoFile("docs/deployment-spa-routing.md");

    expect(envExample).toContain("https://api.secpal.dev");
    expect(envExample).not.toContain("customer.example");
    expect(deploymentDoc).toContain("https://api.secpal.dev");
    expect(deploymentDoc).toContain("https://customer-api.secpal.dev");
    expect(deploymentDoc).not.toContain("customer.example");
  });

  it("keeps SecPal-owned governance files on the attribution license expression", () => {
    for (const relativePath of [
      ".pre-commit-config.yaml",
      ".yamllint.yml",
      ".github/copilot-instructions.md",
      ".github/instructions/org-shared.instructions.md",
      ".github/instructions/react-typescript.instructions.md",
      ".github/instructions/github-workflows.instructions.md",
    ]) {
      const fileContents = readRepoFile(relativePath);

      expect(fileContents).toContain("SecPal Contributors");
      expect(fileContents).toContain(
        [
          "SPDX-License-Identifier",
          "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
        ].join(": ")
      );
    }
  });

  it("runs Prettier as a local system hook compatible with npm 12", () => {
    const preCommitConfig = readRepoFile(".pre-commit-config.yaml");

    expect(preCommitConfig).not.toContain("pre-commit/mirrors-prettier");
    expect(preCommitConfig).toContain("- id: prettier");
    expect(preCommitConfig).toContain("language: system");
    expect(preCommitConfig).toContain(
      "entry: ./node_modules/.bin/prettier --write"
    );
    expect(preCommitConfig).not.toContain("npx --no-install prettier");
  });

  it("installs Node dependencies before verifying local pre-commit hooks", () => {
    const setupPreCommit = readRepoFile("scripts/setup-pre-commit.sh");

    expect(setupPreCommit).toContain("npm ci");
    expect(setupPreCommit.indexOf("npm ci")).toBeLessThan(
      setupPreCommit.indexOf("pre-commit install --install-hooks")
    );
  });

  it("keeps SecPal attribution off Lukas-owned locale sidecars", () => {
    for (const relativePath of [
      "src/locales/de/messages.js.license",
      "src/locales/de/messages.po.license",
      "src/locales/en/messages.js.license",
      "src/locales/en/messages.po.license",
    ]) {
      const sidecar = readRepoFile(relativePath);

      expect(sidecar).toContain("SecPal Contributors");
      expect(sidecar).toContain(
        ["SPDX", "License-Identifier"].join("-") + ": AGPL-3.0-or-later"
      );
      expect(sidecar).not.toContain("LicenseRef-SecPal-Attribution");
    }
  });

  it("keeps auth-storage MAC payload assembly on the shared helper", () => {
    const storageService = readRepoFile("src/services/storage.ts");
    const passkeyAuthStorage = readRepoFile(
      "tests/utils/passkeyAuthStorage.ts"
    );
    const passkeysSpec = readRepoFile("tests/e2e/passkeys.spec.ts");

    expect(storageService).toContain("./authStorageEnvelope");
    expect(storageService).not.toContain("function buildEnvelopeMacPayload(");

    expect(passkeyAuthStorage).toContain("authStorageEnvelope");
    expect(passkeyAuthStorage).toContain("buildEnvelopeMacPayload(");
    expect(passkeyAuthStorage).not.toContain(
      "function buildEnvelopeMacPayload("
    );

    expect(passkeysSpec).toContain("../utils/passkeyAuthStorage");
    expect(passkeysSpec).not.toContain("function buildEnvelopeMacPayload(");
  });

  it("keeps Lighthouse performance audits on the shared authenticated E2E fixture", () => {
    const performanceSpec = readRepoFile("tests/e2e/performance.spec.ts");
    const packageJson = readRepoFile("package.json");

    expect(performanceSpec).toContain(
      'import { test, expect } from "./auth.setup"'
    );
    expect(performanceSpec).toContain("authenticatedPage: page");
    expect(packageJson).toContain(
      "PLAYWRIGHT_LIGHTHOUSE=1 PLAYWRIGHT_SKIP_GLOBAL_LOGIN=1 playwright test tests/e2e/performance.spec.ts --project=chromium"
    );
  });

  it("keeps vite-plugin-static-copy configured for assetlinks.json", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("vite-plugin-static-copy");
    expect(viteConfig.split('src: "config/assetlinks.json"').length - 1).toBe(
      2
    );
    expect(viteConfig).toContain('dest: ".well-known"');
    expect(
      viteConfig
        .split('src: "config/assetlinks.json"')
        .slice(1)
        .some((block) => block.includes('dest: "."'))
    ).toBe(true);
    expect(viteConfig.split("stripBase: true").length - 1).toBe(2);
    expect(viteConfig.split('name: "assetlinks.json"').length - 1).toBe(2);
  });

  it("emits assetlinks.json at the deployed root and .well-known paths", () => {
    const distRoot = mkdtempSync(path.join(tmpdir(), "secpal-assetlinks-"));

    const safeEnv = { ...process.env, VITE_APP_SURFACE: "web" };
    delete safeEnv.NODE_V8_COVERAGE;

    try {
      execFileSync(
        "npm",
        ["exec", "--", "vite", "build", "--outDir", distRoot],
        {
          cwd: repoRoot,
          stdio: "pipe",
          env: safeEnv,
        }
      );

      expect(existsSync(path.join(distRoot, "assetlinks.json"))).toBe(true);
      expect(
        existsSync(path.join(distRoot, ".well-known", "assetlinks.json"))
      ).toBe(true);
      expect(existsSync(path.join(distRoot, "config", "assetlinks.json"))).toBe(
        false
      );
      expect(
        existsSync(
          path.join(distRoot, ".well-known", "config", "assetlinks.json")
        )
      ).toBe(false);
    } finally {
      rmSync(distRoot, { recursive: true, force: true });
    }
  });

  it("scopes the Lingui macro Babel transform to files that import Lingui macros", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("defineRolldownBabelPreset");
    expect(viteConfig).toContain("linguiMacroBabelPreset");
    expect(viteConfig).toContain("@lingui\\/(?:core|react)\\/macro");
    expect(viteConfig).toMatch(/rolldown\s*:\s*\{\s*filter\s*:\s*\{/);
    expect(viteConfig).toMatch(/filter\s*:\s*\{[\s\S]*\bid\s*:/);
    expect(viteConfig).toMatch(/filter\s*:\s*\{[\s\S]*\bcode\s*:/);
    expect(viteConfig).toMatch(
      /presets\s*:\s*\[\s*linguiMacroBabelPreset\s*\]/
    );
    expect(viteConfig).toContain("@lingui/babel-plugin-lingui-macro");
  });

  it("loads Lingui Vite exports through CJS-safe interop wiring", () => {
    const viteConfig = readRepoFile("vite.config.ts");
    const interopHelper = readRepoFile("linguiVitePluginInterop.ts");

    expect(viteConfig).toContain(
      'import * as linguiVitePlugin from "@lingui/vite-plugin";'
    );
    expect(viteConfig).toContain(
      'import { resolveLinguiVitePluginExports } from "./linguiVitePluginInterop.ts";'
    );
    expect(viteConfig).toContain(
      "resolveLinguiVitePluginExports(linguiVitePlugin)"
    );
    expect(viteConfig).not.toContain(
      'import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";'
    );
    expect(interopHelper).toContain('"lingui"');
    expect(interopHelper).not.toContain('"linguiTransformerBabelPreset"');
  });

  it("typechecks the Vite config with TypeScript-extension imports enabled", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const nodeTypeScriptConfig = JSON.parse(
      readRepoFile("tsconfig.node.json")
    ) as {
      compilerOptions?: {
        allowImportingTsExtensions?: boolean;
        noEmit?: boolean;
      };
    };

    expect(nodeTypeScriptConfig.compilerOptions).toMatchObject({
      allowImportingTsExtensions: true,
      noEmit: true,
    });
    expect(packageJson.scripts?.typecheck).toContain(
      "tsc -p tsconfig.node.json --noEmit"
    );
  });

  it("keeps nginx serving Digital Asset Links even when hidden directories are skipped during deploy", () => {
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(nginxConfig).toContain("location = /.well-known/assetlinks.json");
    expect(nginxConfig).toContain("default_type application/json");
    expect(nginxConfig).toContain("try_files $uri /assetlinks.json =404;");
  });

  it("hardens browser responses with the required security headers", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    const requiredHeaders = [
      "Content-Security-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Referrer-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Origin-Agent-Cluster",
      "X-Permitted-Cross-Domain-Policies",
    ];

    for (const header of requiredHeaders) {
      expect(htaccess).toContain(header);
      expect(nginxConfig).toContain(header);
    }
  });

  it("ships an enforceable CSP that fits the PWA runtime", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(htaccess).toContain("default-src 'self'");
    expect(htaccess).toContain("script-src 'self'");
    expect(htaccess).toContain("object-src 'none'");
    expect(htaccess).toContain("frame-ancestors 'none'");
    expect(htaccess).toContain("worker-src 'self'");
    expect(htaccess).toContain("manifest-src 'self'");
    expect(htaccess).toContain("connect-src 'self'");
    expect(htaccess).toContain("style-src 'self'");
    expect(htaccess).toContain("style-src-elem 'self'");
    expect(htaccess).toContain("style-src-attr 'none'");
    expect(htaccess).not.toMatch(/unsafe-|nonce-|csp_nonce|UNIQUE_ID/u);

    expect(nginxConfig).toContain("default-src 'self'");
    expect(nginxConfig).toContain("script-src 'self'");
    expect(nginxConfig).toContain("object-src 'none'");
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain("worker-src 'self'");
    expect(nginxConfig).toContain("manifest-src 'self'");
    expect(nginxConfig).toContain("connect-src 'self'");
    expect(nginxConfig).toContain("style-src 'self'");
    expect(nginxConfig).toContain("style-src-elem 'self'");
    expect(nginxConfig).toContain("style-src-attr 'none'");
    expect(nginxConfig).not.toMatch(/unsafe-|nonce-|csp_nonce|\bssi\b/u);
    expect(viteConfig).not.toMatch(/cspNonce|nonce-|#echo|\bssi\b/u);
    expect(viteConfig).toContain(
      'globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2,md}"]'
    );
    for (const ignoredAsset of [
      '"**/*.html"',
      '"runtime-config.js"',
      '"theme-color.js"',
      '"document-language.js"',
    ]) {
      expect(viteConfig).toContain(ignoredAsset);
    }
    expect(viteConfig).toContain("navigateFallback: null");
    expect(viteConfig).toContain("injectRegister: false");
    expect(viteConfig).not.toContain("js,css,html,ico");
  });

  it("keeps HTML shells network-first and outside precache", () => {
    const serviceWorker = readRepoFile("src/sw.ts");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).not.toContain("html,ico");
    expect(serviceWorker).toContain("new NetworkFirst");
    expect(serviceWorker).toContain('cacheName: "html-shell"');
    expect(serviceWorker).not.toContain(
      'createHandlerBoundToURL("/index.html")'
    );
  });

  it("keeps early bootstrap scripts out of service-worker caches", () => {
    const serviceWorker = readRepoFile("src/sw.ts");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain('"theme-color.js"');
    expect(viteConfig).toContain('"document-language.js"');
    expect(serviceWorker).toContain("isCacheableStaticAssetRequest");
    expect(serviceWorker).toContain('pathname !== "/theme-color.js"');
    expect(serviceWorker).toContain('pathname !== "/document-language.js"');
  });

  it("uses an external theme-color bootstrap so CSP can block inline scripts", () => {
    const indexHtml = readRepoFile("index.html");

    expect(indexHtml).toContain('<script src="/theme-color.js"></script>');
    expect(indexHtml).toContain("viewport-fit=cover");
    expect(indexHtml).not.toContain("(function () {");
    expect(existsSync(path.join(repoRoot, "public/theme-color.js"))).toBe(true);

    const themeColorJs = readRepoFile("public/theme-color.js");
    expect(themeColorJs.trim().length).toBeGreaterThan(0);
    expect(themeColorJs).toContain("theme-color");
    expect(themeColorJs).not.toContain("<script");
  });

  it("keeps stale hashed-entry recovery in the early bootstrap script", () => {
    const themeColorJs = readRepoFile("public/theme-color.js");
    const assetLoadRecoveryStorageKey = ["secpal", "asset-load-recovery"].join(
      "."
    );

    expect(themeColorJs).toContain("window.addEventListener(");
    expect(themeColorJs).toContain('"error"');
    expect(themeColorJs).toContain(assetLoadRecoveryStorageKey);
    expect(themeColorJs).toContain("navigator.serviceWorker.getRegistrations");
    expect(themeColorJs).toContain("window.caches.keys");
    expect(themeColorJs).toContain("window.location.reload()");
    expect(themeColorJs).toContain("app-bootstrap-ready");
    expect(themeColorJs).not.toContain("(?:\\?.*)?$");
  });

  it("configures Base UI centrally without a nonce carrier", () => {
    const main = readRepoFile("src/main.tsx");
    const indexHtml = readRepoFile("index.html");

    expect(main).toContain("<CSPProvider disableStyleElements>");
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(`${main}\n${indexHtml}`).not.toMatch(/nonce-|cspNonce|#echo/u);
  });

  it("adds dedicated delivery rules for service worker and manifest files", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(htaccess).toContain('Files "sw.js"');
    expect(htaccess).toContain("Service-Worker-Allowed");
    expect(htaccess).toContain("application/manifest+json");
    expect(htaccess).toContain("manifest.webmanifest");
    expect(htaccess).toContain("RewriteCond %{REQUEST_FILENAME} !-f");
    expect(htaccess).toContain("RewriteRule ^source-offer\\.json$ - [R=404,L]");
    expect(htaccess).toContain(
      "RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteRule ^source-offer\\.json$ - [R=404,L]"
    );
    expect(htaccess).toContain('Files "source-offer.json"');
    expect(htaccess).toContain('Cache-Control "no-cache, must-revalidate"');
    expect(htaccess).toContain('Files "theme-color.js"');
    expect(htaccess).toContain('Files "document-language.js"');
    expect(htaccess).toContain(
      'Cache-Control "no-cache, no-store, must-revalidate"'
    );

    expect(nginxConfig).toContain("location = /sw.js");
    expect(nginxConfig).toContain("Service-Worker-Allowed");
    expect(nginxConfig).toContain("default_type application/manifest+json");
    expect(nginxConfig).toContain("location = /manifest.webmanifest");
    expect(nginxConfig).toContain("location = /source-offer.json");
    expect(nginxConfig).toContain("location = /theme-color.js");
    expect(nginxConfig).toContain("location = /document-language.js");
    expect(nginxConfig).toContain("default_type application/json");
  });

  it("keeps the shipped nginx config free of known syntax warnings", () => {
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expectWarningFreeShippedNginxConfigSyntax(nginxConfig);
  });

  it("rejects commented http2 toggles", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        ["server {", "  listen 443 ssl;", "  # http2 on;", "}"].join("\n")
      )
    ).toThrowError();
  });

  it("rejects deprecated http2 listen parameters with extra flags", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        [
          "server {",
          "  listen 443 ssl http2 reuseport;",
          "  http2 on;",
          "}",
        ].join("\n")
      )
    ).toThrowError(/listen\\b.*http2/u);
  });

  it("rejects a live ssi_types text/html override", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        ["server {", "  http2 on;", "  ssi_types text/html;", "}"].join("\n")
      )
    ).toThrowError(/ssi_types/u);
  });

  it("ships a live smoke check for deployed PWA security headers", () => {
    expect(
      existsSync(path.join(repoRoot, "scripts/check-live-pwa-headers.sh"))
    ).toBe(true);
    expect(
      existsSync(
        path.join(repoRoot, "scripts/check-workspace-preview-pwa-headers.mjs")
      )
    ).toBe(true);

    const packageJson = readRepoFile("package.json");

    expect(packageJson).toContain(
      '"test:live:pwa-headers": "bash ./scripts/check-live-pwa-headers.sh"'
    );
    expect(packageJson).toContain(
      '"test:preview:pwa-headers": "node ./scripts/check-workspace-preview-pwa-headers.mjs"'
    );
  });

  it("ships a live smoke check for deployed assetlinks delivery", () => {
    expect(
      existsSync(path.join(repoRoot, "scripts/check-live-assetlinks.sh"))
    ).toBe(true);

    const packageJson = readRepoFile("package.json");

    expect(packageJson).toContain(
      '"test:live:assetlinks": "bash ./scripts/check-live-assetlinks.sh"'
    );
  });

  it("keeps declared Node support compatible with the Markdown toolchain", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      engines: { node: string };
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages: Record<string, { engines?: { node?: string } } | undefined>;
    };
    const markdownToolchainNodeRange =
      packageLock.packages["node_modules/ini"]?.engines?.node;

    expect(markdownToolchainNodeRange).toBeDefined();
    expect(packageJson.engines.node).toBe(markdownToolchainNodeRange);
    expect(readRepoFile("README.md")).toContain(
      `Node.js \`${markdownToolchainNodeRange}\``
    );
  });

  it("keeps PWA shortcuts limited to live routes", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain('url: "/profile"');
    expect(viteConfig).not.toContain('url: "/schedule"');
    expect(viteConfig).not.toContain('url: "/reports/new"');
    expect(viteConfig).not.toContain('url: "/emergency"');
  });

  it("documents the encrypted offline vault design for issue 495", () => {
    expect(
      existsSync(path.join(repoRoot, "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"))
    ).toBe(true);

    const offlineVaultDesign = readRepoFile(
      "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"
    );
    const persistenceAudit = readRepoFile("PWA_OFFLINE_PERSISTENCE_AUDIT.md");

    expect(offlineVaultDesign).toContain("# Encrypted Offline Vault Design");
    expect(offlineVaultDesign).toContain("## Target Key Hierarchy");
    expect(offlineVaultDesign).toContain("## Device-Bound Key Options");
    expect(offlineVaultDesign).toContain(
      "## Lock, Unlock, and Logout Semantics"
    );
    expect(offlineVaultDesign).toContain(
      "## Security Boundaries and UX Trade-Offs"
    );
    expect(offlineVaultDesign).toContain("## Follow-Up Implementation Slices");
    expect(persistenceAudit).toContain(
      "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"
    );
  });
});

/**
 * Manual Verification Checklist
 *
 * After running `npm run build`, manually verify:
 *
 * 1. dist/.htaccess exists
 * 2. dist/.htaccess contains "RewriteEngine On"
 * 3. dist/.htaccess contains "RewriteRule . /index.html [L]"
 * 4. dist/index.html exists
 *
 * Command to verify:
 * ```bash
 * npm run build && ls -la dist/.htaccess && grep "RewriteEngine On" dist/.htaccess
 * ```
 */
