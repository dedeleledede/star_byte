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
  stdio: "inherit"
});

if (result.status !== 0) process.exit(result.status ?? 1);
