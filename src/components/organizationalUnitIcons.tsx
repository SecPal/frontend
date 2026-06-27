// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Building2, Home, MapPin, Users } from "lucide-react";
import type { OrganizationalUnitType } from "@/types/organizational";

function getOrganizationalUnitIconClassName(
  type: OrganizationalUnitType,
  className: string
) {
  switch (type) {
    case "holding":
    case "company":
      return `${className} text-blue-500`;
    case "department":
    case "division":
      return `${className} text-green-500`;
    case "branch":
      return `${className} text-purple-500`;
    case "region":
      return `${className} text-orange-500`;
    default:
      return `${className} text-gray-500`;
  }
}

export interface OrganizationalUnitTypeIconProps {
  type: OrganizationalUnitType;
  className?: string;
  slot?: string;
}

export function OrganizationalUnitTypeIcon({
  type,
  className = "h-4 w-4",
  slot = "icon",
}: OrganizationalUnitTypeIconProps) {
  const iconClassName = getOrganizationalUnitIconClassName(type, className);

  switch (type) {
    case "department":
    case "division":
      return (
        <Users aria-hidden="true" className={iconClassName} data-slot={slot} />
      );
    case "region":
      return (
        <MapPin aria-hidden="true" className={iconClassName} data-slot={slot} />
      );
    default:
      return (
        <Building2
          aria-hidden="true"
          className={iconClassName}
          data-slot={slot}
        />
      );
  }
}

export interface OrganizationalUnitRootIconProps {
  className?: string;
  slot?: string;
}

export function OrganizationalUnitRootIcon({
  className = "h-4 w-4",
  slot = "icon",
}: OrganizationalUnitRootIconProps) {
  return (
    <Home
      aria-hidden="true"
      className={`${className} text-gray-400`}
      data-slot={slot}
    />
  );
}
