import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const websocketRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, (socket, request) => {
    const tokenParse = z.object({
      token: z.string().min(1)
    }).safeParse(request.query);

    if (!tokenParse.success) {
      socket.close(1008, "missing token");
      return;
    }

    let userId = "";
    let sessionId = "";
    const token = tokenParse.data.token;

    try {
      const decoded = app.jwt.verify<{ sub: string; username: string; sid?: string }>(token);
      if (!decoded.sid) {
        socket.close(1008, "invalid session");
        return;
      }

      const session = app.db.findActiveSessionById(decoded.sid);
      if (!session || session.userId !== decoded.sub) {
        socket.close(1008, "invalid session");
        return;
      }

      const user = app.db.findUserById(decoded.sub);
      if (!user) {
        socket.close(1008, "invalid session");
        return;
      }

      userId = decoded.sub;
      sessionId = session.id;
      app.db.touchSessionIfStale(session, { ipAddress: request.ip });
    } catch {
      socket.close(1008, "invalid token");
      return;
    }

    const existing = app.wsClients.get(userId) ?? new Set();
    existing.add(socket);
    app.wsClients.set(userId, existing);

    const existingSessionSockets = app.wsSessionClients.get(sessionId) ?? new Set();
    existingSessionSockets.add(socket);
    app.wsSessionClients.set(sessionId, existingSessionSockets);

    socket.send(JSON.stringify({
      type: "ws.ready",
      data: {
        userId,
        sessionId
      }
    }));

    socket.on("message", (chunk) => {
      const text = chunk.toString();
      if (text === "ping") {
        const session = app.db.findActiveSessionById(sessionId);
        if (!session) {
          socket.send(JSON.stringify({ type: "session.revoked", data: { sessionId } }));
          socket.close(4001, "session revoked");
          return;
        }
        app.db.touchSessionIfStale(session, { ipAddress: request.ip });
        socket.send("pong");
      }
    });

    socket.on("close", () => {
      const sockets = app.wsClients.get(userId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          app.wsClients.delete(userId);
        }
      }

      const sessionSockets = app.wsSessionClients.get(sessionId);
      if (sessionSockets) {
        sessionSockets.delete(socket);
        if (sessionSockets.size === 0) {
          app.wsSessionClients.delete(sessionId);
        }
      }
    });
  });
};
