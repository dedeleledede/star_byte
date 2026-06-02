import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.js";

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(2).max(40),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(8).max(128)
});

const updateMeSchema = z.object({
  displayName: z.string().min(2).max(40),
  avatarUrl: z.string().max(500).optional().or(z.literal("")),
  bio: z.string().max(240),
  statusText: z.string().max(80)
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
    const parsed = updateMeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid payload",
        issues: parsed.error.flatten()
      });
    }

    const { displayName, avatarUrl, bio, statusText } = parsed.data;
    const userId = request.user.sub;

    const user = app.db.updateUserProfile({
      userId,
      displayName,
      avatarUrl: avatarUrl || null,
      bio,
      statusText
    });

    if (!user) {
      return reply.code(404).send({ error: "user not found" });
    }

    return { user };
  });
};
