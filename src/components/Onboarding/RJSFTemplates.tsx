// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  FieldTemplateProps,
  ArrayFieldTemplateProps,
  ObjectFieldTemplateProps,
  WidgetProps,
} from "@rjsf/utils";
import { Field, Label, Description, ErrorMessage } from "../fieldset";
import { Input } from "../input";
import { Select } from "../select";
import { Button } from "../button";
import { Trans } from "@lingui/macro";

/**
 * Custom Field Template using Catalyst components
 */
export function FieldTemplate(props: FieldTemplateProps) {
  const {
    label,
    required,
    description,
    errors,
    help,
    children,
    hidden,
    schema,
  } = props;

  if (hidden) {
    return <div className="hidden">{children}</div>;
  }

  // Don't render wrapper for object/array fields
  if (schema.type === "object" || schema.type === "array") {
    return <div className="space-y-6">{children}</div>;
  }

  return (
    <Field>
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </Label>
      )}
      {description && <Description>{description}</Description>}
      {children}
      {errors && <ErrorMessage>{errors}</ErrorMessage>}
      {help && <Description>{help}</Description>}
    </Field>
  );
}

/**
 * Custom Text Input Widget using Catalyst Input
 */
export function TextWidget(props: WidgetProps) {
  const {
    id,
    value,
    required,
    disabled,
    readonly,
    onChange,
    onBlur,
    onFocus,
    placeholder,
    schema,
  } = props;

  const inputType =
    schema.format === "email"
      ? "email"
      : schema.format === "uri"
        ? "url"
        : "text";

  return (
    <Input
      id={id}
      type={inputType}
      value={value || ""}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.value || undefined)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      placeholder={placeholder}
    />
  );
}

/**
 * Custom Select Widget using Catalyst Select
 */
export function SelectWidget(props: WidgetProps) {
  const {
    id,
    value,
    required,
    disabled,
    readonly,
    onChange,
    onBlur,
    onFocus,
    options,
    placeholder,
  } = props;

  const { enumOptions } = options;

  return (
    <Select
      id={id}
      value={value || ""}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) => onChange(e.target.value || undefined)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {enumOptions?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Custom Array Field Template with proper spacing
 */
export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { title, items, canAdd, onAddClick } = props;

  return (
    <div className="space-y-4">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <div className="space-y-4">
        {items.map((element) => {
          const itemProps = element as unknown as {
            key: string;
            children: React.ReactNode;
            hasRemove: boolean;
            onDropIndexClick: (index: number) => (event?: unknown) => void;
            index: number;
          };
          return (
            <div
              key={itemProps.key}
              className="flex gap-2 items-start border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
            >
              <div className="flex-1">{itemProps.children}</div>
              {itemProps.hasRemove && (
                <Button
                  type="button"
                  onClick={itemProps.onDropIndexClick(itemProps.index)}
                  color="red"
                  className="mt-8"
                >
                  <Trans>Remove</Trans>
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {canAdd && (
        <Button type="button" onClick={onAddClick}>
          <Trans>Add Item</Trans>
        </Button>
      )}
    </div>
  );
}

/**
 * Custom Object Field Template with proper spacing
 */
export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { title, description, properties } = props;

  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
          {description && (
            <Description className="mt-2">{description}</Description>
          )}
        </div>
      )}
      <div className="space-y-6">
        {properties.map((element) => (
          <div key={element.name}>{element.content}</div>
        ))}
      </div>
    </div>
  );
}
