// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface OnboardingRouteState {
  onboardingRequired?: boolean;
  message?: string;
  returnTo?: string;
}

export function sanitizeOnboardingReturnTarget(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("//")) {
    return null;
  }

  return value;
}

export function getEntryOnboardingRouteState(
  routeState: OnboardingRouteState | null
): OnboardingRouteState | null {
  if (!routeState) {
    return null;
  }

  const entryState: OnboardingRouteState = {};

  if (routeState.onboardingRequired === true) {
    entryState.onboardingRequired = true;
  }

  if (typeof routeState.message === "string") {
    const trimmedMessage = routeState.message.trim();
    if (trimmedMessage.length > 0) {
      entryState.message = trimmedMessage;
    }
  }

  const returnTo = sanitizeOnboardingReturnTarget(routeState.returnTo);
  if (returnTo) {
    entryState.returnTo = returnTo;
  }

  return Object.keys(entryState).length > 0 ? entryState : null;
}

export function getPersistentOnboardingNavigationState(
  routeState: OnboardingRouteState | null
): Pick<OnboardingRouteState, "returnTo"> | null {
  const returnTo = sanitizeOnboardingReturnTarget(routeState?.returnTo);

  return returnTo ? { returnTo } : null;
}

export function hasNormalizedOnboardingNavigationState(
  routeState: OnboardingRouteState
): boolean {
  const persistentState = getPersistentOnboardingNavigationState(routeState);

  if (!persistentState) {
    return false;
  }

  const keys = Object.keys(routeState);

  return (
    keys.length === 1 &&
    keys[0] === "returnTo" &&
    routeState.returnTo === persistentState.returnTo
  );
}
