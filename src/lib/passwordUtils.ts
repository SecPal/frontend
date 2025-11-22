// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Password utility functions for generation and strength assessment
 */

/**
 * Generate a secure random password
 *
 * @param length - Password length (default: 16)
 * @param options - Character set options
 * @returns Generated password
 *
 * @example
 * ```ts
 * const password = generatePassword();
 * console.log(password); // e.g., "Xy7#aB2$cD9!eF1@"
 * ```
 */
export function generatePassword(
  length: number = 16,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
  const numberChars = "0123456789";
  const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let charset = "";
  const requiredChars: string[] = [];

  if (uppercase) {
    charset += uppercaseChars;
    const char =
      uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    if (char) requiredChars.push(char);
  }
  if (lowercase) {
    charset += lowercaseChars;
    const char =
      lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    if (char) requiredChars.push(char);
  }
  if (numbers) {
    charset += numberChars;
    const char = numberChars[Math.floor(Math.random() * numberChars.length)];
    if (char) requiredChars.push(char);
  }
  if (symbols) {
    charset += symbolChars;
    const char = symbolChars[Math.floor(Math.random() * symbolChars.length)];
    if (char) requiredChars.push(char);
  }

  if (charset === "") {
    throw new Error("At least one character set must be enabled");
  }

  // Generate remaining characters
  const remainingLength = length - requiredChars.length;
  if (remainingLength < 0) {
    throw new Error(
      "Password length must be at least the number of required character sets"
    );
  }

  const password = [...requiredChars];
  for (let i = 0; i < remainingLength; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    const char = charset[randomIndex];
    if (char) password.push(char);
  }

  // Shuffle the password array
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = password[i];
    const swap = password[j];
    if (temp && swap) {
      password[i] = swap;
      password[j] = temp;
    }
  }

  return password.join("");
}

export type PasswordStrength = "weak" | "medium" | "strong" | "very-strong";

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Assess password strength
 *
 * Checks for:
 * - Length (minimum 8 characters)
 * - Character diversity (uppercase, lowercase, numbers, symbols)
 * - Common patterns (e.g., "12345", "password")
 *
 * @param password - Password to assess
 * @returns Strength assessment
 *
 * @example
 * ```ts
 * const result = assessPasswordStrength("MyP@ssw0rd!");
 * console.log(result.strength); // "strong"
 * console.log(result.score); // 85
 * ```
 */
export function assessPasswordStrength(
  password: string
): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    feedback.push("Password should be at least 8 characters");
  } else if (password.length >= 8 && password.length < 12) {
    score += 20;
  } else if (password.length >= 12 && password.length < 16) {
    score += 30;
  } else {
    score += 40;
  }

  // Character diversity
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSymbols = /[^A-Za-z0-9]/.test(password);

  const diversityCount = [
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSymbols,
  ].filter(Boolean).length;

  if (diversityCount === 1) {
    score += 10;
    feedback.push("Use a mix of uppercase, lowercase, numbers, and symbols");
  } else if (diversityCount === 2) {
    score += 20;
    feedback.push("Add more character types for better security");
  } else if (diversityCount === 3) {
    score += 30;
  } else if (diversityCount === 4) {
    score += 40;
  }

  // Common patterns check
  const commonPatterns = [
    "password",
    "123456",
    "qwerty",
    "abc123",
    "letmein",
    "welcome",
    "monkey",
    "admin",
    "login",
    "passw0rd",
  ];

  const lowerPassword = password.toLowerCase();
  if (commonPatterns.some((pattern) => lowerPassword.includes(pattern))) {
    score = Math.max(0, score - 30);
    feedback.push("Avoid common words and patterns");
  }

  // Sequential characters
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 10);
    feedback.push("Avoid repeating characters");
  }

  // Cap score at 100
  score = Math.min(100, score);

  // Determine strength category
  let strength: PasswordStrength;
  if (score < 30) {
    strength = "weak";
  } else if (score < 60) {
    strength = "medium";
  } else if (score < 85) {
    strength = "strong";
  } else {
    strength = "very-strong";
  }

  return { strength, score, feedback };
}
