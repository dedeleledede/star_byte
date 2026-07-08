# Linux Packaging Notes

starbyte-client supports three Linux distribution formats:

- AppImage, built on Ubuntu by Tauri.
- `.deb`, built on Ubuntu by Tauri.
- Arch native package, built inside an Arch environment and using system WebKitGTK.

## AppImage WebKit/EGL Issue

On Arch Linux, the Ubuntu-built AppImage has been observed aborting in WebKit/EGL paths:

```text
Could not create surfaceless EGL display: EGL_BAD_ALLOC. Aborting...
```

Setting global variables such as `WEBKIT_DISABLE_COMPOSITING_MODE=1` or `LIBGL_ALWAYS_SOFTWARE=1` is not treated as a permanent fix. Those switches can mask GPU/WebKit problems and need measurement before use.

The current working hypothesis is AppImage compatibility drift between Ubuntu runner libraries and Arch runtime graphics/WebKit dependencies. The native Arch package avoids bundling a WebKitGTK stack and instead declares runtime dependencies on Arch packages.

## Arch Package

The Arch package installs only the desktop client:

```text
/usr/lib/star_byte/star_byte
/usr/bin/star_byte
/usr/share/applications/star_byte.desktop
/usr/share/icons/hicolor/*/apps/star_byte.png
```

It does not install the server, does not create `/var/lib/starbyte`, and does not create any local SQLite source-of-truth database.

Runtime dependencies currently declared:

- `webkit2gtk-4.1`
- `gtk3`
- `libayatana-appindicator`
- `openssl`
- `libsoup3`
- `hicolor-icon-theme`

Before publishing a release, verify the Arch-built binary with:

```bash
ldd apps/web/src-tauri/target/release/app
```

Then compare the listed shared libraries to `deploy/arch/PKGBUILD` and `deploy/arch/package-arch.mjs`.

## Build In Arch

The GitHub Actions `desktop-release` workflow has an Arch container job. It builds the Tauri binary inside Arch and packages:

```text
artifacts/arch/star_byte-<version>-1-x86_64.pkg.tar.zst
```

Manual equivalent from an Arch environment:

```bash
npm ci
npm run build
npm run tauri:build --workspace @starbyte/web -- --no-bundle
node deploy/arch/package-arch.mjs
```

Install locally:

```bash
sudo pacman -U artifacts/arch/star_byte-<version>-1-x86_64.pkg.tar.zst
```

Uninstall:

```bash
sudo pacman -R star_byte
```
