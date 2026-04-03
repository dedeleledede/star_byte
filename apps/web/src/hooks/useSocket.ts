import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getToken, type Message } from "../api";

export function useSocket(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      if (event.data === "pong") return;

      const payload = JSON.parse(event.data);

      if (payload.type === "message.created") {
        const message = payload.data as Message;
        queryClient.setQueryData<Message[]>(["messages", message.chatId], (current = []) => {
          const exists = current.some((item) => item.id === message.id);
          return exists ? current : [...current, message];
        });
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
