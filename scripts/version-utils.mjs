import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const VERSION_RE = /^\d+\.\d+\.\d+$/;

export const VERSION_FILES = {
  rootPackage: "package.json",
  serverPackage: "apps/server/package.json",
  webPackage: "apps/web/package.json",
  tauriConfig: "apps/web/src-tauri/tauri.conf.json",
  cargoPackage: "apps/web/src-tauri/Cargo.toml",
  cargoLock: "apps/web/src-tauri/Cargo.lock",
  packageLock: "package-lock.json"
};

export function assertVersion(version) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH.`);
  }
}

function readJson(repoRoot, path) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function writeJson(repoRoot, path, value) {
  writeFileSync(join(repoRoot, path), `${JSON.stringify(value, null, 2)}\n`);
}

export function readPackageVersion(repoRoot, path) {
  return readJson(repoRoot, path).version;
}

export function setPackageVersion(repoRoot, path, version) {
  const json = readJson(repoRoot, path);
  json.version = version;
  writeJson(repoRoot, path, json);
}

export function readCargoPackageVersion(repoRoot) {
  const source = readFileSync(join(repoRoot, VERSION_FILES.cargoPackage), "utf8");
  const packageMatch = source.match(/^\[package\]\n([\s\S]*?)(?:\n\[|$)/);
  const versionMatch = packageMatch?.[1].match(/^version\s*=\s*"([^"]+)"/m);
  if (!versionMatch) throw new Error("Could not find [package] version in Cargo.toml.");
  return versionMatch[1];
}

export function setCargoPackageVersion(repoRoot, version) {
  const path = join(repoRoot, VERSION_FILES.cargoPackage);
  const source = readFileSync(path, "utf8");
  const next = source.replace(
    /^(\[package\]\n[\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`
  );

  if (next === source) throw new Error("Could not update [package] version in Cargo.toml.");
  writeFileSync(path, next);
}

export function readCargoLockAppVersion(repoRoot) {
  const source = readFileSync(join(repoRoot, VERSION_FILES.cargoLock), "utf8");
  const packages = source.split(/\n(?=\[\[package\]\]\n)/);
  const appPackage = packages.find((block) => /^name\s*=\s*"app"$/m.test(block));
  const versionMatch = appPackage?.match(/^version\s*=\s*"([^"]+)"/m);
  if (!versionMatch) throw new Error("Could not find app package version in Cargo.lock.");
  return versionMatch[1];
}

export function setCargoLockAppVersion(repoRoot, version) {
  const path = join(repoRoot, VERSION_FILES.cargoLock);
  const source = readFileSync(path, "utf8");
  const packages = source.split(/\n(?=\[\[package\]\]\n)/);
  let changed = false;
  const next = packages.map((block) => {
    if (!/^name\s*=\s*"app"$/m.test(block)) return block;
    changed = true;
    return block.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  }).join("\n");

  if (!changed) throw new Error("Could not update app package version in Cargo.lock.");
  writeFileSync(path, next);
}

export function setPackageLockVersions(repoRoot, version) {
  const lock = readJson(repoRoot, VERSION_FILES.packageLock);
  lock.version = version;

  const packagePaths = ["", "apps/server", "apps/web"];
  for (const path of packagePaths) {
    if (lock.packages?.[path]) {
      lock.packages[path].version = version;
    }
  }

  writeJson(repoRoot, VERSION_FILES.packageLock, lock);
}

export function readVersionReport(repoRoot) {
  return {
    rootPackage: readPackageVersion(repoRoot, VERSION_FILES.rootPackage),
    serverPackage: readPackageVersion(repoRoot, VERSION_FILES.serverPackage),
    webPackage: readPackageVersion(repoRoot, VERSION_FILES.webPackage),
    tauriConfig: readPackageVersion(repoRoot, VERSION_FILES.tauriConfig),
    cargoPackage: readCargoPackageVersion(repoRoot),
    cargoLock: readCargoLockAppVersion(repoRoot),
    packageLockRoot: readPackageVersion(repoRoot, VERSION_FILES.packageLock)
  };
}

export function checkVersionReport(report) {
  const versions = new Set(Object.values(report));
  return versions.size === 1 ? [...versions][0] : null;
}

export function validateTagVersion(projectVersion, tagVersion) {
  assertVersion(tagVersion);
  if (projectVersion !== tagVersion) {
    throw new Error(`Tag version ${tagVersion} does not match project version ${projectVersion}.`);
  }
  return true;
}

export function setProjectVersion(repoRoot, version) {
  assertVersion(version);
  setPackageVersion(repoRoot, VERSION_FILES.rootPackage, version);
  setPackageVersion(repoRoot, VERSION_FILES.serverPackage, version);
  setPackageVersion(repoRoot, VERSION_FILES.webPackage, version);
  setPackageVersion(repoRoot, VERSION_FILES.tauriConfig, version);
  setCargoPackageVersion(repoRoot, version);
  setCargoLockAppVersion(repoRoot, version);
  setPackageLockVersions(repoRoot, version);
}

export function formatVersionReport(report) {
  return [
    "Version check:",
    `root package: ${report.rootPackage}`,
    `server package: ${report.serverPackage}`,
    `web package: ${report.webPackage}`,
    `tauri config: ${report.tauriConfig}`,
    `cargo package: ${report.cargoPackage}`,
    `cargo lock app: ${report.cargoLock}`,
    `package-lock root: ${report.packageLockRoot}`
  ].join("\n");
}
