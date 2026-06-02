import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const createThreadSchema = z.object({
  title: z.string().min(1).max(60),
  roomId: z.string().uuid()
});

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  replyToMessageId: z.string().uuid().optional().nullable()
});

const updateMessageSchema = z.object({
  body: z.string().min(1).max(4000)
});

function extractMentionUsernames(body: string) {
  const matches = body.match(/@([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map((item) => item.slice(1).toLowerCase()))];
}

export const threadRoutes: FastifyPluginAsync = async (app) => {
  function emitToUsers(userIds: string[], type: string, data: unknown) {
    const payload = JSON.stringify({ type, data });

    for (const userId of new Set(userIds)) {
      for (const socket of app.wsClients.get(userId) ?? []) {
        if (socket.readyState === 1) {
          socket.send(payload);
        }
      }
    }
  }

  function emitToThreadMembers(threadId: string, type: string, data: unknown) {
    emitToUsers(
      app.db.listMembersForThread(threadId).map((member) => member.id),
      type,
      data
    );
  }

  app.get("/users", {
    preHandler: app.authenticate
  }, async () => {
    return {
      users: app.db.listUsers()
    };
  });

  app.get("/threads", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const parsed = z.object({
      roomId: z.string().uuid()
    }).safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({ error: "roomId is required" });
    }

    if (!app.db.isRoomMember(parsed.data.roomId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      threads: app.db.listThreadsForRoom(request.currentUser!.id, parsed.data.roomId)
    };
  });

  app.post("/threads", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const parsed = createThreadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
    }

    if (!app.db.isRoomMember(parsed.data.roomId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const thread = app.db.createThread({
      title: parsed.data.title,
      creatorId: request.currentUser!.id,
      roomId: parsed.data.roomId
    });

    return { thread };
  });

  app.get("/threads/:threadId/messages", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid thread id" });
    }

    const limit = Number((request.query as { limit?: string }).limit ?? 50);

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      messages: app.db.listMessages(params.data.threadId, limit).reverse()
    };
  });

  app.patch("/threads/:threadId/messages/:messageId", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string(),
      messageId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid params" });
    }

    const parsed = updateMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
    }

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const existing = app.db.getMessageById(params.data.messageId);

    if (!existing || existing.threadId !== params.data.threadId) {
      return reply.code(404).send({ error: "message not found" });
    }

    if (existing.userId !== request.currentUser!.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const message = app.db.updateMessage({
      messageId: existing.id,
      body: parsed.data.body
    });

    app.db.deleteMentionNotificationsForMessage(existing.id);

    const mentionedUsernames = extractMentionUsernames(parsed.data.body);

    if (mentionedUsernames.length > 0) {
      const members = app.db.listMembersForThread(params.data.threadId);
      const matchedUserIds = members
          .filter((member) => mentionedUsernames.includes(member.username.toLowerCase()))
          .map((member) => member.id)
          .filter((id) => id !== request.currentUser!.id);

      if (matchedUserIds.length > 0) {
        app.db.createMentionNotifications({
          threadId: params.data.threadId,
          messageId: message!.id,
          mentionedByUserId: request.currentUser!.id,
          mentionedUserIds: [...new Set(matchedUserIds)]
        });
        emitToUsers(matchedUserIds, "mention.created", { threadId: params.data.threadId });
      }
    }

    emitToThreadMembers(params.data.threadId, "message.updated", message);
    return { message };
  });

  app.post("/threads/:threadId/messages", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid thread id" });
    }

    const parsed = createMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
    }

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    if (parsed.data.replyToMessageId) {
      const repliedTo = app.db.getMessageById(parsed.data.replyToMessageId);
      if (!repliedTo || repliedTo.threadId !== params.data.threadId) {
        return reply.code(400).send({ error: "invalid reply target" });
      }
    }

    const message = app.db.createMessage({
      threadId: params.data.threadId,
      userId: request.currentUser!.id,
      body: parsed.data.body,
      replyToMessageId: parsed.data.replyToMessageId ?? null
    });

    const mentionedUsernames = extractMentionUsernames(parsed.data.body);

    if (mentionedUsernames.length > 0) {
      const members = app.db.listMembersForThread(params.data.threadId);
      const matchedUserIds = members
          .filter((member) => mentionedUsernames.includes(member.username.toLowerCase()))
          .map((member) => member.id)
          .filter((id) => id !== request.currentUser!.id);

      if (matchedUserIds.length > 0) {
        app.db.createMentionNotifications({
          threadId: params.data.threadId,
          messageId: message.id,
          mentionedByUserId: request.currentUser!.id,
          mentionedUserIds: [...new Set(matchedUserIds)]
        });
        emitToUsers(matchedUserIds, "mention.created", { threadId: params.data.threadId });
      }
    }

    emitToThreadMembers(params.data.threadId, "message.created", message);
    return { message };
  });

  app.delete("/threads/:threadId/messages/:messageId", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string(),
      messageId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid params" });
    }

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const existing = app.db.getMessageById(params.data.messageId);

    if (!existing || existing.threadId !== params.data.threadId) {
      return reply.code(404).send({ error: "message not found" });
    }

    if (existing.userId !== request.currentUser!.id) {
      return reply.code(403).send({ error: "forbidden" });
    }

    app.db.deleteMentionNotificationsForMessage(existing.id);
    app.db.deleteMessage(existing.id);
    emitToThreadMembers(params.data.threadId, "message.deleted", {
      threadId: params.data.threadId,
      messageId: existing.id
    });

    return { ok: true as const };
  });

  app.get("/threads/:threadId/members", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const params = z.object({
      threadId: z.string()
    }).safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "invalid thread id" });
    }

    if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
      return reply.code(403).send({ error: "not a member of this thread" });
    }

    return {
      members: app.db.listMembersForThread(params.data.threadId)
    };
  });

  app.delete("/threads/:threadId", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const parsed = z.object({
      threadId: z.string()
    }).safeParse(request.params);

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid thread id" });
    }

    const thread = app.db.getThreadById(parsed.data.threadId);
    if (!thread) {
      return reply.code(404).send({ error: "thread not found" });
    }

    if (!thread.roomId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const room = app.db.getRoomById(thread.roomId);
    const mayDelete = room?.hostUserId === request.currentUser!.id ||
      thread.createdBy === request.currentUser!.id;

    if (!mayDelete) {
      return reply.code(403).send({ error: "forbidden" });
    }

    emitToThreadMembers(thread.id, "thread.deleted", {
      threadId: thread.id,
      roomId: thread.roomId
    });
    app.db.deleteThread(thread.id);
    return { ok: true as const };
  });
};
