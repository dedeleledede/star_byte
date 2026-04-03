import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const notificationRoutes: FastifyPluginAsync = async (app) => {
    app.get("/mentions", {
        preHandler: app.authenticate
    }, async (request) => {
        return {
            notifications: app.db.listMentionNotificationsForUser(request.currentUser!.id)
        };
    });

    app.post("/mentions/read", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const parsed = z.object({
            threadId: z.string()
        }).safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({ error: "invalid payload", issues: parsed.error.flatten() });
        }

        app.db.markMentionNotificationsRead({
            userId: request.currentUser!.id,
            threadId: parsed.data.threadId
        });

        return { ok: true as const };
    });
};