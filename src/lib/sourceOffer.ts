// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isSafeHttpUrl } from "@/utils/safeUrl";
import { buildApiUrl } from "@/config";

const SOURCE_OFFER_URL = "/source-offer.json";
const API_RELEASE_URL = buildApiUrl("/v1/release");

export type SourceRepositoryId = "frontend" | "api" | "contracts" | "android";

interface SourceRepositoryDefinition {
  id: SourceRepositoryId;
  name: string;
  repositoryUrl: string;
}

export interface SourceOfferRepository extends SourceRepositoryDefinition {
  sourceUrl: string | null;
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

interface ApiReleaseResponse {
  data: {
    version: string;
    source_url: string;
  };
}

type SourceOfferFetch = typeof fetch;

function getFallbackSourceOffer(): LoadedSourceOffer {
  return {
    mode: "fallback",
    repositories: SOURCE_REPOSITORY_DEFINITIONS.filter(
      (repository) => repository.id !== "android"
    ).map((repository) => ({
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

function parseApiReleaseResponse(value: unknown): ApiReleaseResponse | null {
  if (!isObjectRecord(value) || !isObjectRecord(value.data)) {
    return null;
  }

  const version = String(value.data.version ?? "").trim();
  const sourceUrl = String(value.data.source_url ?? "").trim();

  if (version === "" || !isSafeHttpUrl(sourceUrl)) {
    return null;
  }

  return {
    data: {
      version,
      source_url: sourceUrl,
    },
  };
}

function resolveSourceOffer(options: {
  apiRelease: ApiReleaseResponse | null;
  manifest: SourceOfferManifest | null;
}): LoadedSourceOffer {
  const repositories = SOURCE_REPOSITORY_DEFINITIONS.filter((repository) => {
    if (repository.id === "android") {
      return options.manifest?.repositories.android !== undefined;
    }

    return true;
  }).map((repository) => {
    if (repository.id === "api") {
      return {
        ...repository,
        sourceUrl: options.apiRelease?.data.source_url ?? null,
      };
    }

    return {
      ...repository,
      sourceUrl:
        options.manifest?.repositories[repository.id]?.sourceUrl ?? null,
    };
  });

  const hasPublishedSourceRelease = repositories.some(
    (repository) => repository.sourceUrl !== null
  );

  const mode = hasPublishedSourceRelease ? "deployment" : "fallback";

  return {
    mode,
    repositories:
      mode === "deployment"
        ? repositories
        : repositories.map((repository) => ({
            ...repository,
            sourceUrl: repository.repositoryUrl,
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
    const requestInit = {
      cache: "no-store" as const,
      credentials: "omit" as const,
      headers: {
        accept: "application/json",
      },
    };

    const [manifestResult, apiReleaseResult] = await Promise.allSettled([
      fetchImplementation(SOURCE_OFFER_URL, requestInit),
      fetchImplementation(API_RELEASE_URL, requestInit),
    ]);

    const manifestResponse =
      manifestResult.status === "fulfilled" ? manifestResult.value : null;
    const apiReleaseResponse =
      apiReleaseResult.status === "fulfilled" ? apiReleaseResult.value : null;

    let manifest: SourceOfferManifest | null = null;
    if (manifestResponse?.ok) {
      try {
        manifest = parseSourceOfferManifest(await manifestResult.value.json());
      } catch {
        manifest = null;
      }
    }

    let apiRelease: ApiReleaseResponse | null = null;
    if (apiReleaseResponse?.ok) {
      try {
        apiRelease = parseApiReleaseResponse(
          await apiReleaseResult.value.json()
        );
      } catch {
        apiRelease = null;
      }
    }

    return resolveSourceOffer({
      apiRelease,
      manifest,
    });
  } catch {
    return getFallbackSourceOffer();
  }
}

export function getFallbackSourceRepositories(): SourceOfferRepository[] {
  return getFallbackSourceOffer().repositories;
}
