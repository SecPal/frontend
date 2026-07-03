// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isSafeHttpUrl } from "@/utils/safeUrl";

const SOURCE_OFFER_URL = "/source-offer.json";

export type SourceRepositoryId = "frontend" | "api" | "contracts" | "android";

interface SourceRepositoryDefinition {
  id: SourceRepositoryId;
  name: string;
  repositoryUrl: string;
}

export interface SourceOfferRepository extends SourceRepositoryDefinition {
  sourceUrl: string;
}

export interface LoadedSourceOffer {
  mode: "deployment" | "fallback";
  repositories: SourceOfferRepository[];
}

const SOURCE_REPOSITORY_DEFINITIONS: readonly SourceRepositoryDefinition[] = [
  {
    id: "frontend",
    name: "SecPal/frontend",
    repositoryUrl: "https://github.com/SecPal/frontend",
  },
  {
    id: "api",
    name: "SecPal/api",
    repositoryUrl: "https://github.com/SecPal/api",
  },
  {
    id: "contracts",
    name: "SecPal/contracts",
    repositoryUrl: "https://github.com/SecPal/contracts",
  },
  {
    id: "android",
    name: "SecPal/android",
    repositoryUrl: "https://github.com/SecPal/android",
  },
] as const;

const REQUIRED_DEPLOYMENT_SOURCE_IDS: readonly SourceRepositoryId[] = [
  "frontend",
  "api",
  "contracts",
] as const;

interface SourceOfferManifestRepository {
  sourceUrl: string;
}

interface SourceOfferManifest {
  version: 1;
  repositories: Partial<
    Record<SourceRepositoryId, SourceOfferManifestRepository>
  >;
}

type SourceOfferFetch = typeof fetch;

function getFallbackSourceOffer(): LoadedSourceOffer {
  return {
    mode: "fallback",
    repositories: SOURCE_REPOSITORY_DEFINITIONS.map((repository) => ({
      ...repository,
      sourceUrl: repository.repositoryUrl,
    })),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseManifestRepository(
  value: unknown
): SourceOfferManifestRepository | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const sourceUrl = String(value.sourceUrl ?? "").trim();
  if (!isSafeHttpUrl(sourceUrl)) {
    return null;
  }

  return {
    sourceUrl,
  };
}

function parseSourceOfferManifest(value: unknown): SourceOfferManifest | null {
  if (!isObjectRecord(value) || value.version !== 1) {
    return null;
  }

  const repositoriesValue = value.repositories;
  if (!isObjectRecord(repositoriesValue)) {
    return null;
  }

  const repositories: Partial<
    Record<SourceRepositoryId, SourceOfferManifestRepository>
  > = {};

  for (const repository of SOURCE_REPOSITORY_DEFINITIONS) {
    const parsedRepository = parseManifestRepository(
      repositoriesValue[repository.id]
    );

    if (parsedRepository !== null) {
      repositories[repository.id] = parsedRepository;
    }
  }

  if (
    REQUIRED_DEPLOYMENT_SOURCE_IDS.some(
      (repositoryId) => repositories[repositoryId] === undefined
    )
  ) {
    return null;
  }

  return {
    version: 1,
    repositories,
  };
}

function resolveDeploymentSourceOffer(
  manifest: SourceOfferManifest
): LoadedSourceOffer {
  return {
    mode: "deployment",
    repositories: SOURCE_REPOSITORY_DEFINITIONS.map((repository) => ({
      ...repository,
      sourceUrl:
        manifest.repositories[repository.id]?.sourceUrl ??
        repository.repositoryUrl,
    })),
  };
}

export async function loadSourceOffer(
  fetchImplementation: SourceOfferFetch = globalThis.fetch
): Promise<LoadedSourceOffer> {
  if (typeof fetchImplementation !== "function") {
    return getFallbackSourceOffer();
  }

  try {
    const response = await fetchImplementation(SOURCE_OFFER_URL, {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return getFallbackSourceOffer();
    }

    const manifest = parseSourceOfferManifest(await response.json());
    if (manifest === null) {
      return getFallbackSourceOffer();
    }

    return resolveDeploymentSourceOffer(manifest);
  } catch {
    return getFallbackSourceOffer();
  }
}

export function getFallbackSourceRepositories(): SourceOfferRepository[] {
  return getFallbackSourceOffer().repositories;
}
