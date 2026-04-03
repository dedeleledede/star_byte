import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const whisperRoutes: FastifyPluginAsync = async (app) => {
    app.get("/whispers", {
        preHandler: app.authenticate
    }, async (request) => {
        return {
            threads: app.db.listWhispersForUser(request.currentUser!.id)
        };
    });

    app.post("/whispers", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const parsed = z.object({
            targetUserId: z.string()
        }).safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({
                error: "invalid payload",
                issues: parsed.error.flatten()
            });
        }

        if (parsed.data.targetUserId === request.currentUser!.id) {
            return reply.code(400).send({ error: "cannot whisper yourself" });
        }

        const target = app.db.findUserById(parsed.data.targetUserId);
        if (!target) {
            return reply.code(404).send({ error: "target user not found" });
        }

        const existing = app.db.findWhisperBetweenUsers(
            request.currentUser!.id,
            parsed.data.targetUserId
        );

        if (existing) {
            return { thread: existing };
        }

        const thread = app.db.createWhisper({
            creatorId: request.currentUser!.id,
            targetUserId: parsed.data.targetUserId
        });

        return { thread };
    });
};