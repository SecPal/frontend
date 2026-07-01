// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  ArrowLeft,
  ExternalLink,
  FileCode2,
  FolderGit2,
  Scale,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
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
    name: "SecPal/frontend",
    description: msg`React/TypeScript frontend for the running SecPal web application.`,
    href: "https://github.com/SecPal/frontend",
  },
  {
    name: "SecPal/api",
    description: msg`Laravel backend used by SecPal deployments for API and business logic.`,
    href: "https://github.com/SecPal/api",
  },
  {
    name: "SecPal/contracts",
    description: msg`Shared OpenAPI contracts and interface definitions used across SecPal components.`,
    href: "https://github.com/SecPal/contracts",
  },
  {
    name: "SecPal/android",
    description: msg`Android Capacitor wrapper that reuses the shared frontend build and adds native Android-specific code.`,
    href: "https://github.com/SecPal/android",
  },
] as const;

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

  return (
    <main className="min-h-[var(--app-shell-min-height)] bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 pt-[calc(1.5rem+var(--app-safe-area-inset-top))] pb-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
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
                    SecPal is licensed under the GNU Affero General Public
                    License, version 3 or any later version. If you use this
                    service over a network, you may obtain the corresponding
                    source code for the SecPal components made available through
                    this service at no charge from the repositories linked
                    below.
                  </Trans>
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
                    These repositories contain the preferred form for making
                    modifications to the SecPal components made available
                    through this service.
                  </Trans>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SOURCE_REPOSITORIES.map((repository) => (
                  <article
                    key={repository.href}
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
                    <a
                      href={repository.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary decoration-border mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-primary/80"
                    >
                      <FileCode2 className="size-4" aria-hidden="true" />
                      <span>{repository.href}</span>
                    </a>
                  </article>
                ))}
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
                  <Trans>Copyright SecPal and contributors.</Trans>
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
                    <Trans>Project license files</Trans>
                  </h3>
                  <div className="space-y-2">
                    {SOURCE_REPOSITORIES.map((repository) => (
                      <a
                        key={`${repository.href}/blob/main/LICENSE`}
                        href={`${repository.href}/blob/main/LICENSE`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-border text-foreground hover:bg-muted flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium"
                      >
                        <span>{repository.name} LICENSE</span>
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>

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
    </main>
  );
}

export default SourcePage;
