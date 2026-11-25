import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, setToken, type Message, type PinnedMessage, type User, type Reaction } from "../api";

const WS_BASE_URL = (import.meta as any).env?.VITE_WS_BASE_URL?.replace(/\/+$/, "") || "";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

function wsUrl(path: string) {
  if (WS_BASE_URL) return `${WS_BASE_URL}${path}`;
  if (API_BASE_URL) return `${API_BASE_URL.replace(/^http/, "ws")}${path}`;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export function useSocket(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    if (!token) return;

    const socket = new WebSocket(
        wsUrl(`/ws?token=${encodeURIComponent(token)}`)
    );

    const handleRevokedSession = () => {
      setToken(null);
      queryClient.clear();
      window.dispatchEvent(new Event("starbyte-auth-invalid"));
    };

    socket.onmessage = (event) => {
      if (event.data === "pong") return;

      let payload: { type?: string; data?: unknown };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "session.revoked") {
        handleRevokedSession();
        return;
      }

      if (payload.type === "sessions.updated") {
        void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }

      if (payload.type === "message.created") {
        const message = payload.data as Message;

        queryClient.setQueryData<Message[]>(
            ["messages", message.threadId],
            (current = []) => {
              const exists = current.some((item) => item.id === message.id);
              return exists ? current : [...current, message];
            }
        );
      }

      if (payload.type === "message.updated") {
        const message = payload.data as Message;

        queryClient.setQueryData<Message[]>(
            ["messages", message.threadId],
            (current = []) => current.map((item) => item.id === message.id ? message : item)
        );

        queryClient.setQueryData<PinnedMessage[]>(
          ["pinned-messages", message.threadId],
          (current) =>
            current?.map((item) =>
              item.messageId === message.id
                ? { ...item, body: message.body, editedAt: message.editedAt }
                : item
            )
        );
      }

      if (payload.type === "message.deleted") {
        const data = payload.data as { threadId: string; messageId: string };

        queryClient.setQueryData<Message[]>(
            ["messages", data.threadId],
            (current = []) => current.filter((item) => item.id !== data.messageId)
        );

        queryClient.setQueryData<PinnedMessage[]>(
          ["pinned-messages", data.threadId],
          (current) => current?.filter((item) => item.messageId !== data.messageId)
        );
      }

      if (payload.type === "message.pinned") {
        const data = payload.data as { threadId: string; messageId: string; pin: PinnedMessage };

        queryClient.setQueryData<Message[]>(
          ["messages", data.threadId],
          (current) =>
            current?.map((item) =>
              item.id === data.messageId
                ? { ...item, pinnedAt: data.pin.pinnedAt, pinnedByUserId: data.pin.pinnedByUserId }
                : item
            )
        );

        queryClient.setQueryData<PinnedMessage[]>(
          ["pinned-messages", data.threadId],
          (current) => {
            const list = current ?? [];
            return list.some((item) => item.messageId === data.messageId)
              ? list
              : [data.pin, ...list];
          }
        );
      }

      if (payload.type === "message.unpinned") {
        const data = payload.data as { threadId: string; messageId: string };

        queryClient.setQueryData<Message[]>(
          ["messages", data.threadId],
          (current) =>
            current?.map((item) =>
              item.id === data.messageId
                ? { ...item, pinnedAt: null, pinnedByUserId: null }
                : item
            )
        );

        queryClient.setQueryData<PinnedMessage[]>(
          ["pinned-messages", data.threadId],
          (current) => current?.filter((item) => item.messageId !== data.messageId)
        );
      }

      if (payload.type === "mention.created") {
        void queryClient.invalidateQueries({ queryKey: ["mention-notifications"] });
      }

      if (payload.type === "thread.deleted") {
        const data = payload.data as { threadId: string; roomId: string };
        void queryClient.invalidateQueries({ queryKey: ["threads", data.roomId] });
        queryClient.removeQueries({ queryKey: ["messages", data.threadId] });
        queryClient.removeQueries({ queryKey: ["pinned-messages", data.threadId] });
      }

      if (payload.type === "room.members.changed") {
        const data = payload.data as { roomId: string; userId: string };
        void queryClient.invalidateQueries({ queryKey: ["room-users", data.roomId] });
        void queryClient.invalidateQueries({ queryKey: ["thread-members"] });
      }

      if (payload.type === "user.profile.updated") {
        const data = payload.data as { user: User };
        queryClient.setQueryData<{ user: User }>(
          ["me"],
          (current) => current?.user.id === data.user.id ? { user: data.user } : current
        );
        void queryClient.invalidateQueries({ queryKey: ["users"] });
        void queryClient.invalidateQueries({ queryKey: ["room-users"] });
        void queryClient.invalidateQueries({ queryKey: ["thread-members"] });
        void queryClient.invalidateQueries({ queryKey: ["messages"] });
        void queryClient.invalidateQueries({ queryKey: ["pinned-messages"] });
        void queryClient.invalidateQueries({ queryKey: ["mention-notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["whispers"] });
      }

      if (payload.type === "reaction.added") {
        const data = payload.data as Reaction & { threadId: string };

        // Update reactions cache for the specific message
        queryClient.setQueryData<Reaction[]>(
          ["reactions", data.threadId, data.messageId],
          (current = []) => {
            const exists = current.some((item) => item.id === data.id);
            return exists ? current : [...current, data];
          }
        );

        // Also update the batch reactions cache if it exists
        queryClient.setQueryData<Reaction[]>(
          ["reactions-batch", data.threadId],
          (current = []) => {
            const exists = current.some((item) => item.id === data.id);
            return exists ? current : [...current, data];
          }
        );
      }

      if (payload.type === "reaction.removed") {
        const data = payload.data as { threadId: string; messageId: string; userId: string; emoji: string };

        // Update reactions cache for the specific message
        queryClient.setQueryData<Reaction[]>(
          ["reactions", data.threadId, data.messageId],
          (current = []) => current.filter((item) => !(item.userId === data.userId && item.emoji === data.emoji))
        );

        // Also update the batch reactions cache if it exists
        queryClient.setQueryData<Reaction[]>(
          ["reactions-batch", data.threadId],
          (current = []) => current.filter((item) => !(item.userId === data.userId && item.emoji === data.emoji))
        );
      }
    };

    socket.onclose = (event) => {
      if (event.code === 4001) {
        handleRevokedSession();
      }
    };

    const heartbeat = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send("ping");
      }
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      socket.close();
    };
  }, [enabled, queryClient]);
}
