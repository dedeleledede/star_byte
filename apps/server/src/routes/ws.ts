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
    const token = tokenParse.data.token;

    try {
      const decoded = app.jwt.verify<{ sub: string; username: string }>(token);
      userId = decoded.sub;
    } catch {
      socket.close(1008, "invalid token");
      return;
    }

    const existing = app.wsClients.get(userId) ?? new Set();
    existing.add(socket);
    app.wsClients.set(userId, existing);

    socket.send(JSON.stringify({
      type: "ws.ready",
      data: {
        userId
      }
    }));

    socket.on("message", (chunk) => {
      const text = chunk.toString();
      if (text === "ping") {
        socket.send("pong");
      }
    });

    socket.on("close", () => {
      const sockets = app.wsClients.get(userId);
      if (!sockets) return;

      sockets.delete(socket);
      if (sockets.size === 0) {
        app.wsClients.delete(userId);
      }
    });
  });
};
