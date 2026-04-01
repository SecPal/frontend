// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Text } from "./text";

interface MfaQrCodeProps {
  value: string;
  alt: string;
}

interface QrState {
  value: string;
  dataUrl: string | null;
  hasError: boolean;
}

export function MfaQrCode({ value, alt }: MfaQrCodeProps) {
  const [qrState, setQrState] = useState<QrState>({
    value: "",
    dataUrl: null,
    hasError: false,
  });

  useEffect(() => {
    let isActive = true;

    void QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 192,
    })
      .then((svgMarkup: string) => {
        if (!isActive) {
          return;
        }

        setQrState({
          value,
          dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`,
          hasError: false,
        });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setQrState({
          value,
          dataUrl: null,
          hasError: true,
        });
      });

    return () => {
      isActive = false;
    };
  }, [value]);

  if (qrState.value === value && qrState.hasError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <Text className="text-sm text-amber-800 dark:text-amber-200">
          QR code generation is unavailable in this browser. Use the manual
          setup key below.
        </Text>
      </div>
    );
  }

  if (qrState.value !== value || !qrState.dataUrl) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          Generating QR code...
        </Text>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <img
        src={qrState.dataUrl}
        alt={alt}
        className="mx-auto size-48 max-w-full"
        loading="lazy"
      />
    </div>
  );
}
