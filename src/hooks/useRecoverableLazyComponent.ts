// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, type ComponentType } from "react";

interface LazyComponentModule<TProps> {
  default: ComponentType<TProps>;
}

export function useRecoverableLazyComponent<TProps>(
  loader: () => Promise<LazyComponentModule<TProps>>
) {
  const [Component, setComponent] = useState<ComponentType<TProps> | null>(
    null
  );
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);
    setIsLoading(true);

    void loader()
      .then((module) => {
        if (cancelled) {
          return;
        }

        setComponent(() => module.default);
        setIsLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(loadError);
        setIsLoading(false);
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
      setRetryKey((currentKey) => currentKey + 1);
    },
  };
}
