import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  assertVersion,
  checkVersionReport,
  readVersionReport,
  setProjectVersion,
  validateTagVersion
} from "./version-utils.mjs";
import {
  assertReleaseVersion,
  buildManifest,
  expectedAssetNames,
  selectReleaseAssets,
  validateManifest,
  validateSelectedAssets
} from "../deploy/release/release-utils.mjs";

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeProject(version = "0.1.0") {
  const root = mkdtempSync(join(tmpdir(), "starbyte-version-"));
  mkdirSync(join(root, "apps/server"), { recursive: true });
  mkdirSync(join(root, "apps/web/src-tauri"), { recursive: true });

  writeJson(join(root, "package.json"), { name: "star-byte", version });
  writeJson(join(root, "apps/server/package.json"), { name: "@starbyte/server", version });
  writeJson(join(root, "apps/web/package.json"), { name: "@starbyte/web", version });
  writeJson(join(root, "apps/web/src-tauri/tauri.conf.json"), { productName: "star_byte", version });
  writeFileSync(join(root, "apps/web/src-tauri/Cargo.toml"), `[package]\nname = "app"\nversion = "${version}"\nedition = "2021"\n`);
  writeFileSync(join(root, "apps/web/src-tauri/Cargo.lock"), `[[package]]\nname = "app"\nversion = "${version}"\n`);
  writeJson(join(root, "package-lock.json"), {
    name: "star-byte",
    version,
    lockfileVersion: 3,
    packages: {
      "": { name: "star-byte", version },
      "apps/server": { name: "@starbyte/server", version },
      "apps/web": { name: "@starbyte/web", version }
    }
  });

  return root;
}

function githubAssets(version) {
  return Object.values(expectedAssetNames(version)).map((name) => ({
    name,
    browser_download_url: `https://github.example/releases/${name}`
  }));
}

test("version report succeeds when all versions match", () => {
  const root = makeProject("0.1.0");
  const report = readVersionReport(root);

  assert.equal(checkVersionReport(report), "0.1.0");
});

test("version report detects divergent files", () => {
  const root = makeProject("0.1.0");
  writeJson(join(root, "apps/web/package.json"), { name: "@starbyte/web", version: "0.1.1" });

  assert.equal(checkVersionReport(readVersionReport(root)), null);
});

test("version validation rejects invalid versions", () => {
  assert.throws(() => assertVersion("0.1"), /Invalid version/);
  assert.throws(() => assertVersion("1.0.0-beta.1"), /Invalid version/);
});

test("version setter synchronizes all tracked files", () => {
  const root = makeProject("0.1.0");
  setProjectVersion(root, "0.1.1");

  assert.equal(checkVersionReport(readVersionReport(root)), "0.1.1");
  assert.match(readFileSync(join(root, "apps/web/src-tauri/Cargo.toml"), "utf8"), /version = "0\.1\.1"/);
});

test("tag validation rejects mismatched tag and project versions", () => {
  assert.equal(validateTagVersion("0.1.0", "0.1.0"), true);
  assert.throws(() => validateTagVersion("0.1.0", "0.1.1"), /does not match/);
});

test("release asset selection validates expected public names", () => {
  const version = "0.1.0";
  const selection = selectReleaseAssets(version, githubAssets(version));

  assert.deepEqual(selection.missing, []);
  assert.equal(selection.selected.windowsSetup.name, `star_byte_${version}_x64-setup.exe`);
  assert.doesNotThrow(() => validateSelectedAssets(version, githubAssets(version)));
});

test("release asset validation reports missing required files", () => {
  const version = "0.1.0";
  const assets = githubAssets(version).filter((asset) => !asset.name.endsWith(".AppImage.sig"));

  assert.throws(() => validateSelectedAssets(version, assets), /AppImage\.sig/);
});

test("release manifest contains only updater platforms", () => {
  const version = "0.1.0";
  const manifest = buildManifest({
    version,
    publicBaseUrl: "https://starbyte.example.com/releases",
    release: {
      body: "Release notes",
      published_at: "2026-07-08T00:00:00.000Z"
    },
    signatures: {
      windowsSetup: "windows-signature\n",
      linuxAppImage: "linux-signature\n"
    }
  });

  assert.equal(validateManifest(manifest), true);
  assert.equal(manifest.version, version);
  assert.equal(manifest.notes, "Release notes");
  assert.deepEqual(Object.keys(manifest.platforms).sort(), ["linux-x86_64", "windows-x86_64"]);
  assert.match(manifest.platforms["windows-x86_64"].url, /x64-setup\.exe$/);
  assert.match(manifest.platforms["linux-x86_64"].url, /amd64\.AppImage$/);
});

test("release validation rejects invalid release versions", () => {
  assert.throws(() => assertReleaseVersion("0.1"), /Invalid version/);
  assert.throws(() => expectedAssetNames("0.1.0-beta.1"), /Invalid version/);
});
