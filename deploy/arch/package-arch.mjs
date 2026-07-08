import { mkdirSync, copyFileSync, symlinkSync, writeFileSync, statSync, rmSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const version = process.env.STARBYTE_VERSION ?? process.env.npm_package_version ?? "0.1.0";
const pkgrel = process.env.ARCH_PKGREL ?? "1";
const arch = "x86_64";
const pkgname = "star_byte";
const outDir = join(repoRoot, "artifacts", "arch");
const root = join(outDir, "pkgroot");
const packageFile = join(outDir, `${pkgname}-${version}-${pkgrel}-${arch}.pkg.tar.zst`);

function installFile(source, destination, mode) {
  const target = join(root, destination);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(repoRoot, source), target);
  if (mode) {
    chmodSync(target, Number.parseInt(mode, 8));
  }
}

function sizeOf(path) {
  const stats = statSync(path);
  return stats.isFile() ? stats.size : 0;
}

rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
mkdirSync(outDir, { recursive: true });

installFile("apps/web/src-tauri/target/release/app", "usr/lib/star_byte/star_byte", "755");
mkdirSync(join(root, "usr/bin"), { recursive: true });
symlinkSync("/usr/lib/star_byte/star_byte", join(root, "usr/bin/star_byte"));
installFile("deploy/linux/star_byte.desktop", "usr/share/applications/star_byte.desktop", "644");
installFile("apps/web/src-tauri/icons/32x32.png", "usr/share/icons/hicolor/32x32/apps/star_byte.png", "644");
installFile("apps/web/src-tauri/icons/64x64.png", "usr/share/icons/hicolor/64x64/apps/star_byte.png", "644");
installFile("apps/web/src-tauri/icons/128x128.png", "usr/share/icons/hicolor/128x128/apps/star_byte.png", "644");
installFile("apps/web/src-tauri/icons/128x128@2x.png", "usr/share/icons/hicolor/256x256/apps/star_byte.png", "644");
installFile("LICENSE", "usr/share/licenses/star_byte/LICENSE", "644");

const installedSize = [
  "usr/lib/star_byte/star_byte",
  "usr/share/applications/star_byte.desktop",
  "usr/share/icons/hicolor/32x32/apps/star_byte.png",
  "usr/share/icons/hicolor/64x64/apps/star_byte.png",
  "usr/share/icons/hicolor/128x128/apps/star_byte.png",
  "usr/share/icons/hicolor/256x256/apps/star_byte.png",
  "usr/share/licenses/star_byte/LICENSE"
].reduce((total, path) => total + sizeOf(join(root, path)), 0);

writeFileSync(join(root, ".PKGINFO"), [
  `pkgname = ${pkgname}`,
  `pkgbase = ${pkgname}`,
  `pkgver = ${version}-${pkgrel}`,
  "pkgdesc = star_byte Tauri desktop client",
  "url = https://github.com/dedeleledede/star_byte",
  `builddate = ${Math.floor(Date.now() / 1000)}`,
  "packager = star_byte CI",
  `size = ${installedSize}`,
  `arch = ${arch}`,
  "license = MIT",
  "depend = webkit2gtk-4.1",
  "depend = gtk3",
  "depend = libayatana-appindicator",
  "depend = openssl",
  "depend = libsoup3",
  "depend = hicolor-icon-theme",
  ""
].join("\n"));

const result = spawnSync("bsdtar", ["--zstd", "-C", root, "-cf", packageFile, ".PKGINFO", "usr"], {
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(packageFile);
