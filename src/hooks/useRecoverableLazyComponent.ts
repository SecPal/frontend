// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, type ComponentType } from "react";

interface LazyComponentModule<TProps> {
  default: ComponentType<TProps>;
}

export function useRecoverableLazyComponent<TProps>(
  loader: () => Promise<LazyComponentModule<TProps>>
) {
  const [state, setState] = useState<{
    Component: ComponentType<TProps> | null;
    error: unknown;
    retryKey: number;
  }>(() => ({
    Component: null,
    error: null,
    retryKey: 0,
  }));
  const { Component, error, retryKey } = state;
  const isLoading = Component === null && error === null;

  useEffect(() => {
    let cancelled = false;

    void loader()
      .then((module) => {
        if (cancelled) {
          return;
        }

        setState((currentState) => {
          if (currentState.retryKey !== retryKey) {
            return currentState;
          }

          return {
            Component: module.default,
            error: null,
            retryKey,
          };
        });
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setState((currentState) => {
          if (currentState.retryKey !== retryKey) {
            return currentState;
          }

          return {
            Component: null,
            error: loadError,
            retryKey,
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [loader, retryKey]);

  return {
    Component,
    error,
    isLoading,
    retry: () => {
      setState((currentState) => ({
        Component: null,
        error: null,
        retryKey: currentState.retryKey + 1,
      }));
    },
  };
}
