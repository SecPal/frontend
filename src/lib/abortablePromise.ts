// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

function getAbortReason(signal: AbortSignal): unknown {
  const reason = "reason" in signal ? signal.reason : undefined;

  return reason === undefined
    ? new DOMException("The operation was aborted.", "AbortError")
    : reason;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw getAbortReason(signal);
  }
}

export async function awaitAbortable<T>(
  operation: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal);

  if (!signal) {
    return operation;
  }

  return await new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(getAbortReason(signal));
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
