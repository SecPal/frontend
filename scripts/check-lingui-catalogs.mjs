// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
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

    if (previousContent !== currentContent) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles;
}

async function restoreLocales(backupDirectory) {
  await rm(localesDirectory, { recursive: true, force: true });
  await cp(backupDirectory, localesDirectory, { recursive: true });
}

function formatSyncFailure(error) {
  if (typeof error === "object" && error !== null) {
    const message = "message" in error ? String(error.message) : "Unknown error";
    const stderr = "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = "stdout" in error ? String(error.stdout ?? "") : "";

    return [message, stderr, stdout].filter(Boolean).join("\n");
  }

  return String(error);
}

export async function checkLinguiCatalogs() {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "secpal-lingui-catalog-check-")
  );
  const backupDirectory = join(temporaryDirectory, "locales-backup");

  await cp(localesDirectory, backupDirectory, { recursive: true });

  try {
    await execFileAsync(
      "npm",
      ["run", "sync:purge"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          CI: process.env.CI ?? "1",
        },
        maxBuffer: 16 * 1024 * 1024,
      }
    );

    return await diffDirectories(backupDirectory, localesDirectory);
  } catch (error) {
    throw new Error(`Lingui catalog sync check failed.\n${formatSyncFailure(error)}`);
  } finally {
    await restoreLocales(backupDirectory);
    await rm(temporaryDirectory, { recursive: true, force: true });
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
