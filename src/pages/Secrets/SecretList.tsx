// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useMemo } from "react";
import { Trans, t } from "@lingui/macro";
import { useSecretsWithOffline } from "../../hooks/useSecretsWithOffline";
import { SecretCard } from "./SecretCard";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { OfflineDataBanner } from "../../components/OfflineDataBanner";

// Expiring soon threshold (shared constant)
const EXPIRING_SOON_DAYS = 7;
const EXPIRING_SOON_MS = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

type ViewMode = "grid" | "list";
type ExpirationFilter = "all" | "expired" | "expiring_soon" | "no_expiration";

/**
 * Secret List Page
 *
 * Displays all user's secrets with search, filter, and pagination.
 * Supports offline-first data fetching with automatic cache fallback.
 */
export function SecretList() {
  // Offline-first data fetching
  const { secrets, loading, error, isOffline, isStale, lastSynced, refresh } =
    useSecretsWithOffline();

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [expirationFilter, setExpirationFilter] =
    useState<ExpirationFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("secretViewMode") as ViewMode) || "grid";
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Extract unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    secrets.forEach((secret) => {
      secret.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [secrets]);

  // Filter secrets
  const filteredSecrets = useMemo(() => {
    return secrets.filter((secret) => {
      // Search filter (title only for Phase 1)
      if (
        searchQuery &&
        !secret.title.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      // Tag filter
      if (selectedTag !== "all" && !secret.tags?.includes(selectedTag)) {
        return false;
      }

      // Expiration filter
      if (expirationFilter !== "all") {
        const now = new Date();
        const expires = secret.expires_at ? new Date(secret.expires_at) : null;

        if (expirationFilter === "expired") {
          if (!expires || expires >= now) return false;
        } else if (expirationFilter === "expiring_soon") {
          const sevenDaysFromNow = new Date(now.getTime() + EXPIRING_SOON_MS);
          if (!expires || expires < now || expires > sevenDaysFromNow)
            return false;
        } else if (expirationFilter === "no_expiration") {
          if (expires) return false;
        }
      }

      return true;
    });
  }, [secrets, searchQuery, selectedTag, expirationFilter]);

  // Paginate
  const paginatedSecrets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSecrets.slice(startIndex, endIndex);
  }, [filteredSecrets, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSecrets.length / itemsPerPage);

  // Save view mode preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("secretViewMode", mode);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔄</div>
          <Text>
            <Trans>Loading secrets...</Trans>
          </Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <Heading level={3} className="text-red-900 dark:text-red-400">
            <Trans>Error Loading Secrets</Trans>
          </Heading>
          <Text className="mt-2 text-red-700 dark:text-red-500">{error}</Text>
          {!isOffline && (
            <Button onClick={refresh} className="mt-4" outline>
              <Trans>Try Again</Trans>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Offline/Stale Data Banner */}
      <OfflineDataBanner
        isOffline={isOffline}
        isStale={isStale}
        lastSynced={lastSynced}
        onRefresh={refresh}
      />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>
            <Trans>Secrets</Trans>
          </Heading>
          <Text className="mt-2">
            <Trans>
              Manage your secrets and sensitive information securely.
            </Trans>
          </Text>
        </div>
        <Button href="/secrets/new">
          <Trans>New Secret</Trans>
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="min-w-[200px] flex-1">
          <Input
            type="text"
            placeholder={t`Search secrets...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            aria-label={t`Search secrets`}
          />
        </div>

        {/* Tag Filter */}
        <Select
          value={selectedTag}
          onChange={(e) => {
            setSelectedTag(e.target.value);
            setCurrentPage(1);
          }}
          aria-label={t`Filter by tag`}
        >
          <option value="all">{t`All Tags`}</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </Select>

        {/* Expiration Filter */}
        <Select
          value={expirationFilter}
          onChange={(e) => {
            setExpirationFilter(e.target.value as ExpirationFilter);
            setCurrentPage(1);
          }}
          aria-label={t`Filter by expiration`}
        >
          <option value="all">{t`All`}</option>
          <option value="expired">{t`Expired`}</option>
          <option value="expiring_soon">{t`Expiring Soon`}</option>
          <option value="no_expiration">{t`No Expiration`}</option>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => handleViewModeChange("grid")}
            className={`rounded-l-lg px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "grid"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
            aria-label={t`Grid view`}
          >
            <Trans>Grid</Trans>
          </button>
          <button
            onClick={() => handleViewModeChange("list")}
            className={`rounded-r-lg px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "list"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
            aria-label={t`List view`}
          >
            <Trans>List</Trans>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        {/* Empty State */}
        {filteredSecrets.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <div className="mb-4 text-6xl">🔒</div>
            <Heading level={3}>
              {secrets.length === 0 ? (
                <Trans>No secrets yet</Trans>
              ) : (
                <Trans>No secrets found</Trans>
              )}
            </Heading>
            <Text className="mt-2">
              {secrets.length === 0 ? (
                <Trans>Create your first secret to get started</Trans>
              ) : (
                <Trans>Try adjusting your filters</Trans>
              )}
            </Text>
            {secrets.length === 0 && (
              <div className="mt-6">
                <Button href="/secrets/new">
                  <Trans>Create Secret</Trans>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Secret Grid/List */}
        {filteredSecrets.length > 0 && (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  : "flex flex-col gap-4"
              }
            >
              {paginatedSecrets.map((secret) => (
                <SecretCard key={secret.id} secret={secret} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  outline
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  ←
                </Button>

                {/* Pagination with ellipsis for large datasets */}
                {(() => {
                  const maxVisible = 7;
                  const pages: (number | string)[] = [];

                  if (totalPages <= maxVisible) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    const leftBound = Math.max(2, currentPage - 1);
                    const rightBound = Math.min(
                      totalPages - 1,
                      currentPage + 1
                    );
                    if (leftBound > 2) pages.push("...");
                    for (let i = leftBound; i <= rightBound; i++) {
                      pages.push(i);
                    }
                    if (rightBound < totalPages - 1) pages.push("...");
                    pages.push(totalPages);
                  }

                  return pages.map((page, idx) =>
                    typeof page === "number" ? (
                      currentPage === page ? (
                        <Button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          color="dark/zinc"
                          aria-label={`Page ${page}`}
                          aria-current="page"
                        >
                          {page}
                        </Button>
                      ) : (
                        <Button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          outline
                          aria-label={`Page ${page}`}
                        >
                          {page}
                        </Button>
                      )
                    ) : (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 py-2 text-sm text-zinc-500"
                        aria-hidden="true"
                      >
                        {page}
                      </span>
                    )
                  );
                })()}

                <Button
                  outline
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  →
                </Button>
              </div>
            )}

            {/* Results Count */}
            <Text className="mt-4 text-center">
              <Trans>
                Page {currentPage} of {totalPages} ({filteredSecrets.length}{" "}
                {filteredSecrets.length === 1 ? "secret" : "secrets"})
              </Trans>
            </Text>
          </>
        )}
      </div>
    </>
  );
}

export default SecretList;
