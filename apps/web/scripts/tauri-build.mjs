import { spawnSync } from "node:child_process";
import { loadDesktopReleaseEnv, npxCommand } from "./desktop-env.mjs";

const releaseEnv = await loadDesktopReleaseEnv();

const args = [
  "tauri",
  "build",
  ...process.argv.slice(2)
];

const result = spawnSync(npxCommand(), args, {
  env: releaseEnv,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}