import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, type Message } from "../api";

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

    socket.onmessage = (event) => {
      if (event.data === "pong") return;

      const payload = JSON.parse(event.data);

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
      }

      if (payload.type === "message.deleted") {
        const data = payload.data as { threadId: string; messageId: string };

        queryClient.setQueryData<Message[]>(
            ["messages", data.threadId],
            (current = []) => current.filter((item) => item.id !== data.messageId)
        );
      }

      if (payload.type === "mention.created") {
        void queryClient.invalidateQueries({ queryKey: ["mention-notifications"] });
      }

      if (payload.type === "thread.deleted") {
        const data = payload.data as { threadId: string; roomId: string };
        void queryClient.invalidateQueries({ queryKey: ["threads", data.roomId] });
        queryClient.removeQueries({ queryKey: ["messages", data.threadId] });
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
