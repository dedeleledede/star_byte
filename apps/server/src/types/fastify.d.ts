import "fastify";
import "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { DatabaseService, SafeUser } from "../lib/db.js";
import type { IrcBridge } from "../lib/ircBridge.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      username: string;
      sid: string;
    };
    user: {
      sub: string;
      username: string;
      sid: string;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseService;
    ircBridge: IrcBridge;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    wsClients: Map<string, Set<WebSocket>>;
    wsSessionClients: Map<string, Set<WebSocket>>;
  }

  interface FastifyRequest {
    currentUser?: SafeUser;
    currentSessionId?: string;
  }
}
