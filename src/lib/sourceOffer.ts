// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isSafeHttpUrl } from "@/utils/safeUrl";
import { buildApiUrl } from "@/config";
import type { PublicApiReleaseResponse } from "@/types/api";

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

type SourceOfferFetch = typeof fetch;
type SourceOfferUpdateCallback = (result: LoadedSourceOffer) => void;

function normalizeRepositoryUrl(url: string): string {
  const normalizedUrl = new URL(url);

  return `${normalizedUrl.origin}${normalizedUrl.pathname}`.replace(/\/$/, "");
}

function isMutableRepositoryRootUrl(
  sourceUrl: string,
  repositoryDefinition: SourceRepositoryDefinition
): boolean {
  return (
    normalizeRepositoryUrl(sourceUrl) ===
    normalizeRepositoryUrl(repositoryDefinition.repositoryUrl)
  );
}

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
  value: unknown,
  repositoryDefinition: SourceRepositoryDefinition
): SourceOfferManifestRepository | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  if (typeof value.sourceUrl !== "string") {
    return null;
  }

  const sourceUrl = value.sourceUrl.trim();
  if (!isSafeHttpUrl(sourceUrl)) {
    return null;
  }

  if (isMutableRepositoryRootUrl(sourceUrl, repositoryDefinition)) {
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
      repositoriesValue[repository.id],
      repository
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

function parseApiReleaseResponse(
  value: unknown
): PublicApiReleaseResponse | null {
  if (!isObjectRecord(value) || !isObjectRecord(value.data)) {
    return null;
  }

  if (
    typeof value.data.version !== "string" ||
    typeof value.data.source_url !== "string"
  ) {
    return null;
  }

  const version = value.data.version.trim();
  const sourceUrl = value.data.source_url.trim();

  if (version === "" || !isSafeHttpUrl(sourceUrl)) {
    return null;
  }

  const apiRepositoryDefinition = SOURCE_REPOSITORY_DEFINITIONS.find(
    (repository) => repository.id === "api"
  );
  if (
    apiRepositoryDefinition &&
    isMutableRepositoryRootUrl(sourceUrl, apiRepositoryDefinition)
  ) {
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
  apiRelease: PublicApiReleaseResponse | null;
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
  fetchImplementation: SourceOfferFetch = globalThis.fetch,
  onPartialLoad?: SourceOfferUpdateCallback
): Promise<LoadedSourceOffer> {
  if (typeof fetchImplementation !== "function") {
    return getFallbackSourceOffer();
  }

  const requestInit = {
    cache: "no-store" as const,
    credentials: "omit" as const,
    headers: {
      accept: "application/json",
    },
  };

  const manifestResponsePromise = fetchImplementation(
    SOURCE_OFFER_URL,
    requestInit
  ).catch(() => null);
  const apiReleaseResponsePromise = fetchImplementation(
    API_RELEASE_URL,
    requestInit
  ).catch(() => null);

  let manifest: SourceOfferManifest | null = null;
  let apiRelease: PublicApiReleaseResponse | null = null;
  let lastPublishedState: string | null = null;

  const publishPartialOffer = () => {
    if (!onPartialLoad) {
      return;
    }

    const offer = resolveSourceOffer({
      apiRelease,
      manifest,
    });

    if (offer.mode !== "deployment") {
      return;
    }

    const publicationState = JSON.stringify(offer.repositories);
    if (publicationState === lastPublishedState) {
      return;
    }

    lastPublishedState = publicationState;
    onPartialLoad(offer);
  };

  const manifestTask = manifestResponsePromise.then(
    async (manifestResponse) => {
      if (!manifestResponse?.ok) {
        publishPartialOffer();
        return;
      }

      try {
        manifest = parseSourceOfferManifest(await manifestResponse.json());
      } catch {
        manifest = null;
      }

      publishPartialOffer();
    }
  );

  const apiReleaseTask = apiReleaseResponsePromise.then(
    async (apiReleaseResponse) => {
      if (!apiReleaseResponse?.ok) {
        publishPartialOffer();
        return;
      }

      try {
        apiRelease = parseApiReleaseResponse(await apiReleaseResponse.json());
      } catch {
        apiRelease = null;
      }

      publishPartialOffer();
    }
  );

  await Promise.all([manifestTask, apiReleaseTask]);

  return resolveSourceOffer({
    apiRelease,
    manifest,
  });
}

export function getFallbackSourceRepositories(): SourceOfferRepository[] {
  return getFallbackSourceOffer().repositories;
}
