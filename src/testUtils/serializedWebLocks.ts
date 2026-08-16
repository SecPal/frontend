// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export function installSerializedWebLocks(): () => void {
  const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "locks"
  );
  let previousLock = Promise.resolve();

  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async <T>(
        name: string,
        options: LockOptions,
        callback: (lock: Lock) => T | PromiseLike<T>
      ): Promise<T> => {
        const result = previousLock.then(() =>
          callback({ name, mode: options.mode ?? "exclusive" } as Lock)
        );
        previousLock = result.then(
          () => undefined,
          () => undefined
        );

        return result;
      },
    },
  });

  return () => {
    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, "locks", originalLocksDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "locks");
    }
  };
}
