import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const IMAGE_EXTENSIONS = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"]
]);

const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"]
]);

const filenameSchema = z.object({
  filename: z.string().regex(/^[a-f0-9-]+\.(?:png|jpg|gif|webp)$/i)
});

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  const dbPath = process.env.DB_PATH ?? "./data/starbyte.db";
  const uploadsDir = join(dirname(dbPath), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  app.post("/uploads/images", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    let image;
    try {
      image = await request.file();
    } catch (error) {
      if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
        return reply.code(413).send({ error: "image too large" });
      }

      throw error;
    }

    if (!image) {
      return reply.code(400).send({ error: "image required" });
    }

    const extension = IMAGE_EXTENSIONS.get(image.mimetype);
    if (!extension) {
      image.file.resume();
      return reply.code(400).send({ error: "invalid image type" });
    }

    const filename = `${randomUUID()}${extension}`;
    const filePath = join(uploadsDir, filename);

    try {
      await pipeline(image.file, createWriteStream(filePath));
    } catch {
      await fs.unlink(filePath).catch(() => {});
      throw new Error("image upload failed");
    }

    if (image.file.truncated) {
      await fs.unlink(filePath).catch(() => {});
      return reply.code(413).send({ error: "image too large" });
    }

    return { url: `/api/uploads/images/${filename}` };
  });

  app.get("/uploads/images/:filename", async (request, reply) => {
    const params = filenameSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(404).send({ error: "image not found" });
    }

    const extension = extname(params.data.filename).toLowerCase();
    const filePath = join(uploadsDir, params.data.filename);

    try {
      await fs.access(filePath);
    } catch {
      return reply.code(404).send({ error: "image not found" });
    }

    reply.type(IMAGE_TYPES.get(extension) ?? "application/octet-stream");
    return reply.send(createReadStream(filePath));
  });
};
