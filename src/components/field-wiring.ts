// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Children,
  cloneElement,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

type FieldChildProps = {
  id?: string;
  htmlFor?: string;
  children?: ReactNode;
};

function isElementOfType(
  child: ReactNode,
  type: ElementType
): child is ReactElement<FieldChildProps> {
  return isValidElement<FieldChildProps>(child) && child.type === type;
}

export function wireFieldChildren({
  children,
  generatedId,
  labelType,
  helperTypes,
  controlType,
}: {
  children: ReactNode;
  generatedId: string;
  labelType: ElementType;
  helperTypes: readonly ElementType[];
  /** Explicit control type for reliable ID injection when the control is not a
   * direct child alongside helpers (e.g. wrapped in a layout div). When
   * provided, the first child matching this type is used as the control;
   * otherwise falls back to the first non-helper child. */
  controlType?: ElementType;
}) {
  const childArray = Children.toArray(children);
  const label = childArray.find((child) => isElementOfType(child, labelType));

  if (!label || label.props.htmlFor) {
    return children;
  }

  const control = (
    controlType
      ? childArray.find((child) => isElementOfType(child, controlType))
      : childArray.find(
          (child) =>
            isValidElement<FieldChildProps>(child) &&
            !helperTypes.some((helperType) => isElementOfType(child, helperType))
        )
  ) as ReactElement<FieldChildProps> | undefined;

  if (!control) {
    return children;
  }

  const controlId = control.props.id ?? generatedId;

  return childArray.map((child) => {
    if (child === label) {
      return cloneElement(child as ReactElement<FieldChildProps>, {
        htmlFor: controlId,
      });
    }

    if (child === control && !control.props.id) {
      return cloneElement(child as ReactElement<FieldChildProps>, {
        id: controlId,
      });
    }

    return child;
  });
}
