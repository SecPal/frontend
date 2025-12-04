// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Utility for rendering components that contain HeadlessUI Dialogs.
 *
 * React 19 has stricter act() warnings for state updates that occur
 * during component rendering. HeadlessUI Dialog components trigger
 * internal state updates for animations/transitions.
 *
 * This utility provides a wrapper that waits for all pending state
 * updates to complete before returning.
 */

import { render, waitFor, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Renders a component and waits for HeadlessUI Dialog transitions to settle.
 *
 * Use this instead of `render()` for components containing:
 * - Dialog
 * - Transition
 * - Switch (with transitions)
 * - Any HeadlessUI component with `transition` prop
 *
 * @example
 * ```tsx
 * const { getByRole } = await renderWithTransitions(
 *   <MyDialogComponent isOpen={true} />
 * );
 * ```
 */
export async function renderWithTransitions(
  ui: ReactElement
): Promise<RenderResult> {
  const result = render(ui);

  // Wait for any pending state updates from HeadlessUI transitions
  // The empty callback ensures we wait for the next tick where React
  // has flushed all pending updates
  await waitFor(() => {});

  return result;
}
