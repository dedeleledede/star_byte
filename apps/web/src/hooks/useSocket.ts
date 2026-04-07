import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, type Message } from "../api";

const WS_BASE_URL =
    (import.meta as any).env?.VITE_WS_BASE_URL?.replace(/\/+$/, "") || "";

function wsUrl(path: string) {
  return `${WS_BASE_URL}${path}`;
}

export function useSocket(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    if (!token) return;
    if (!WS_BASE_URL) return;

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