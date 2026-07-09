#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { checkVersionReport, readVersionReport, validateTagVersion } from "./version-utils.mjs";

const tagVersion = process.argv[2] ?? process.env.TAG_VERSION;

if (!tagVersion) {
  console.error("Usage: node scripts/validate-release-tag.mjs MAJOR.MINOR.PATCH");
  process.exit(1);
}

try {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const projectVersion = checkVersionReport(readVersionReport(repoRoot));

  if (!projectVersion) {
    console.error("Project versions are not synchronized.");
    process.exit(1);
  }

  validateTagVersion(projectVersion, tagVersion);

  console.log(`Release tag OK: v${tagVersion}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
