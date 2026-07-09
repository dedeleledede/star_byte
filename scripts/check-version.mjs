#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { checkVersionReport, formatVersionReport, readVersionReport } from "./version-utils.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const report = readVersionReport(repoRoot);
const version = checkVersionReport(report);

console.log(formatVersionReport(report));

if (!version) {
  console.error("\nVersion mismatch: update files with npm run version:set -- <version>.");
  process.exit(1);
}

console.log(`\nVersion OK: ${version}`);
