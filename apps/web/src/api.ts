export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  statusText: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  kind: "text" | "whisper";
  title: string;
  slug: string | null;
  createdBy: string | null;
  isPrivate: number;
  roomId: string | null;
  createdAt: string;
}

export interface ThreadMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MentionNotification {
  id: string;
  threadId: string;
  messageId: string;
  mentionedByUserId: string;
  mentionedByUsername: string;
  mentionedByDisplayName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface Message {
  id: string;
  threadId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  replyToMessageId: string | null;
  editedAt: string | null;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  hostUserId: string;
  createdAt: string;
  roomPass: string | null;
  iconUrl: string | null;
}

export interface RoomUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  statusText: string | null;
  createdAt: string;
}

export interface LinkEmbed {
  url: string;
  siteName: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  embedUrl: string | null;
  embedType: "generic" | "video" | "rich";
  provider: string | null;
}

const TOKEN_KEY = "star_byte.token";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";
const REQUEST_TIMEOUT_MS = 30000;

function apiUrl(path: string) {return `${API_BASE_URL}${path}`;}

export function mediaUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("/api/uploads/") ? apiUrl(url) : url;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {})
  };

  const hasBody = init?.body !== undefined && init?.body !== null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (hasBody && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const url = apiUrl(path);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";

    if ((import.meta as any).env?.DEV) {
      console.warn("[star_byte] API request failed before HTTP response", {
        url,
        method: init?.method ?? "GET",
        origin: window.location.origin,
        apiBaseUrl: API_BASE_URL || "(same-origin)",
        kind: isAbort ? "timeout" : "network-or-cors",
        message: error instanceof Error ? error.message : String(error)
      });
    }

    if (isAbort) {
      throw new Error("O servidor demorou para responder. Tente novamente.");
    }

    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();

  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event("star_byte-auth-invalid"));
    }

    const errorCode = typeof data?.error === "string" ? data.error : "";
    const userMessages: Record<string, string> = {
      "invalid credentials": "Usuário ou senha incorretos.",
      "invalid payload": "Preencha os campos corretamente.",
      "username already taken": "Este nome de usuário já está em uso.",
      "forbidden": "Você não tem permissão para fazer isso.",
      "room not found": "Room não encontrada.",
      "invalid room pass": "Room Pass inválido ou expirado.",
      "thread not found": "Thread não encontrada.",
      "message not found": "Mensagem não encontrada.",
      "invalid reply target": "A mensagem respondida não está mais disponível.",
      "roomId is required": "Escolha uma Room antes de criar uma Thread.",
      "cannot whisper yourself": "Você não pode iniciar um Whisper consigo mesmo.",
      "target user not found": "Usuário não encontrado.",
      "image required": "Escolha uma imagem para enviar.",
      "invalid image type": "Envie uma imagem PNG, JPG, GIF ou WebP.",
      "image too large": "A imagem deve ter no máximo 5 MB."
    };

    if (response.status >= 500) {
      throw new Error("Ocorreu um erro interno. Tente novamente em instantes.");
    }

    if (response.status === 429) {
      throw new Error("Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.");
    }

    throw new Error(userMessages[errorCode] ?? "Não foi possível concluir a operação.");
  }

  return data as T;
}

export function registerUser(input: { username: string; displayName: string; password: string }) {
  return request<{ token: string; user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function loginUser(input: { username: string; password: string }) {
  return request<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchMe() {
  return request<{ user: User }>("/api/auth/me");
}

export function fetchUsers() {
  return request<{ users: User[] }>("/api/users");
}

export function updateMe(input: {
  displayName: string;
  avatarUrl: string;
  bio: string;
  statusText: string;
}) {
  return request<{ user: User }>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);

  return request<{ url: string }>("/api/uploads/images", {
    method: "POST",
    body: formData
  });
}

export function fetchThreads(roomId: string) {
  return request<{ threads: Thread[] }>(`/api/threads?roomId=${encodeURIComponent(roomId)}`);
}

export function createTextThread(input: { title: string; roomId: string }) {
  return request<{ thread: Thread }>("/api/threads", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      roomId: input.roomId
    })
  });
}

export function fetchMessages(threadId: string) {
  return request<{ messages: Message[] }>(`/api/threads/${threadId}/messages`);
}

export function sendMessage(threadId: string, input: { body: string; replyToMessageId?: string | null }) {
  return request<{ message: Message }>(`/api/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateMessage(threadId: string, messageId: string, input: { body: string }) {
  return request<{ message: Message }>(`/api/threads/${threadId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteMessage(threadId: string, messageId: string) {
  return request<{ ok: true }>(`/api/threads/${threadId}/messages/${messageId}`, {
    method: "DELETE"
  });
}

export function fetchThreadMembers(threadId: string) {
  return request<{ members: ThreadMember[] }>(`/api/threads/${threadId}/members`);
}

export function fetchMentionNotifications() {
  return request<{ notifications: MentionNotification[] }>("/api/notifications/mentions");
}

export function markMentionNotificationsRead(threadId: string) {
  return request<{ ok: true }>("/api/notifications/mentions/read", {
    method: "POST",
    body: JSON.stringify({ threadId })
  });
}

export function fetchRooms() {
  return request<{ rooms: Room[] }>("/api/rooms");
}

export function createRoom(input: {
  name: string;
  description?: string;
}) {
  return request<{ room: Room }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? ""
    })
  });
}

export function joinRoom(input: {
  roomPass: string;
}) {
  return request<{ room: Room }>("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function fetchRoomUsers(roomId: string) {
  return request<{ users: RoomUser[] }>(`/api/rooms/${roomId}/users`);
}

export function generateRoomPass(roomId: string) {
  return request<{ roomPass: string }>(`/api/rooms/${roomId}/pass`, {
    method: "POST"
  });
}

export function deleteRoomPass(roomId: string) {
  return request<{ ok: true }>(`/api/rooms/${roomId}/pass`, {
    method: "DELETE"
  });
}

export function deleteRoom(roomId: string) {
  return request<{ ok: true }>(`/api/rooms/${roomId}`, {
    method: "DELETE"
  });
}

export function deleteThread(threadId: string) {
  return request<{ ok: true }>(`/api/threads/${threadId}`, {
    method: "DELETE"
  });
}

export function updateRoom(roomId: string, input: { iconUrl?: string | null }) {
  return request<{ ok: true }>(`/api/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function fetchEmbed(url: string) {
  return request<{ embed: LinkEmbed }>(`/api/embeds?url=${encodeURIComponent(url)}`);
}

export function fetchWhispers() {
  return request<{ threads: Thread[] }>("/api/whispers");
}

export function createWhisper(input: { targetUserId: string }) {
  return request<{ thread: Thread }>("/api/whispers", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
