#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setProjectVersion } from "./version-utils.mjs";

const version = process.argv[2];

if (!version) {
  console.error("Usage: npm run version:set -- MAJOR.MINOR.PATCH");
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  setProjectVersion(repoRoot, version);
  console.log(`Version set: ${version}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
