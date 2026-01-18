// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { ReactNode } from "react";
import { Trans } from "@lingui/macro";
import { Button } from "../button";
import {
  FieldTemplate,
  TextWidget,
  PasswordWidget,
  EmailWidget,
  URLWidget,
  DateWidget,
  DateTimeWidget,
  SelectWidget,
  TextareaWidget,
  ArrayFieldTemplate,
  ObjectFieldTemplate,
  TitleField,
  DescriptionField,
} from "./RJSFTemplates";

interface JsonSchemaFormProps {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  formData?: unknown;
  onSubmit: (data: unknown) => void;
  onSaveDraft?: () => void;
  submitLabel?: ReactNode;
  disabled?: boolean;
}

/**
 * JSON Schema Form Wrapper Component
 *
 * Wraps @rjsf/core to provide consistent styling and German translations
 * for onboarding forms based on JSON Schema templates.
 */
export function JsonSchemaForm({
  schema,
  uiSchema,
  formData,
  onSubmit,
  onSaveDraft,
  submitLabel,
  disabled = false,
}: JsonSchemaFormProps) {
  function handleSubmit(data: { formData?: unknown }) {
    if (data.formData) {
      onSubmit(data.formData);
    }
  }

  return (
    <div className="json-schema-form space-y-6">
      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        validator={validator}
        onSubmit={handleSubmit}
        disabled={disabled}
        noHtml5Validate
        templates={{
          FieldTemplate,
          ArrayFieldTemplate,
          ObjectFieldTemplate,
          TitleFieldTemplate: TitleField,
          DescriptionFieldTemplate: DescriptionField,
        }}
        widgets={{
          TextWidget,
          PasswordWidget,
          EmailWidget,
          URLWidget,
          DateWidget,
          DateTimeWidget,
          SelectWidget,
          TextareaWidget,
        }}
      >
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          {onSaveDraft && (
            <Button
              type="button"
              onClick={onSaveDraft}
              outline
              disabled={disabled}
            >
              <Trans>Save Draft</Trans>
            </Button>
          )}
          <Button type="submit" disabled={disabled}>
            {submitLabel || <Trans>Submit</Trans>}
          </Button>
        </div>
      </Form>
    </div>
  );
}
