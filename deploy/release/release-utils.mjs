import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const VERSION_RE = /^\d+\.\d+\.\d+$/;

export function assertReleaseVersion(version) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH.`);
  }
}

export function expectedAssetNames(version) {
  assertReleaseVersion(version);

  return {
    windowsSetup: `star_byte_${version}_x64-setup.exe`,
    windowsSetupSig: `star_byte_${version}_x64-setup.exe.sig`,
    windowsPortable: `star_byte_${version}_portable_x64.zip`,
    linuxAppImage: `star_byte_${version}_amd64.AppImage`,
    linuxAppImageSig: `star_byte_${version}_amd64.AppImage.sig`,
    linuxDeb: `star_byte_${version}_amd64.deb`,
    archPackage: `star_byte-${version}-1-x86_64.pkg.tar.zst`
  };
}

export function latestAliasNames() {
  return {
    windowsSetup: "star_byte_latest_x64-setup.exe",
    windowsPortable: "star_byte_latest_portable_x64.zip",
    linuxAppImage: "star_byte_latest_amd64.AppImage",
    linuxDeb: "star_byte_latest_amd64.deb",
    archPackage: "star_byte_latest_arch.pkg.tar.zst"
  };
}

export function selectReleaseAssets(version, assets) {
  const expected = expectedAssetNames(version);
  const byName = new Map(assets.map((asset) => [asset.name, asset]));
  const selected = {};
  const missing = [];

  for (const [key, name] of Object.entries(expected)) {
    const asset = byName.get(name);
    if (!asset) {
      missing.push(name);
    } else {
      selected[key] = asset;
    }
  }

  return { expected, selected, missing };
}

export function validateSelectedAssets(version, assets) {
  const selection = selectReleaseAssets(version, assets);
  if (selection.missing.length > 0) {
    throw new Error(`Missing release assets:\n${selection.missing.map((item) => `- ${item}`).join("\n")}`);
  }
  return selection;
}

export function publicReleaseBaseUrl({ publicBaseUrl, domain }) {
  if (publicBaseUrl) return publicBaseUrl.replace(/\/+$/, "");
  const host = (domain || "starbyte.zavan.com.br").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${host}/releases`;
}

export function buildManifest({ version, release, publicBaseUrl, signatures }) {
  assertReleaseVersion(version);

  const expected = expectedAssetNames(version);
  const baseUrl = publicBaseUrl.replace(/\/+$/, "");

  if (!signatures.windowsSetup?.trim()) {
    throw new Error("Windows setup signature is empty.");
  }

  if (!signatures.linuxAppImage?.trim()) {
    throw new Error("Linux AppImage signature is empty.");
  }

  return {
    version,
    notes: release.body ?? "",
    pub_date: release.published_at ?? release.created_at,
    platforms: {
      "linux-x86_64": {
        url: `${baseUrl}/star_byte/${version}/${expected.linuxAppImage}`,
        signature: signatures.linuxAppImage.trim()
      },
      "windows-x86_64": {
        url: `${baseUrl}/star_byte/${version}/${expected.windowsSetup}`,
        signature: signatures.windowsSetup.trim()
      }
    }
  };
}

export function validateManifest(manifest) {
  assertReleaseVersion(manifest.version);

  for (const key of ["linux-x86_64", "windows-x86_64"]) {
    const platform = manifest.platforms?.[key];
    if (!platform?.url || !platform?.signature) {
      throw new Error(`Invalid updater manifest platform: ${key}`);
    }
    new URL(platform.url);
  }

  return true;
}

export function readPublishedVersion(releasesDir) {
  const manifestPath = join(releasesDir, "latest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateManifest(manifest);
  return manifest.version;
}
