import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { emitToAllConnectedUsers } from "../lib/realtime.js";

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(2).max(40),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(8).max(128)
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 hour" }
    }
  }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
    }

    try {
      const existing = app.db.findUserByUsername(parsed.data.username);
      if (existing) {
        return reply.code(409).send({ error: "username already taken" });
      }

      const passwordHash = hashPassword(parsed.data.password);
      app.log.info({ username: parsed.data.username }, "register: password hashed");

      const user = app.db.createUser({
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        passwordHash
      });
      app.log.info({ userId: user.id, username: user.username }, "register: user created");

      const token = await reply.jwtSign({
        sub: user.id,
        username: user.username
      });
      app.log.info({ userId: user.id }, "register: jwt signed");

      return {
        token,
        user
      };
    } catch (error) {
      app.log.error(error, "register failed");
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "register failed"
      });
    }
  });

  app.post("/login", {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" }
    }
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
    }

    const user = app.db.findUserByUsername(parsed.data.username);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      username: user.username
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        statusText: user.statusText,
        isBioPublic: user.isBioPublic,
        isStatusPublic: user.isStatusPublic,
        isAvatarPublic: user.isAvatarPublic,
        createdAt: user.createdAt
      }
    };
  });

  app.get("/me", {
    preHandler: app.authenticate
  }, async (request) => {
    return {
      user: request.currentUser
    };
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply.code(400).send({ error: "invalid payload" });
    }

    const keys = Object.keys(body);
    if (keys.length === 0) {
      return reply.code(400).send({ error: "invalid payload" });
    }

    const allowedKeys = ["displayName", "avatarUrl", "bio", "statusText", "isBioPublic", "isStatusPublic", "isAvatarPublic"];
    for (const key of keys) {
      if (!allowedKeys.includes(key)) {
        return reply.code(400).send({ error: "invalid payload" });
      }
    }

    const { displayName, avatarUrl, bio, statusText, isBioPublic, isStatusPublic, isAvatarPublic } = body as any;

    if (
      (displayName !== undefined && (typeof displayName !== "string" || displayName.trim().length < 2)) ||
      (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") ||
      (bio !== undefined && typeof bio !== "string") ||
      (statusText !== undefined && typeof statusText !== "string") ||
      (isBioPublic !== undefined && typeof isBioPublic !== "boolean" && typeof isBioPublic !== "number") ||
      (isStatusPublic !== undefined && typeof isStatusPublic !== "boolean" && typeof isStatusPublic !== "number") ||
      (isAvatarPublic !== undefined && typeof isAvatarPublic !== "boolean" && typeof isAvatarPublic !== "number")
    ) {
      return reply.code(400).send({ error: "invalid payload" });
    }

    const userId = request.currentUser!.id;

    const user = app.db.updateUserProfile({
      userId,
      displayName: displayName ?? request.currentUser!.displayName,
      avatarUrl: avatarUrl !== undefined ? (avatarUrl || null) : request.currentUser!.avatarUrl,
      bio: bio ?? request.currentUser!.bio,
      statusText: statusText ?? request.currentUser!.statusText,
      isBioPublic: isBioPublic !== undefined ? (isBioPublic ? 1 : 0) : request.currentUser!.isBioPublic,
      isStatusPublic: isStatusPublic !== undefined ? (isStatusPublic ? 1 : 0) : request.currentUser!.isStatusPublic,
      isAvatarPublic: isAvatarPublic !== undefined ? (isAvatarPublic ? 1 : 0) : request.currentUser!.isAvatarPublic,
    });

    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    const { passwordHash, ...safeUser } = user as any;

    emitToAllConnectedUsers(app, "user.profile.updated", { user: safeUser });

    return { user: safeUser };
  });
};