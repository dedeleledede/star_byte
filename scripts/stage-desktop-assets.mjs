#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expectedAssetNames, assertReleaseVersion } from "../deploy/release/release-utils.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const platform = process.argv[2];
const version = process.argv[3] ?? JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
const outDir = join(repoRoot, "artifacts", "release");

assertReleaseVersion(version);
mkdirSync(outDir, { recursive: true });

const expected = expectedAssetNames(version);

function copy(source, targetName) {
  if (!existsSync(source)) throw new Error(`Missing source artifact: ${source}`);
  copyFileSync(source, join(outDir, targetName));
  console.log(targetName);
}

function findOne(dir, predicate) {
  if (!existsSync(dir)) return null;
  const matches = readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile() && predicate(path));
  if (matches.length !== 1) {
    throw new Error(`Expected one match in ${dir}, found ${matches.length}.`);
  }
  return matches[0];
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function makeStoredZip(sourcePath, zipPath, entryName) {
  const data = readFileSync(sourcePath);
  const name = Buffer.from(entryName);
  const crc = crc32(data);
  const localHeader = Buffer.concat([
    u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
  ]);
  const centralOffset = localHeader.length + data.length;
  const centralHeader = Buffer.concat([
    u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
    u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
    u16(0), u16(0), u16(0), u32(0), u32(0), name
  ]);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(1), u16(1),
    u32(centralHeader.length), u32(centralOffset), u16(0)
  ]);
  writeFileSync(zipPath, Buffer.concat([localHeader, data, centralHeader, end]));
}

try {
  if (!platform || !["linux", "windows", "arch"].includes(platform)) {
    throw new Error("Usage: node scripts/stage-desktop-assets.mjs <linux|windows|arch> [version]");
  }

  if (platform === "linux") {
    const appimageDir = join(repoRoot, "apps/web/src-tauri/target/release/bundle/appimage");
    const debDir = join(repoRoot, "apps/web/src-tauri/target/release/bundle/deb");
    copy(findOne(appimageDir, (path) => path.endsWith(".AppImage")), expected.linuxAppImage);
    copy(findOne(appimageDir, (path) => path.endsWith(".AppImage.sig")), expected.linuxAppImageSig);
    copy(findOne(debDir, (path) => path.endsWith(".deb")), expected.linuxDeb);
  }

  if (platform === "windows") {
    const nsisDir = join(repoRoot, "apps/web/src-tauri/target/release/bundle/nsis");
    const releaseDir = join(repoRoot, "apps/web/src-tauri/target/release");
    copy(findOne(nsisDir, (path) => path.endsWith(".exe")), expected.windowsSetup);
    copy(findOne(nsisDir, (path) => path.endsWith(".exe.sig")), expected.windowsSetupSig);

    const portableExe = findOne(releaseDir, (path) => extname(path).toLowerCase() === ".exe");
    makeStoredZip(portableExe, join(outDir, expected.windowsPortable), "star_byte.exe");
    console.log(expected.windowsPortable);
  }

  if (platform === "arch") {
    const archDir = join(repoRoot, "artifacts/arch");
    copy(findOne(archDir, (path) => basename(path) === expected.archPackage), expected.archPackage);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
