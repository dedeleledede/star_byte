import type { FastifyInstance } from "fastify";

export async function registerAuthPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();

      const user = app.db.findUserById(request.user.sub);
      if (!user) {
        return reply.code(401).send({ error: "invalid session" });
      }

      request.currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? "",
        statusText: user.statusText ?? "",
        createdAt: user.createdAt
      };
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
}
