// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import QRCode from "qrcode";
import { Alert, AlertDescription } from "@/ui/alert";

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
      <Alert className="border-amber-500/30 bg-amber-500/10 min-h-48 place-items-center p-4 text-center text-foreground">
        <AlertDescription className="mt-0 text-foreground">
          <Trans>Unable to generate QR code.</Trans>
        </AlertDescription>
      </Alert>
    );
  }

  if (qrState.value !== value || !qrState.dataUrl) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border bg-muted flex min-h-48 items-center justify-center rounded-2xl border p-4"
      >
        <p className="text-muted-foreground text-sm">
          <Trans>Generating QR code...</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <img
        src={qrState.dataUrl}
        alt={alt}
        className="mx-auto size-48 max-w-full"
        loading="lazy"
      />
    </div>
  );
}
