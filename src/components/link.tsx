// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from "react-router-dom";

export const Link = forwardRef(function Link(
  props: { href: string } & Omit<RouterLinkProps, "to">,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, ...linkProps } = props;
  return <RouterLink {...linkProps} to={href} ref={ref} />;
});
