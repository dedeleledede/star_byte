#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  assertReleaseVersion,
  buildManifest,
  expectedAssetNames,
  latestAliasNames,
  publicReleaseBaseUrl,
  readPublishedVersion,
  validateManifest,
  validateSelectedAssets
} from "./release-utils.mjs";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isStatus = args.includes("--status");
const version = args.find((arg) => !arg.startsWith("--"));
const repository = process.env.GITHUB_REPOSITORY || "dedeleledede/star_byte";
const releasesDir = process.env.STARBYTE_RELEASES_DIR || "/var/lib/starbyte/releases";
const publicBaseUrl = publicReleaseBaseUrl({
  publicBaseUrl: process.env.STARBYTE_RELEASES_PUBLIC_BASE_URL,
  domain: process.env.STARBYTE_DOMAIN
});

function githubHeaders() {
  return {
    "User-Agent": "starbyte-release-publisher",
    "Accept": "application/vnd.github+json",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchRelease(releaseVersion) {
  assertReleaseVersion(releaseVersion);
  return fetchJson(`https://api.github.com/repos/${repository}/releases/tags/v${releaseVersion}`);
}

async function downloadAsset(asset, destination) {
  const response = await fetch(asset.browser_download_url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`Download failed for ${asset.name}: ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0) {
    throw new Error(`Downloaded asset is empty: ${asset.name}`);
  }
  writeFileSync(destination, data);
}

async function checkUrl(url) {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`Public URL check failed: ${url} returned ${response.status}`);
  }
}

function replaceSymlink(linkPath, targetPath) {
  if (existsSync(linkPath)) {
    const stat = lstatSync(linkPath);
    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink latest alias: ${linkPath}`);
    }
    unlinkSync(linkPath);
  }

  symlinkSync(relative(dirname(linkPath), targetPath), linkPath);
}

function promoteFinalArtifacts(stagingDir, finalDir) {
  if (existsSync(finalDir)) {
    throw new Error(`Release version already exists: ${finalDir}`);
  }

  mkdirSync(dirname(finalDir), { recursive: true });
  renameSync(stagingDir, finalDir);
}

async function printStatus() {
  const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const currentProjectVersion = rootPackage.version;
  let published = "not found";
  let manifestState = "not found";

  try {
    const publishedVersion = readPublishedVersion(releasesDir);
    if (publishedVersion) {
      published = publishedVersion;
      manifestState = "valid";
    }
  } catch (error) {
    manifestState = `invalid (${error instanceof Error ? error.message : String(error)})`;
  }

  const release = await fetchRelease(version || currentProjectVersion);

  console.log(`Current project version: ${currentProjectVersion}`);
  console.log(`Published desktop version: ${published}`);
  console.log(`GitHub Release: ${release ? "found" : "not found"}`);
  console.log(`Updater manifest: ${manifestState}`);
}

async function publish() {
  if (!version) {
    throw new Error("Usage: publish-from-github.mjs <version> [--dry-run]\n       publish-from-github.mjs --status [version]");
  }

  assertReleaseVersion(version);
  const release = await fetchRelease(version);
  if (!release) {
    throw new Error(`GitHub Release not found: v${version}`);
  }

  const { expected, selected } = validateSelectedAssets(version, release.assets ?? []);
  const finalDir = join(releasesDir, "star_byte", version);
  let stagingDir = join(releasesDir, ".staging", `star_byte_${version}_${Date.now()}`);

  console.log(`Release: v${version}`);
  console.log(`GitHub repository: ${repository}`);
  console.log(`Release directory: ${finalDir}`);
  console.log("Assets:");
  for (const name of Object.values(expected)) {
    console.log(`- ${name}`);
  }

  if (existsSync(finalDir)) {
    throw new Error(`Release version already exists: ${finalDir}`);
  }

  if (isDryRun) {
    console.log("\nDry run: no files downloaded, no aliases changed, latest.json unchanged.");
    return;
  }

  mkdirSync(stagingDir, { recursive: true });

  try {
    for (const [key, asset] of Object.entries(selected)) {
      await downloadAsset(asset, join(stagingDir, expected[key]));
    }

    const windowsSig = readFileSync(join(stagingDir, expected.windowsSetupSig), "utf8");
    const linuxSig = readFileSync(join(stagingDir, expected.linuxAppImageSig), "utf8");

    if (!windowsSig.trim() || !linuxSig.trim()) {
      throw new Error("Updater signature file is empty.");
    }

    const manifest = buildManifest({
      version,
      release,
      publicBaseUrl,
      signatures: {
        windowsSetup: windowsSig,
        linuxAppImage: linuxSig
      }
    });

    validateManifest(manifest);

    promoteFinalArtifacts(stagingDir, finalDir);
    stagingDir = null;

    await checkUrl(manifest.platforms["windows-x86_64"].url);
    await checkUrl(manifest.platforms["linux-x86_64"].url);

    const aliases = latestAliasNames();
    replaceSymlink(join(releasesDir, aliases.windowsSetup), join(finalDir, expected.windowsSetup));
    replaceSymlink(join(releasesDir, aliases.windowsPortable), join(finalDir, expected.windowsPortable));
    replaceSymlink(join(releasesDir, aliases.linuxAppImage), join(finalDir, expected.linuxAppImage));
    replaceSymlink(join(releasesDir, aliases.linuxDeb), join(finalDir, expected.linuxDeb));
    replaceSymlink(join(releasesDir, aliases.archPackage), join(finalDir, expected.archPackage));

    const tmpManifest = join(releasesDir, "latest.json.tmp");
    writeFileSync(tmpManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    validateManifest(JSON.parse(readFileSync(tmpManifest, "utf8")));
    renameSync(tmpManifest, join(releasesDir, "latest.json"));

    console.log(`Published desktop update ${version}.`);
  } finally {
    if (stagingDir) {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }
}

try {
  if (isStatus) {
    await printStatus();
  } else {
    await publish();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
