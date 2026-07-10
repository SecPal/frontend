// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputDirectory = process.argv[2] ?? "dist";
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const supportedSpdxLicenseExpressions = new Set([
  "(BSD-2-Clause OR MIT OR Apache-2.0)",
  "(MIT OR CC0-1.0)",
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "OFL-1.1",
  "Python-2.0",
]);

function toSpdxIdPart(value) {
  return String(value).replaceAll(/[^A-Za-z0-9.-]+/g, "-");
}

function packageName(packagePath, packageData, index) {
  if (packageData.name) {
    return packageData.name;
  }

  if (packagePath === "") {
    return packageLock.name ?? "application";
  }

  return packagePath.split("node_modules/").at(-1) ?? `package-${index}`;
}

function normalizedLicense(license) {
  return typeof license === "string" &&
    supportedSpdxLicenseExpressions.has(license)
    ? license
    : "NOASSERTION";
}

const packages = Object.entries(packageLock.packages ?? {})
  .filter(([, packageData]) => packageData.version)
  .map(([packagePath, packageData], index) => {
    const name = packageName(packagePath, packageData, index);
    const version = packageData.version;

    return {
      SPDXID: `SPDXRef-Package-${index}-${toSpdxIdPart(name)}-${toSpdxIdPart(version)}`,
      copyrightText: "NOASSERTION",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "NOASSERTION",
      licenseDeclared: normalizedLicense(packageData.license),
      name,
      versionInfo: version,
    };
  });

const sbom = {
  SPDXID: "SPDXRef-DOCUMENT",
  creationInfo: {
    created: new Date().toISOString(),
    creators: ["Tool: SecPal lockfile SPDX generator"],
  },
  dataLicense: "CC0-1.0",
  documentNamespace: `https://spdx.org/spdxdocs/${toSpdxIdPart(packageLock.name ?? "application")}-${Date.now()}`,
  name: `${packageLock.name ?? "application"} dependency inventory`,
  packages,
  relationships: packages.map(({ SPDXID }) => ({
    relatedSpdxElement: SPDXID,
    relationshipType: "DESCRIBES",
    spdxElementId: "SPDXRef-DOCUMENT",
  })),
  spdxVersion: "SPDX-2.3",
};

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  path.join(outputDirectory, "dependencies.spdx.json"),
  `${JSON.stringify(sbom, null, 2)}\n`
);
