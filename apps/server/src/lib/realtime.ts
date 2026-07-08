import type { FastifyInstance } from "fastify";

export function emitToUsers(app: FastifyInstance, userIds: string[], type: string, data: unknown) {
  const payload = JSON.stringify({ type, data });

  for (const userId of new Set(userIds)) {
    for (const socket of app.wsClients.get(userId) ?? []) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
    }
  }
}

export function emitToRoomMembers(app: FastifyInstance, roomId: string, type: string, data: unknown) {
  emitToUsers(
    app,
    app.db.listUsersForRoom(roomId).map((member) => member.id),
    type,
    data
  );
}

export function emitToAllConnectedUsers(app: FastifyInstance, type: string, data: unknown) {
  emitToUsers(app, [...app.wsClients.keys()], type, data);
}
