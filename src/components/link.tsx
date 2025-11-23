// SPDX-FileCopyrightText: Tailwind Labs Inc.
// SPDX-License-Identifier: LicenseRef-TailwindPlus

import * as Headless from "@headlessui/react";
import React, { forwardRef } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from "react-router-dom";

export const Link = forwardRef(function Link(
  props: { href: string } & Omit<RouterLinkProps, "to">,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return (
    <Headless.DataInteractive>
      <RouterLink {...props} to={props.href} ref={ref} />
    </Headless.DataInteractive>
  );
});
