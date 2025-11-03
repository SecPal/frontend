// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../src/locales/en/messages";

// Initialize i18n for tests
i18n.load("en", enMessages);
i18n.activate("en");
