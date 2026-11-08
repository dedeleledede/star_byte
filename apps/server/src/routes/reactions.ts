import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { emitToUsers } from "../lib/realtime.js";

const addReactionSchema = z.object({
    emoji: z.string().min(1).max(10)
});

export const reactionRoutes: FastifyPluginAsync = async (app) => {
    function emitToThreadMembers(threadId: string, type: string, data: unknown) {
        emitToUsers(
            app,
            app.db.listMembersForThread(threadId).map((member) => member.id),
            type,
            data
        );
    }

    app.post("/threads/:threadId/messages/:messageId/reactions", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const params = z.object({
            threadId: z.string(),
            messageId: z.string()
        }).safeParse(request.params);
        if (!params.success) {
            return reply.code(400).send({ error: "invalid params" });
        }
        const parsed = addReactionSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
        }
        if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
            return reply.code(403).send({ error: "forbidden" });
        }
        const message = app.db.getMessageById(params.data.messageId);
        if (!message || message.threadId !== params.data.threadId) {
            return reply.code(404).send({ error: "message not found" });
        }
        const reaction = app.db.addReaction({
            messageId: params.data.messageId,
            userId: request.currentUser!.id,
            emoji: parsed.data.emoji
        });
        if (!reaction) {
            return reply.code(409).send({ error: "reaction already exists" });
        }
        emitToThreadMembers(params.data.threadId, "reaction.added", { ...reaction, threadId: params.data.threadId });
        return { reaction };
    });

    app.delete("/threads/:threadId/messages/:messageId/reactions/:emoji", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const params = z.object({
            threadId: z.string(),
            messageId: z.string(),
            emoji: z.string().min(1).max(10)
        }).safeParse(request.params);
        if (!params.success) {
            return reply.code(400).send({ error: "invalid params" });
        }
        if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
            return reply.code(403).send({ error: "forbidden" });
        }
        const message = app.db.getMessageById(params.data.messageId);
        if (!message || message.threadId !== params.data.threadId) {
            return reply.code(404).send({ error: "message not found" });
        }
        app.db.removeReaction({
            messageId: params.data.messageId,
            userId: request.currentUser!.id,
            emoji: params.data.emoji
        });
        emitToThreadMembers(params.data.threadId, "reaction.removed", {
            messageId: params.data.messageId,
            userId: request.currentUser!.id,
            emoji: params.data.emoji,
            threadId: params.data.threadId
        });
        return { ok: true };
    });

    app.get("/threads/:threadId/messages/:messageId/reactions", {
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
        const message = app.db.getMessageById(params.data.messageId);
        if (!message || message.threadId !== params.data.threadId) {
            return reply.code(404).send({ error: "message not found" });
        }
        const reactions = app.db.getReactionsForMessage(params.data.messageId);
        return { reactions };
    });

    app.get("/threads/:threadId/messages/reactions", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const params = z.object({
            threadId: z.string()
        }).safeParse(request.params);
        if (!params.success) {
            return reply.code(400).send({ error: "threadId is required" });
        }
        const query = z.object({
            messageIds: z.string()
        }).safeParse(request.query);
        if (!query.success) {
            return reply.code(400).send({ error: "messageIds is required" });
        }
        if (!app.db.canAccessThread(params.data.threadId, request.currentUser!.id)) {
            return reply.code(403).send({ error: "forbidden" });
        }
        const messageIds = query.data.messageIds.split(",").filter(Boolean);
        const reactions = app.db.getReactionsForMessages(messageIds);
        return { reactions };
    });
};