import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
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
import { uploadRoutes } from "./routes/uploads.js";
import { desktopUpdateRoutes } from "./routes/desktopUpdates.js";

export async function buildApp() {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const app = Fastify({
    logger: true,
    trustProxy
  });

  const dbPath = process.env.DB_PATH ?? "./data/starbyte.db";
  const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  const jwtSecret = process.env.JWT_SECRET ?? "change-me-now";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && (!process.env.DB_PATH || !process.env.CLIENT_ORIGIN || !process.env.JWT_SECRET || jwtSecret === "change-me-now")) {
    throw new Error("Production requires DB_PATH, CLIENT_ORIGIN, and a non-default JWT_SECRET.");
  }

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
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost"
      ]);

      if (!isProduction) {
        allowed.add("http://localhost:5173");
        allowed.add("http://127.0.0.1:5173");
      }

      callback(null, allowed.has(origin));
    },

    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    credentials: true
  });

  await app.register(jwt, {
    secret: jwtSecret
  });

  await app.register(rateLimit, {
    global: false
  });

  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1
    }
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
  await app.register(uploadRoutes, { prefix: "/api" });
  await app.register(desktopUpdateRoutes, { prefix: "/api" });


  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}
