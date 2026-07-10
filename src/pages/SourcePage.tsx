// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileCode2,
  FolderGit2,
  Scale,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Footer } from "@/components/Footer";
import {
  LoginLanguageSwitcher,
  LoginLegalMenu,
} from "@/components/LoginLegalMenu";
import { Logo } from "@/components/Logo";
import {
  getFallbackSourceRepositories,
  loadSourceOffer,
  type LoadedSourceOffer,
  type SourceOfferRepository,
} from "@/lib/sourceOffer";
import { buttonVariants } from "@/ui/styles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui";

const SOURCE_REPOSITORIES = [
  {
    id: "frontend",
    name: "SecPal/frontend",
    description: msg`React/TypeScript frontend for the running SecPal web application.`,
  },
  {
    id: "api",
    name: "SecPal/api",
    description: msg`Laravel backend used by SecPal deployments for API and business logic.`,
  },
  {
    id: "contracts",
    name: "SecPal/contracts",
    description: msg`Shared OpenAPI contracts and interface definitions used across SecPal components.`,
  },
  {
    id: "android",
    name: "SecPal/android",
    description: msg`Android Capacitor wrapper that reuses the shared frontend build and adds native Android-specific code.`,
  },
] as const;

const SOURCE_REPOSITORY_DISPLAY_ORDER: readonly (typeof SOURCE_REPOSITORIES)[number]["id"][] =
  ["android", "frontend", "api", "contracts"] as const;

