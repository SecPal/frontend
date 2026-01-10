// SPDX-FileCopyrightText: 2024 Timo Förster <tfoerster@webdad.eu>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Name validation utilities for employee onboarding
 * Implements Levenshtein distance calculation with German umlaut normalization
 */

/**
 * Normalize German characters for similarity comparison
 * Converts ä→ae, ö→oe, ü→ue, ß→ss
 */
function normalizeGermanChars(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0]![j] = j;
  }

  // Fill the dp table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return dp[len1]![len2]!;
}

/**
 * Check if one name is a prefix of another (e.g., "Max" vs "Maximilian")
 */
function isPrefixMatch(str1: string, str2: string): boolean {
  const shorter = str1.length < str2.length ? str1 : str2;
  const longer = str1.length < str2.length ? str2 : str1;
  return longer.startsWith(shorter) && shorter.length >= 3;
}

export type ValidationSeverity = "minor" | "medium" | "major";

export interface NameValidationResult {
  similarity: number;
  severity: ValidationSeverity;
  allowed: boolean;
  message: string;
}

/**
 * Calculate name similarity percentage (0-100)
 * Higher percentage = more similar
 */
export function calculateNameSimilarity(
  oldName: string,
  newName: string
): number {
  if (!oldName || !newName) return 0;

  const old = normalizeGermanChars(oldName.trim());
  const new_ = normalizeGermanChars(newName.trim());

  if (old === new_) return 100;

  // Check for prefix pattern (e.g., Max → Maximilian)
  if (isPrefixMatch(old, new_)) {
    const maxLength = Math.max(old.length, new_.length);
    const minLength = Math.min(old.length, new_.length);
    const lengthRatio = minLength / maxLength;

    // Apply bonus for prefix match, but cap at 90% to still flag as change
    const baseSimilarity = lengthRatio * 100;
    return Math.min(90, baseSimilarity + 30);
  }

  // Calculate Levenshtein-based similarity
  const maxLength = Math.max(old.length, new_.length);
  const distance = levenshteinDistance(old, new_);
  const similarity = Math.max(0, ((maxLength - distance) / maxLength) * 100);

  return Math.round(similarity);
}

/**
 * Validate a name change and determine if it's allowed
 * Returns validation result with severity and message
 */
export function validateNameChange(
  oldName: string,
  newName: string,
  fieldLabel: string
): NameValidationResult {
  const similarity = calculateNameSimilarity(oldName, newName);

  // Tier 1: Minor corrections (>80% similar) - Allow silently
  if (similarity > 80) {
    return {
      similarity,
      severity: "minor",
      allowed: true,
      message: `${fieldLabel} appears to be a minor correction (${similarity}% similar).`,
    };
  }

  // Tier 2: Medium change (50-80% similar) - Allow with HR notification
  if (similarity >= 50) {
    return {
      similarity,
      severity: "medium",
      allowed: true,
      message: `${fieldLabel} has changed significantly (${similarity}% similar). HR will be notified for verification.`,
    };
  }

  // Tier 3: Major change (<50% similar) - Block and require HR intervention
  return {
    similarity,
    severity: "major",
    allowed: false,
    message: `This ${fieldLabel.toLowerCase()} change is too significant (${similarity}% similar). Please contact HR to update your name before completing onboarding.`,
  };
}
