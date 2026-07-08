import { spawnSync } from "node:child_process";
import { loadDesktopReleaseEnv, npxCommand } from "./desktop-env.mjs";

const releaseEnv = await loadDesktopReleaseEnv();
const tauriConfig = {
  plugins: {
    updater: {
      endpoints: [releaseEnv.STARBYTE_DESKTOP_UPDATER_ENDPOINT]
    }
  }
};

const args = [
  "tauri",
  "build",
  "--config",
  JSON.stringify(tauriConfig),
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