function getSourceReturnTo(state: unknown): string | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const sourceReturnTo = (state as { sourceReturnTo?: unknown }).sourceReturnTo;

  if (
    typeof sourceReturnTo !== "string" ||
    !sourceReturnTo.startsWith("/") ||
    sourceReturnTo.startsWith("//")
  ) {
    return null;
  }

  const [pathname] = sourceReturnTo.split(/[?#]/, 1);

  if (pathname === "/source" || pathname === "/source/") {
    return null;
  }

  return sourceReturnTo;
}

export function SourcePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { _ } = useLingui();
  const location = useLocation();
  const [sourceOffer, setSourceOffer] = useState<LoadedSourceOffer | null>(
    null
  );
  const sourceReturnTo = getSourceReturnTo(location.state);
  const showAuthenticatedReturn = isAuthenticated || isLoading;
  const secondaryActionHref = showAuthenticatedReturn
    ? (sourceReturnTo ?? "/")
    : "/login";
  const secondaryActionLabel = showAuthenticatedReturn ? (
    <Trans>Back</Trans>
  ) : (
    <Trans>Back to login</Trans>
  );

  useEffect(() => {
    let isActive = true;

    void loadSourceOffer(globalThis.fetch, (partialResult) => {
      if (!isActive) {
        return;
      }

      setSourceOffer(partialResult);
    }).then((result) => {
      if (!isActive) {
        return;
      }

      setSourceOffer(result);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const repositories: SourceOfferRepository[] =
    sourceOffer?.repositories ?? getFallbackSourceRepositories();
  const sourceOfferMode = sourceOffer?.mode;
  const deploymentHasFallbackRepositoryLinks =
    sourceOfferMode === "deployment" &&
    repositories.some((repository) => repository.sourceUrl === null);

  return (
    <main className="min-h-[var(--app-shell-min-height)] bg-background text-foreground">
      <div className="px-4 pt-[calc(1.5rem+var(--app-safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <LoginLegalMenu sourceReturnTo={sourceReturnTo ?? undefined} />
          <LoginLanguageSwitcher />
        </div>
        <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="32" className="shrink-0" />
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
                SecPal
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                <Trans>AGPL v3+</Trans>
              </h1>
            </div>
          </div>
          <Link
            to={secondaryActionHref}
            className={buttonVariants({
              variant: "outline",
              className: "shrink-0 rounded-xl",
            })}
          >
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {secondaryActionLabel}
            </span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
          <section className="space-y-6">
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl tracking-tight">
                  <Trans>Source code and license</Trans>
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  <Trans>
                    Source offer for users interacting with SecPal over a
                    network.
                  </Trans>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-muted-foreground max-w-3xl text-sm leading-7 sm:text-base">
                  <Trans>
                    SecPal is licensed under AGPL-3.0-or-later with additional
                    SecPal attribution terms. If you use this service over a
                    network, you may obtain the corresponding source code for
                    the SecPal components made available through this service at
                    no charge from the links below.
                  </Trans>
                </p>
                <p className="text-muted-foreground max-w-3xl text-sm leading-6">
                  {sourceOfferMode === "deployment" ? (
                    deploymentHasFallbackRepositoryLinks ? (
                      <Trans>
                        Published source release links shown below are
                        immutable. Components without a published source release
                        remain linked to their public repositories.
                      </Trans>
                    ) : (
                      <Trans>
                        The source release links shown below point to the
                        immutable corresponding source published for this
                        deployment.
                      </Trans>
                    )
                  ) : sourceOfferMode === "fallback" ? (
                    <Trans>
                      If this deployment does not publish source releases here,
                      the project repositories below remain linked as the
                      preferred form for making modifications.
                    </Trans>
                  ) : null}
                </p>

                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://www.gnu.org/licenses/agpl-3.0.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      className: "rounded-xl",
                    })}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Scale className="size-4" aria-hidden="true" />
                      <Trans>Read the AGPL v3 license</Trans>
                    </span>
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card
              aria-labelledby="source-repositories-heading"
              className="rounded-2xl border-border bg-card shadow-sm"
            >
              <CardHeader>
                <CardTitle
                  id="source-repositories-heading"
                  className="text-xl tracking-tight"
                >
                  <Trans>Corresponding source repositories</Trans>
                </CardTitle>
                <CardDescription className="max-w-2xl leading-6">
                  <Trans>
                    These links identify the preferred form for making
                    modifications to the SecPal components made available
                    through this service.
                  </Trans>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {repositories.length > 0 &&
                  SOURCE_REPOSITORY_DISPLAY_ORDER.map((repositoryId) =>
                    SOURCE_REPOSITORIES.find(
                      (repository) => repository.id === repositoryId
                    )
                  )
                    .filter(
                      (
                        repository
                      ): repository is (typeof SOURCE_REPOSITORIES)[number] =>
                        repository !== undefined &&
                        repositories.some((entry) => entry.id === repository.id)
                    )
                    .map((repository) => {
                      const sourceOfferRepository = repositories.find(
                        (entry) => entry.id === repository.id
                      );

                      if (!sourceOfferRepository) {
                        return null;
                      }

                      const showsSeparateRepositoryLink =
                        sourceOfferRepository.sourceUrl !== null &&
                        sourceOfferMode === "deployment" &&
                        sourceOfferRepository.sourceUrl !==
                          sourceOfferRepository.repositoryUrl;

                      return (
                        <article
                          key={repository.id}
                          className="rounded-xl border border-border bg-muted p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <h3 className="text-foreground text-base font-semibold">
                                {repository.name}
                              </h3>
                              <p className="text-muted-foreground text-sm leading-6">
                                {_(repository.description)}
                              </p>
                            </div>
                            <FolderGit2
                              className="text-muted-foreground mt-0.5 size-5 shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="mt-4 space-y-3">
                            {sourceOfferRepository.sourceUrl !== null ? (
                              <a
                                href={sourceOfferRepository.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary decoration-border inline-flex min-w-0 items-start gap-2 text-sm font-medium underline underline-offset-4 hover:text-primary/80"
                              >
                                <FileCode2
                                  className="mt-0.5 size-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 break-all">
                                  {sourceOfferRepository.sourceUrl}
                                </span>
                              </a>
                            ) : null}
                            {showsSeparateRepositoryLink ? (
                              <a
                                href={sourceOfferRepository.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={_(
                                  msg`Open public repository for ${repository.name}`
                                )}
                                className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-foreground"
                              >
                                <span>
                                  <Trans>Open public repository</Trans>
                                </span>
                                <ExternalLink
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : sourceOfferRepository.sourceUrl === null ? (
                              <a
                                href={sourceOfferRepository.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={_(
                                  msg`Open public repository for ${repository.name}`
                                )}
                                className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-foreground"
                              >
                                <span>
                                  <Trans>Open public repository</Trans>
                                </span>
                                <ExternalLink
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card
              aria-labelledby="source-notices-heading"
              className="rounded-2xl border-border shadow-sm"
            >
              <CardHeader>
                <CardTitle
                  id="source-notices-heading"
                  className="text-xl tracking-tight"
                >
                  <Trans>Legal notices</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-6">
                  <Trans>Copyright SecPal Contributors.</Trans>
                </p>
                <p className="text-muted-foreground text-sm leading-6">
                  <Trans>
                    This program is free software: you can redistribute it
                    and/or modify it under the terms of the GNU Affero General
                    Public License as published by the Free Software Foundation,
                    either version 3 of the License, or (at your option) any
                    later version.
                  </Trans>
                </p>
                <p className="text-muted-foreground text-sm leading-6">
                  <Trans>
                    SecPal is licensed under AGPL-3.0-or-later with additional
                    SecPal attribution terms under AGPLv3 section 7(b) and
                    section 7(c). Appropriate legal notices for unmodified
                    SecPal deployments must preserve the attribution notice
                    "Powered by SecPal". Modified versions should use "Based on
                    SecPal" and must not imply endorsement by the SecPal project
                    maintainers.
                  </Trans>
                </p>
                <p className="text-muted-foreground text-sm leading-6">
                  <Trans>
                    The tagline "A guard's best friend" and https://secpal.app
                    are preferred, but they are not required license conditions.
                  </Trans>
                </p>
                <p className="text-muted-foreground text-sm leading-6">
                  <Trans>
                    This program is distributed without any warranty; without
                    even the implied warranty of merchantability or fitness for
                    a particular purpose.
                  </Trans>
                </p>
              </CardContent>
            </Card>

            <Card
              aria-labelledby="source-links-heading"
              className="rounded-2xl border-border shadow-sm"
            >
              <CardHeader>
                <CardTitle
                  id="source-links-heading"
                  className="text-xl tracking-tight"
                >
                  <Trans>Further links</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-[0.12em]">
                    <Trans>Issue tracker</Trans>
                  </h3>
                  <a
                    href="https://github.com/SecPal/frontend/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border text-foreground hover:bg-muted flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium"
                  >
                    <span>
                      <Trans>SecPal/frontend issues</Trans>
                    </span>
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
      <Footer />
    </main>
  );
}

export default SourcePage;
