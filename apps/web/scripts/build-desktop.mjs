import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const source = await readFile(new URL("../.env.desktop-production", import.meta.url), "utf8");
const releaseEnv = Object.fromEntries(
  source
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
);

function requireConstellationUrl(name, protocol) {
  const url = new URL(releaseEnv[name]);

  if (url.protocol !== protocol || url.hostname !== "constellation.servebeer.com") {
    throw new Error(`${name} must use ${protocol}//constellation.servebeer.com for desktop releases.`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...releaseEnv },
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

requireConstellationUrl("VITE_API_BASE_URL", "https:");
requireConstellationUrl("VITE_WS_BASE_URL", "wss:");

run("npx", ["tsc"]);
run("npx", ["vite", "build", "--mode", "desktop-production"]);
