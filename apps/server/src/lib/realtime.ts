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

export function revokeSessionSockets(app: FastifyInstance, sessionIds: string[]) {
  for (const sessionId of new Set(sessionIds)) {
    const sockets = app.wsSessionClients.get(sessionId);
    if (!sockets) continue;

    const payload = JSON.stringify({
      type: "session.revoked",
      data: { sessionId }
    });

    for (const socket of [...sockets]) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
      if (typeof socket.close === "function") {
        socket.close(4001, "session revoked");
      }
    }

    app.wsSessionClients.delete(sessionId);
  }
}
