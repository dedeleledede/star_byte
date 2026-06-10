import { readFile } from "node:fs/promises";

const envFileUrl = new URL("../.env.desktop-production", import.meta.url);

function parseEnvFile(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) return [line, ""];
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function urlFromDomain(domain, protocol) {
  if (!domain) return undefined;

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^wss?:\/\//, "").replace(/\/+$/, "");
  return `${protocol}//${cleanDomain}`;
}

function releaseUrlError(name, value, protocol) {
  if (!value) {
    return `${name} is required for desktop release builds.`;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return `${name} must be a valid URL for desktop release builds.`;
  }
  const hostname = url.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local");

  if (url.protocol !== protocol) {
    return `${name} must use ${protocol} for desktop release builds.`;
  }

  if (isLocal) {
    return `${name} must not point to localhost for desktop release builds.`;
  }

  return null;
}

function assertReleaseUrl(name, value, protocol) {
  const error = releaseUrlError(name, value, protocol);
  if (error) throw new Error(error);
  return value.replace(/\/+$/, "");
}

function resolveReleaseUrl(name, protocol, envValue, fileValue, domainValue) {
  const fromDomain = urlFromDomain(domainValue, protocol);
  if (fromDomain) return assertReleaseUrl(name, fromDomain, protocol);

  if (envValue) {
    const error = releaseUrlError(name, envValue, protocol);
    const isDevLocal = /^(http|ws):\/\/(localhost|127\.0\.0\.1|\[::1\]|[^/]+\.localhost)([:/]|$)/i.test(envValue);

    if (!error) return envValue.replace(/\/+$/, "");
    if (!isDevLocal || !fileValue) throw new Error(error);
  }

  return assertReleaseUrl(name, fileValue, protocol);
}

export async function loadDesktopReleaseEnv() {
  let fileEnv = {};

  try {
    fileEnv = parseEnvFile(await readFile(envFileUrl, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const merged = { ...fileEnv, ...process.env };
  const domain = firstNonEmpty(process.env.STARBYTE_DOMAIN, fileEnv.STARBYTE_DOMAIN);
  const apiBaseUrl = resolveReleaseUrl(
    "VITE_API_BASE_URL",
    "https:",
    firstNonEmpty(process.env.VITE_API_BASE_URL),
    firstNonEmpty(fileEnv.VITE_API_BASE_URL),
    domain
  );
  const wsBaseUrl = resolveReleaseUrl(
    "VITE_WS_BASE_URL",
    "wss:",
    firstNonEmpty(process.env.VITE_WS_BASE_URL),
    firstNonEmpty(fileEnv.VITE_WS_BASE_URL),
    domain
  );

  return {
    ...merged,
    VITE_API_BASE_URL: apiBaseUrl,
    VITE_WS_BASE_URL: wsBaseUrl,
    STARBYTE_DESKTOP_UPDATER_ENDPOINT:
      `${apiBaseUrl}/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}`
  };
}

export function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
