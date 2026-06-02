import type {FastifyPluginAsync, FastifyReply, FastifyRequest} from "fastify";
import { z } from "zod";
const createRoomSchema = z.object({
    name: z.string().min(1).max(60),
});

const joinRoomSchema = z.object({
    roomPass: z.string().min(1).max(64)
});

function normalizeRoomPass(input: string) {
    return input.trim().replace(/^starbyte:\/\//i, "");
}

function generateRoomPass() {
    const part = () => Math.floor(1000 + Math.random() * 9000).toString();
    return `${part()}-${part()}`;
}

export const roomRoutes: FastifyPluginAsync = async (app) => {
    async function requireHostedRoom(request: FastifyRequest, reply: FastifyReply) {
        const parsed = z.object({
            roomId: z.string()
        }).safeParse(request.params);

        if (!parsed.success) {
            reply.code(400).send({ error: "invalid room id" });
            return null;
        }

        const room = app.db.getRoomById(parsed.data.roomId);

        if (!room) {
            reply.code(404).send({ error: "room not found" });
            return null;
        }

        if (room.hostUserId !== request.currentUser!.id) {
            reply.code(403).send({ error: "forbidden" });
            return null;
        }

        return room;
    }

    app.get("/rooms", {
        preHandler: app.authenticate
    }, async (request) => {
        return {
            rooms: app.db.listRoomsForUser(request.currentUser!.id)
        };
    });

    app.post("/rooms", {
        preHandler: app.authenticate,
        config: {
            rateLimit: { max: 10, timeWindow: "1 hour" }
        }
    }, async (request, reply) => {
        const parsed = createRoomSchema.safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({
                error: "invalid payload",
                issues: parsed.error.flatten()
            });
        }

        const room = app.db.createRoom({
            name: parsed.data.name.trim(),
            slug: null,
            hostUserId: request.currentUser!.id,
        });

        return { room };
    });

    app.get("/rooms/:roomId/users", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const parsed = z.object({
            roomId: z.string()
        }).safeParse(request.params);

        if (!parsed.success) {
            return reply.code(400).send({ error: "invalid room id" });
        }

        if (!app.db.isRoomMember(parsed.data.roomId, request.currentUser!.id)) {
            return reply.code(403).send({ error: "forbidden" });
        }

        return {
            users: app.db.listUsersForRoom(parsed.data.roomId)
        };
    });

    app.post("/rooms/join", {
        preHandler: app.authenticate,
        config: {
            rateLimit: { max: 20, timeWindow: "1 minute" }
        }
    }, async (request, reply) => {
        const parsed = joinRoomSchema.safeParse(request.body);

        if (!parsed.success) {
            return reply.code(400).send({
                error: "invalid payload",
                issues: parsed.error.flatten()
            });
        }

        const normalizedRoomPass = normalizeRoomPass(parsed.data.roomPass);
        const room = app.db.findRoomByRoomPass(normalizedRoomPass);

        if (!room) {
            return reply.code(404).send({ error: "invalid room pass" });
        }

        app.db.addMemberToRoom(room.id, request.currentUser!.id, "member");

        return { room };
    });

    app.post("/rooms/:roomId/pass", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const room = await requireHostedRoom(request, reply);
        if (!room) return;

        let code = generateRoomPass();
        while (app.db.findRoomByRoomPass(code)) {
            code = generateRoomPass();
        }

        app.db.setRoomPass(room.id, code);

        return {
            roomPass: `starbyte://${code}`
        };
    });

    app.patch("/rooms/:roomId", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const params = z.object({ roomId: z.string() }).safeParse(request.params);
        const body = z.object({
            iconUrl: z.string().max(500).optional().nullable()
        }).safeParse(request.body);

        if (!params.success || !body.success) {
            return reply.code(400).send({ error: "invalid payload" });
        }

        const room = app.db.getRoomById(params.data.roomId);
        if (!room) {
            return reply.code(404).send({ error: "room not found" });
        }

        if (room.hostUserId !== request.currentUser!.id) {
            return reply.code(403).send({ error: "forbidden" });
        }

        app.db.setRoomIcon(room.id, body.data.iconUrl || null);

        return { ok: true as const };
    });

    app.delete("/rooms/:roomId/pass", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const room = await requireHostedRoom(request, reply);
        if (!room) return;

        app.db.setRoomPass(room.id, null);
        return { ok: true as const };
    });

    app.delete("/rooms/:roomId", {
        preHandler: app.authenticate
    }, async (request, reply) => {
        const room = await requireHostedRoom(request, reply);
        if (!room) return;

        app.db.setRoomPass(room.id, null);
        app.db.deleteRoom(room.id);
        return { ok: true as const };
    });
};
