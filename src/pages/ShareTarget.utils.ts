// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Handles Share Target API messages from the Service Worker.
 * Extracted as a pure function for testability.
 *
 * @param event - MessageEvent from Service Worker
 * @param shareId - Current session's share ID (from URL param)
 * @param loadSharedData - Callback to reload shared data after files are received
 * @param setErrors - Callback to update error state
 */
export function handleShareTargetMessage(
  event: MessageEvent,
  shareId: string | null,
  loadSharedData: () => void,
  setErrors: (errors: string[] | ((prev: string[]) => string[])) => void
): void {
  if (!event.data) return;

  const { type, shareId: messageShareId } = event.data;

  if (type === "SHARE_TARGET_FILES") {
    // Verify shareId matches to prevent cross-session contamination
    if (shareId && messageShareId && shareId !== messageShareId) {
      console.warn(
        `Share ID mismatch: expected ${shareId}, got ${messageShareId}`
      );
      return;
    }

    // Store files in sessionStorage so they persist across reloads
    sessionStorage.setItem(
      "share-target-files",
      JSON.stringify(event.data.files)
    );

    // Trigger reload of shared data
    loadSharedData();
  } else if (type === "SHARE_TARGET_ERROR") {
    const error = event.data.error || "Unknown error";

    // Only add error if shareId matches (or if no shareId provided)
    if (!shareId || !messageShareId || shareId === messageShareId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErrors((prev: any) => [...prev, error]);
    }
  }
}
