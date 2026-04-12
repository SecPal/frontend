// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import {
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const projectRoot = resolve(scriptDirectory, "..");
const localesDirectory = join(projectRoot, "src", "locales");
const syncWorkspaceEntries = [
  "lingui.config.cjs",
  "package.json",
  "src",
  "tsconfig.json",
  "tsconfig.node.json",
];

/**
 * Normalize file content to match what the pre-commit hooks produce:
 * strip trailing whitespace from every line and remove the trailing newline.
 * This makes catalog comparisons invariant to the differences produced by
 * `trim-trailing-whitespace` and `end-of-file-fixer` hooks.
 */
function normalizeContent(content) {
  return content
    .split("\n")
    .filter((line) => !line.startsWith('"POT-Creation-Date: '))
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

async function collectRelativeFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix === "" ? entry.name : join(prefix, entry.name);
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(absolutePath, relativePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

async function diffDirectories(previousDirectory, currentDirectory) {
  const previousFiles = await collectRelativeFiles(previousDirectory);
  const currentFiles = await collectRelativeFiles(currentDirectory);
  const allFiles = new Set([...previousFiles, ...currentFiles]);
  const changedFiles = [];

  for (const relativePath of [...allFiles].sort()) {
    const previousExists = previousFiles.includes(relativePath);
    const currentExists = currentFiles.includes(relativePath);

    if (!previousExists || !currentExists) {
      changedFiles.push(relativePath);
      continue;
    }

    const [previousContent, currentContent] = await Promise.all([
      readFile(join(previousDirectory, relativePath), "utf8"),
      readFile(join(currentDirectory, relativePath), "utf8"),
    ]);

    if (normalizeContent(previousContent) !== normalizeContent(currentContent)) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles;
}

function formatSyncFailure(error) {
  if (typeof error === "object" && error !== null) {
    const message =
      "message" in error ? String(error.message) : "Unknown error";
    const stderr = "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = "stdout" in error ? String(error.stdout ?? "") : "";

    return [message, stderr, stdout].filter(Boolean).join("\n");
  }

  return String(error);
}

const syncEnvironmentKeys = [
  "APPDATA",
  "CI",
  "COLORTERM",
  "ComSpec",
  "HOME",
  "http_proxy",
  "HTTP_PROXY",
  "https_proxy",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LOCALAPPDATA",
  "no_proxy",
  "NO_PROXY",
  "NPM_CONFIG_CACHE",
  "NPM_CONFIG_USERCONFIG",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "npm_config_cache",
  "npm_config_userconfig",
];

export function buildSyncEnvironment(environment = process.env) {
  const syncEnvironment = {};

  for (const environmentKey of syncEnvironmentKeys) {
    const environmentValue = environment[environmentKey];

    if (environmentValue !== undefined) {
      syncEnvironment[environmentKey] = environmentValue;
    }
  }

  syncEnvironment.CI = environment.CI ?? "1";

  return syncEnvironment;
}

function getNpmCommand(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function createIsolatedWorkspace(rootDirectory) {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "secpal-lingui-catalog-check-")
  );

  await Promise.all(
    syncWorkspaceEntries.map(async (entry) => {
      const sourcePath = join(rootDirectory, entry);

      if (!(await pathExists(sourcePath))) {
        return;
      }

      await cp(sourcePath, join(workspaceRoot, entry), {
        recursive: true,
      });
    })
  );

  await symlink(
    join(rootDirectory, "node_modules"),
    join(workspaceRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );

  return workspaceRoot;
}

export async function checkLinguiCatalogs({
  execFileAsyncImpl = execFileAsync,
  environment = process.env,
  rootDirectory = projectRoot,
} = {}) {
  const isolatedWorkspaceRoot = await createIsolatedWorkspace(rootDirectory);
  const isolatedLocalesDirectory = join(
    isolatedWorkspaceRoot,
    "src",
    "locales"
  );

  try {
    await execFileAsyncImpl(getNpmCommand(), ["run", "sync:purge"], {
      cwd: isolatedWorkspaceRoot,
      env: buildSyncEnvironment(environment),
      maxBuffer: 16 * 1024 * 1024,
    });

    return await diffDirectories(localesDirectory, isolatedLocalesDirectory);
  } catch (error) {
    throw new Error(
      `Lingui catalog sync check failed.\n${formatSyncFailure(error)}`
    );
  } finally {
    await rm(isolatedWorkspaceRoot, { recursive: true, force: true });
  }
}

const invokedAsScript =
  process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath;

if (invokedAsScript) {
  const changedFiles = await checkLinguiCatalogs();

  if (changedFiles.length === 0) {
    console.log("Lingui catalogs are up to date.");
    process.exit(0);
  }

  console.error(
    [
      "Lingui catalogs are stale. Run `npm run sync:purge` and commit the updated catalogs:",
      ...changedFiles.map((filePath) => `- src/locales/${filePath}`),
    ].join("\n")
  );
  process.exit(1);
}
