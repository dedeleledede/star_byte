import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const updateSchema = z.object({
  version: z.string().min(1),
  notes: z.string().default(""),
  pub_date: z.string().datetime(),
  platforms: z.record(z.string(), z.object({
    url: z.string().url(),
    signature: z.string().min(1)
  }))
});

function parseVersion(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;

  return {
    parts: match.slice(1, 4).map(Number),
    prerelease: match[4] ?? null
  };
}

function isNewerVersion(latest: string, current: string) {
  const latestVersion = parseVersion(latest);
  const currentVersion = parseVersion(current);
  if (!latestVersion || !currentVersion) return latest !== current;

  for (let index = 0; index < latestVersion.parts.length; index += 1) {
    if (latestVersion.parts[index] !== currentVersion.parts[index]) {
      return latestVersion.parts[index] > currentVersion.parts[index];
    }
  }

  if (latestVersion.prerelease === currentVersion.prerelease) return false;
  if (!latestVersion.prerelease) return true;
  if (!currentVersion.prerelease) return false;
  return latestVersion.prerelease > currentVersion.prerelease;
}

export const desktopUpdateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/desktop/updates/:target/:arch/:currentVersion", async (request, reply) => {
    const params = z.object({
      target: z.string().min(1),
      arch: z.string().min(1),
      currentVersion: z.string().min(1)
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid update request" });
    }

    const releasesDir = process.env.STARBYTE_RELEASES_DIR ??
      join(dirname(process.env.DB_PATH ?? "./data/starbyte.db"), "releases");
    const manifestPath = process.env.DESKTOP_RELEASES_MANIFEST ??
      join(releasesDir, "latest.json");

    let manifest;
    try {
      manifest = updateSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return reply.code(204).send();
      }

      request.log.error({ error, manifestPath }, "invalid desktop releases manifest");
      return reply.code(500).send({ error: "invalid desktop releases manifest" });
    }

    if (!isNewerVersion(manifest.version, params.data.currentVersion)) {
      return reply.code(204).send();
    }

    const platformKey = `${params.data.target}-${params.data.arch}`;
    const platform = manifest.platforms[platformKey];
    if (!platform) {
      return reply.code(204).send();
    }

    return {
      version: manifest.version,
      notes: manifest.notes,
      pub_date: manifest.pub_date,
      url: platform.url,
      signature: platform.signature,
      platforms: {
        [platformKey]: platform
      }
    };
  });
};
