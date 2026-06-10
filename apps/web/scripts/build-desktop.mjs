import { spawnSync } from "node:child_process";
import { loadDesktopReleaseEnv, npxCommand } from "./desktop-env.mjs";

const releaseEnv = await loadDesktopReleaseEnv();

function run(command, args) {
  const result = spawnSync(command, args, {
    env: releaseEnv,
    stdio: "inherit"
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npxCommand(), ["tsc"]);
run(npxCommand(), ["vite", "build", "--mode", "desktop-production"]);
