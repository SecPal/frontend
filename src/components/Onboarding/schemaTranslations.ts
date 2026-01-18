// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/macro";
import { i18n } from "@lingui/core";

/**
 * Translation function for JSON Schema field labels and descriptions
 * 
 * This is a temporary solution until the backend provides localized schemas.
 * Uses Lingui's msg macro for proper i18n integration with Translation.io.
 * 
 * TODO: Backend should send localized schemas based on Accept-Language header
 */

const translations: Record<string, ReturnType<typeof msg>> = {
  // Field labels
  "Gender": msg`Geschlecht`,
  "Birth Name": msg`Geburtsname`,
  "Previous Names": msg`Frühere Namen`,
  "Nationalities": msg`Staatsangehörigkeiten`,
  "Intended Activities (§ 34a GewO)": msg`Beabsichtigte Tätigkeiten (§ 34a GewO)`,
  
  // Gender options
  "male": msg`Männlich`,
  "female": msg`Weiblich`,
  "diverse": msg`Divers`,
  
  // Common actions (these should already be translated via <Trans> in components)
  "Add Item": msg`Feld hinzufügen`,
  "Remove": msg`Entfernen`,
  
  // Descriptions
  "BewachV § 16 required information for Bewacherregister": msg`BewachV § 16 erforderliche Informationen für das Bewacherregister`,
  "BewachV § 16 required information": msg`BewachV § 16 erforderliche Informationen`,
};

/**
 * Translates a schema label/title to the current language if available
 */
export function translateSchemaLabel(label: string): string {
  const msgDescriptor = translations[label];
  if (msgDescriptor) {
    return i18n._(msgDescriptor);
  }
  return label;
}
