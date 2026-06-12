// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { forwardRef } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from "react-router-dom";
import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  square?: boolean;
  initials?: string;
  alt?: string;
  className?: string;
};

export function Avatar({
  src = null,
  square = false,
  initials,
  alt = "",
  className,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="avatar"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center align-middle text-sm font-medium uppercase leading-none outline -outline-offset-1 outline-black/10 dark:outline-white/10",
        square ? "rounded-[20%]" : "rounded-full",
        className
      )}
    >
      {src ? (
        <img
          className={cn(
            "size-full object-cover",
            square ? "rounded-[20%]" : "rounded-full"
          )}
          src={src}
          alt={alt}
        />
      ) : (
        <span aria-hidden={alt ? undefined : "true"} title={alt || undefined}>
          {initials}
        </span>
      )}
    </span>
  );
}

type AvatarButtonProps = AvatarProps &
  (
    | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string } & Omit<RouterLinkProps, "to" | "className">)
  );

export const AvatarButton = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  AvatarButtonProps
>(function AvatarButton(
  { src, square = false, initials, alt, className, ...props },
  ref
) {
  const classes = cn(
    "relative inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
    square ? "rounded-[20%]" : "rounded-full",
    className
  );

  const avatar = (
    <Avatar src={src} square={square} initials={initials} alt={alt} />
  );

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <RouterLink
        {...linkProps}
        to={href}
        className={classes}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
      >
        {avatar}
      </RouterLink>
    );
  }

  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
    >
      {avatar}
    </button>
  );
});
