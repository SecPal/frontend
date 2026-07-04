// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const projectRoot = cwd();
const attributionTermsPath = path.join(
  projectRoot,
  "LICENSES",
  "LicenseRef-SecPal-Attribution.txt"
);

const centralAttributionTerms = `SecPal Attribution Terms

These additional terms apply to SecPal under section 7(b) and section 7(c) of
the GNU Affero General Public License version 3 or later.

1. Attribution notices

The following attribution notices are specified reasonable legal notices and
author attribution notices for SecPal:

  Powered by SecPal
  Based on SecPal

Covered works that display Appropriate Legal Notices in an interactive user
interface must preserve an appropriate SecPal attribution notice in those
Appropriate Legal Notices, or in a comparable, reasonably visible legal-notices,
credits, or about section.

Unmodified versions should use:

  Powered by SecPal

Modified versions must be marked in a reasonable way as different from the
original SecPal version and should use an attribution notice such as:

  Based on SecPal

or:

  Based on SecPal - modified by [name/entity]

A modified version must not use "Powered by SecPal" in a way that implies that
the modified version is the original SecPal version or is endorsed by the
SecPal project maintainers.

2. Project tagline and website

The preferred full attribution notice is:

  Powered by SecPal - A guard's best friend

For modified versions, the preferred attribution notice is:

  Based on SecPal - A guard's best friend

The SecPal project website is:

  https://secpal.app

Including the tagline "A guard's best friend" and including or linking to
https://secpal.app are requested, but they are not required as license
conditions.

3. No endorsement

Modified versions must not misrepresent their origin or imply endorsement by
the SecPal project maintainers. Modified versions may add a clear modification
notice next to the SecPal attribution.

4. Scope

These additional terms do not require preservation of a specific footer layout,
visual design, logo, hyperlink, or exact placement. A covered work may satisfy
these terms by preserving the required SecPal attribution notice in its
Appropriate Legal Notices or in a comparable, reasonably visible legal-notices,
credits, or about section.
`;

describe("SecPal attribution policy", () => {
  it("keeps the repository addendum aligned with the checked-in central wording", () => {
    const terms = readFileSync(attributionTermsPath, "utf8");

    expect(terms).toBe(centralAttributionTerms);
  });
});
