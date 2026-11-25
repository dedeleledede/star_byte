import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { emitToUsers } from "../lib/realtime.js";

export const pinRoutes: FastifyPluginAsync = async (app) => {
  function emitToThreadMembers(threadId: string, type: string, data: unknown) {
    emitToUsers(
      app,
      app.db.listMembersForThread(threadId).map((member) => member.id),
      type,
      data
    );
  }

  app.get("/threads/:threadId/pins", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid thread id" });
    }

    const thread = app.db.getThreadById(params.data.threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found" });
    }

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      pins: app.db.listPinnedMessages(params.data.threadId)
    };
  });

  app.post("/threads/:threadId/messages/:messageId/pin", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string(),
      messageId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid params" });
    }

    const thread = app.db.getThreadById(params.data.threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found" });
    }

    const userId = request.currentUser!.id;
    if (!app.db.canAccessThread(params.data.threadId, userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    if (!app.db.canPinInThread(params.data.threadId, userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const message = app.db.getMessageById(params.data.messageId);
    if (!message || message.threadId !== params.data.threadId) {
      return reply.code(404).send({ error: "message not found" });
    }

    const { pin, created } = app.db.pinMessage({
      threadId: params.data.threadId,
      messageId: params.data.messageId,
      pinnedByUserId: userId
    });

    if (created) {
      emitToThreadMembers(params.data.threadId, "message.pinned", {
        threadId: params.data.threadId,
        messageId: params.data.messageId,
        pin
      });
    }

    return { pin };
  });

  app.delete("/threads/:threadId/messages/:messageId/pin", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string(),
      messageId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid params" });
    }

    const thread = app.db.getThreadById(params.data.threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found" });
    }

    const userId = request.currentUser!.id;
    if (!app.db.canAccessThread(params.data.threadId, userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    if (!app.db.canPinInThread(params.data.threadId, userId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const message = app.db.getMessageById(params.data.messageId);
    if (!message || message.threadId !== params.data.threadId) {
      return reply.code(404).send({ error: "message not found" });
    }

    const removed = app.db.unpinMessage(params.data.threadId, params.data.messageId);
    if (removed) {
      emitToThreadMembers(params.data.threadId, "message.unpinned", {
        threadId: params.data.threadId,
        messageId: params.data.messageId
      });
    }

    return { ok: true as const };
  });
};
