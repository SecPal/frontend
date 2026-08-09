// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export async function awaitAbortable<T>(
  operation: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  signal?.throwIfAborted();

  if (!signal) {
    return operation;
  }

  return await new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    const settle =
      <TResult>(callback: (result: TResult) => void) =>
      (result: TResult) => {
        signal.removeEventListener("abort", abort);
        callback(result);
      };

    signal.addEventListener("abort", abort, { once: true });
    operation.then(settle(resolve), settle(reject));
  });
}
