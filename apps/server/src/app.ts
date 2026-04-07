import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { DatabaseService } from "./lib/db.js";
import { NoopIrcBridge } from "./lib/ircBridge.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { threadRoutes } from "./routes/threads.js";
import { websocketRoutes } from "./routes/ws.js";
import { notificationRoutes } from "./routes/notifications.js";
import { roomRoutes } from "./routes/rooms.js";
import { embedRoutes } from "./routes/embeds.js";
import { whisperRoutes } from "./routes/whispers.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  const dbPath = process.env.DB_PATH ?? "./data/starbyte.db";
  const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  const jwtSecret = process.env.JWT_SECRET ?? "change-me-now";

  const db = new DatabaseService(dbPath);
  db.init();

  const ircBridge = new NoopIrcBridge(app.log);

  app.decorate("db", db);
  app.decorate("ircBridge", ircBridge);
  app.decorate("wsClients", new Map());

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = new Set([
        clientOrigin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://tauri.localhost",
        "https://tauri.localhost"
      ]);

      callback(null, allowed.has(origin));
    },
    credentials: true
  });

  await app.register(jwt, {
    secret: jwtSecret
  });

  await app.register(websocket);
  await registerAuthPlugin(app);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(roomRoutes, { prefix: "/api" });
  await app.register(threadRoutes, { prefix: "/api" });
  await app.register(websocketRoutes);
  await app.register(notificationRoutes, { prefix: "/api/notifications" });
  await app.register(embedRoutes, { prefix: "/api" });
  await app.register(whisperRoutes, { prefix: "/api" });


  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}
