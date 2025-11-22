// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useMemo } from "react";
import { fetchSecrets, ApiError, type Secret } from "../../services/secretApi";
import { SecretCard } from "./SecretCard";

type ViewMode = "grid" | "list";
type ExpirationFilter = "all" | "expired" | "expiring_soon" | "no_expiration";

/**
 * Secret List Page
 *
 * Displays all user's secrets with search, filter, and pagination
 */
export function SecretList() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load secrets
  useEffect(() => {
    const loadSecrets = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchSecrets();
        setSecrets(data);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load secrets");
        }
      } finally {
        setLoading(false);
      }
    };

    loadSecrets();
  }, []);

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
          const sevenDaysFromNow = new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000
          );
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔄</div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading secrets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-400">
            Error Loading Secrets
          </h2>
          <p className="text-sm text-red-700 dark:text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Secrets
            </h1>
            <div className="flex gap-2">
              {/* View Mode Toggle */}
              <button
                onClick={() => handleViewModeChange("grid")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "grid"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
                aria-label="Grid view"
              >
                Grid
              </button>
              <button
                onClick={() => handleViewModeChange("list")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
                aria-label="List view"
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm placeholder-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-400 dark:focus:border-white dark:focus:ring-white"
            />

            {/* Tag Filter */}
            <select
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by tag"
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
            >
              <option value="all">Tags: All</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>

            {/* Expiration Filter */}
            <select
              value={expirationFilter}
              onChange={(e) => {
                setExpirationFilter(e.target.value as ExpirationFilter);
                setCurrentPage(1);
              }}
              aria-label="Filter by expiration"
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
            >
              <option value="all">Expires: All</option>
              <option value="expired">Expired</option>
              <option value="expiring_soon">Expiring Soon (7 days)</option>
              <option value="no_expiration">No Expiration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Empty State */}
        {filteredSecrets.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 text-6xl">🔒</div>
            <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              {secrets.length === 0 ? "No secrets yet" : "No secrets found"}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {secrets.length === 0
                ? "Create your first secret to get started"
                : "Try adjusting your filters"}
            </p>
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
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  aria-label="Previous page"
                >
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        currentPage === page
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                          : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      }`}
                      aria-label={`Page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  aria-label="Next page"
                >
                  &gt;
                </button>
              </div>
            )}

            {/* Results Count */}
            <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Page {currentPage} of {totalPages} ({filteredSecrets.length}{" "}
              {filteredSecrets.length === 1 ? "secret" : "secrets"})
            </p>
          </>
        )}
      </div>
    </div>
  );
}
