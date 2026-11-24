import type { FastifyInstance } from "fastify";

export async function registerAuthPlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();

      if (!request.user.sid) {
        return reply.code(401).send({ error: "invalid session" });
      }

      const session = app.db.findActiveSessionById(request.user.sid);
      if (!session || session.userId !== request.user.sub) {
        return reply.code(401).send({ error: "invalid session" });
      }

      const user = app.db.findUserById(request.user.sub);
      if (!user) {
        return reply.code(401).send({ error: "invalid session" });
      }

      app.db.touchSessionIfStale(session, { ipAddress: request.ip });
      request.currentSessionId = session.id;

      request.currentUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? "",
        statusText: user.statusText ?? "",
        createdAt: user.createdAt,
        isBioPublic: user.isBioPublic ?? 1,
        isStatusPublic: user.isStatusPublic ?? 1,
        isAvatarPublic: user.isAvatarPublic ?? 1
      };
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
}
