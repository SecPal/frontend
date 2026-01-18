// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Translation map for JSON Schema field labels and descriptions
 * 
 * This is a temporary solution until the backend provides localized schemas.
 * Maps English schema keys/labels to German translations.
 */
export const schemaTranslations: Record<string, string> = {
  // Common fields
  "Gender": "Geschlecht",
  "Birth Name": "Geburtsname",
  "Previous Names": "Frühere Namen",
  "Nationalities": "Staatsangehörigkeiten",
  "Intended Activities (§ 34a GewO)": "Beabsichtigte Tätigkeiten (§ 34a GewO)",
  
  // Gender options
  "male": "Männlich",
  "female": "Weiblich",
  "diverse": "Divers",
  
  // Common labels
  "Add Item": "Feld hinzufügen",
  "Remove": "Entfernen",
  
  // Descriptions
  "BewachV § 16 required information for Bewacherregister": "BewachV § 16 erforderliche Informationen für das Bewacherregister",
  "BewachV § 16 required information": "BewachV § 16 erforderliche Informationen",
};

/**
 * Translates a schema label/title to German if available
 */
export function translateSchemaLabel(label: string): string {
  return schemaTranslations[label] || label;
}
