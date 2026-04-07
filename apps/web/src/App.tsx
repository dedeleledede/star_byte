import {
    SyntheticEvent,
    useMemo,
    useState,
    useEffect,
    useRef,
    type MouseEvent as ReactMouseEvent
} from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    fetchMe,
    fetchUsers,
    fetchMessages,
    fetchWhispers,
    fetchThreads,
    fetchThreadMembers,
    fetchMentionNotifications,
    fetchEmbed,

    loginUser,
    registerUser,

    markMentionNotificationsRead,
    sendMessage,

    setToken,
    getToken,

    updateMe,
    updateMessage,

    createWhisper,
    createTextThread,
    createRoom,
    joinRoom,

    type Message,
    type Thread,
    type Room,
    type RoomUser, fetchRooms, fetchRoomUsers, deleteThread, updateRoom, deleteRoom, deleteRoomPass, generateRoomPass, deleteMessage,
    User
} from "./api";
import { useSocket } from "./hooks/useSocket";
import { PwaPrompt } from "./components/PwaPrompt";

const IS_DESKTOP_BUILD = (import.meta as any).env?.VITE_DESKTOP === "true";

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const queryClient = useQueryClient();

    const mutation = useMutation({
          mutationFn: async () => {
              if (mode === "login") {
                  return loginUser({ username, password });
              }

              return registerUser({ username, displayName, password });
        },
        onSuccess: async (data) => {
            setToken(data.token);
            await queryClient.invalidateQueries({ queryKey: ["me"] });
            await queryClient.invalidateQueries({ queryKey: ["threads"] });
            await queryClient.invalidateQueries({ queryKey: ["rooms"]});
            onAuthenticated();
        }
    });

    function handleSubmit(event: SyntheticEvent) {
        event.preventDefault();
        mutation.mutate();
    }

    return (
        <div className="centered">
            <div className="auth-card">
                <h1>star_byte</h1>
                <p className="muted">Private IRC-based community thread</p>

                <div className="mode-toggle">
                  <button
                      type="button"
                      className={`button ${mode === "login" ? "button-primary" : ""}`}
                      onClick={() => setMode("login")}
                  >
                    Login
                  </button>
                  <button
                      type="button"
                      className={`button ${mode === "register" ? "button-primary" : ""}`}
                      onClick={() => setMode("register")}
                  >
                    Register
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="stack">
                    <label className="stack">
                        <span>Username</span>
                        <input value={username} onChange={(event) => setUsername(event.target.value)} required />
                </label>

                {mode === "register" && (
                    <label className="stack">
                        <span>Display name</span>
                        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                    </label>
                )}

                <label className="stack">
                    <span>Password</span>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </label>

                {mutation.error && <p className="error">{(mutation.error as Error).message}</p>}

                <button className="button button-primary" disabled={mutation.isPending}>
                    {mutation.isPending ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>
            </div>
        </div>
    );
}

function avatarInitial(name?: string) {
    return (name?.trim()?.charAt(0) || "?").toUpperCase();
}

function AvatarSquare({displayName, avatarUrl, size = "sm"}: {
    displayName: string;
    avatarUrl?: string | null;
    size?: "sm" | "lg";
}) {return (<div className={`avatar-square avatar-square-${size}`}>
            {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="avatar-image" />
            ) : (
                <span className="avatar-fallback">{avatarInitial(displayName)}</span>
            )}
        </div>);}

function roomInitials(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "???";
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function RoomAvatar({ room }: { room: Room }) {
    return (
        <div className="avatar-square avatar-square-lg room-avatar">
            {room.iconUrl ? (
                <img src={room.iconUrl} alt={room.name} className="avatar-image" />
            ) : (
                <span className="avatar-fallback">{roomInitials(room.name)}</span>
            )}
        </div>
    );
}

function isGroupedWithPrevious(current: { userId: string; createdAt: string }, previous?: { userId: string; createdAt: string }) {
    if (!previous) return false;
    if (previous.userId !== current.userId) return false;

    const currentTime = new Date(current.createdAt).getTime();
    const previousTime = new Date(previous.createdAt).getTime();

    return currentTime - previousTime < 10 * 60 * 1000;
}

function ProfileScreen({   user, displayName, setDisplayName,
                           avatarUrl, setAvatarUrl,
                           bio, setBio, statusText, setStatusText,
                           onBack, onSave, isSaving, error
                       }: {
    user: {
        username: string;
        displayName: string;
        avatarUrl?: string | null;
        bio?: string | null;
        statusText?: string | null;
    };
    displayName: string;
    setDisplayName: (value: string) => void;
    avatarUrl: string;
    setAvatarUrl: (value: string) => void;
    bio: string;
    setBio: (value: string) => void;
    statusText: string;
    setStatusText: (value: string) => void;
    onBack: () => void;
    onSave: (event: SyntheticEvent) => void;
    isSaving: boolean;
    error?: string;
}) {
    return (
        <main className="thread-panel">
            <header className="thread-header">
                <h2>Profile</h2>
                <p className="muted">account settings</p>
            </header>

            <section className="profile-screen">
                <div className="profile-screen-top">
                    <AvatarSquare
                        displayName={displayName || user.displayName}
                        avatarUrl={avatarUrl || user.avatarUrl}
                        size="lg"
                    />

                    <div className="profile-screen-copy">
                        <strong>{user.username}</strong>
                        <div className="muted">@{user.username}</div>
                    </div>
                </div>

                <form className="profile-form" onSubmit={onSave}>
                    <label className="stack">
                        <span>Display name</span>
                        <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                        />
                    </label>

                    <label className="stack">
                        <span>Avatar URL</span>
                        <input
                            value={avatarUrl}
                            onChange={(event) => setAvatarUrl(event.target.value)}
                        />
                    </label>

                    <label className="stack">
                        <span>Status</span>
                        <input
                            value={statusText}
                            onChange={(event) => setStatusText(event.target.value)}
                        />
                    </label>

                    <label className="stack">
                        <span>Bio</span>
                        <textarea
                            value={bio}
                            onChange={(event) => setBio(event.target.value)}
                            rows={6}
                        />
                    </label>

                    {error && <p className="error">{error}</p>}

                    <div className="profile-actions">
                        <button type="button" className="button" onClick={onBack}>
                            Back
                        </button>
                        <button className="button button-primary" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save profile"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}

function ThreadShell({ onLogout, theme, onThemeChange }: { onLogout: () => void; theme: string; onThemeChange: (theme: string) => void; }) {
    const queryClient = useQueryClient();

    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [screen, setScreen] = useState<"thread" | "profile">("thread");

    const [profileDisplayName, setProfileDisplayName] = useState("");
    const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
    const [profileBio, setProfileBio] = useState("");
    const [profileStatusText, setProfileStatusText] = useState("");
    const [selectedUserProfile, setSelectedUserProfile] = useState<RoomUser | null>(null);
    const [sidebarMode, setSidebarMode] = useState<"threads" | "whispers">("threads");

    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    const [roomName, setRoomName] = useState("");
    const [joinRoomPass, setJoinRoomPass] = useState("");
    const [roomOverlayOpen, setRoomOverlayOpen] = useState(false);
    const [roomContextMenu, setRoomContextMenu] = useState<null | { type: "room" | "thread"; id: string; x: number; y: number; }>(null);
    const [messageContextMenu, setMessageContextMenu] = useState<null | { message: Message; x: number; y: number; }>(null);
    const [roomPassPanelRoomId, setRoomPassPanelRoomId] = useState<string | null>(null);
    const [copiedRoomPass, setCopiedRoomPass] = useState(false);
    const [roomIconPanelRoomId, setRoomIconPanelRoomId] = useState<string | null>(null);
    const [roomIconDraft, setRoomIconDraft] = useState("");

    const [newThreadTitle, setNewThreadTitle] = useState("");
    const [roomTooltip, setRoomTooltip] = useState<null | { text: string; x: number; y: number; }>(null);

    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState("");

    const composerRef = useRef<HTMLInputElement | null>(null);
    const messagesRef = useRef<HTMLElement | null>(null);
    const messageRefs = useRef<Record<string, HTMLElement | null>>({});
    const stickToBottomRef = useRef(true);

    const meQuery = useQuery({queryKey: ["me"], queryFn: fetchMe});

    const roomsQuery = useQuery({queryKey: ["rooms"], queryFn: () => fetchRooms().then((data) => data.rooms)});

    const whispersQuery = useQuery({
        queryKey: ["whispers"],
        queryFn: () => fetchWhispers().then((data) => data.threads),
        enabled: Boolean(meQuery.data?.user)
    });

    const usersQuery = useQuery({
        queryKey: ["users"],
        queryFn: () => fetchUsers().then((data) => data.users),
        enabled: Boolean(meQuery.data?.user)
    });

    const rooms = roomsQuery.data ?? [];

    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

    const [selectedThreadByRoom, setSelectedThreadByRoom] = useState<Record<string, string>>({});
    const [activeWhisperId, setActiveWhisperId] = useState<string | null>(null);

    const activeRoom = useMemo(() => rooms.find((room) => room.id === activeRoomId) ?? rooms[0] ?? null, [activeRoomId, rooms]);

    const threadsQuery = useQuery({
        queryKey: ["threads", activeRoomId],
        queryFn: () => fetchThreads(activeRoomId!).then((data) => data.threads),
        enabled: Boolean(activeRoomId),
        refetchInterval: 2000,
        refetchOnWindowFocus: true
    });

    const threads = threadsQuery.data ?? [];

    const roomThreads = threadsQuery.data ?? [];

    const whispers = whispersQuery.data ?? [];

    const activeRoomThreadId = activeRoom?.id ? selectedThreadByRoom[activeRoom.id] ?? null : null;

    const activeThread = useMemo(() => {
        if (sidebarMode === "threads") {
            return roomThreads.find((thread) => thread.id === activeRoomThreadId) ?? roomThreads[0] ?? null;
        }

        return whispers.find((thread) => thread.id === activeWhisperId) ?? whispers[0] ?? null;
    }, [sidebarMode, roomThreads, whispers, activeRoomThreadId, activeWhisperId]);

    const roomUsersQuery = useQuery({
        queryKey: ["room-users", activeRoom?.id],
        queryFn: () => fetchRoomUsers(activeRoom!.id).then((data) => data.users),
        enabled: Boolean(activeRoom?.id)
    });

    const threadMembersQuery = useQuery({
        queryKey: ["thread-members", activeThread?.id],
        queryFn: () => fetchThreadMembers(activeThread!.id).then((data) => data.members),
        enabled: Boolean(activeThread?.id)
    });

    const messagesQuery = useQuery({
        queryKey: ["messages", activeThread?.id],
        queryFn: () => fetchMessages(activeThread!.id).then((data) => data.messages),
        enabled: Boolean(activeThread?.id),
        refetchInterval: 2000,
        refetchOnWindowFocus: true
    });

    const mentionNotificationsQuery = useQuery({
        queryKey: ["mention-notifications"],
        queryFn: () => fetchMentionNotifications().then((data) => data.notifications),
        enabled: Boolean(meQuery.data?.user),
        refetchInterval: 5000
    });

    const unreadMentionCount = (mentionNotificationsQuery.data ?? []).filter((item) => !item.readAt).length;

    const mentionSuggestions = useMemo(() => {
        const members = threadMembersQuery.data ?? [];
        const q = mentionQuery.trim().toLowerCase();

        return members.filter((member) => {
            if (!q) return true;
            return (
                member.username.toLowerCase().includes(q) ||
                member.displayName.toLowerCase().includes(q)
            );
        });
    }, [threadMembersQuery.data, mentionQuery]);

    const usersById = useMemo(() => {
        const entries = (usersQuery.data ?? []).map((user) => [user.id, user] as const);
        return new Map(entries);
    }, [usersQuery.data]);

    const roomPassPanelRoom = useMemo(() => rooms.find((room) => room.id === roomPassPanelRoomId) ?? null, [rooms, roomPassPanelRoomId]);

    const ROOM_PASS_RE = /starbyte:\/\/\d{4}-\d{4}/i;
    const URL_TOKEN_RE = /^https?:\/\/[^\s<]+$/i;
    const EMBED_URL_RE = /\b(?:https?:\/\/[^\s<]+|starbyte:\/\/\d{4}-\d{4})/gi;

    useSocket(Boolean(meQuery.data?.user));
    const [draft, setDraft] = useState("");

    function isNearBottom(element: HTMLElement) {
        return element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    }

    // mutations

    const createWhisperMutation = useMutation({
        mutationFn: async (targetUserId: string) => createWhisper({ targetUserId }),
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["whispers"] });
            openWhisper(data.thread.id);
            setSelectedUserProfile(null);
        }
    });

    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            return updateMe({
                displayName: profileDisplayName,
                avatarUrl: profileAvatarUrl,
                bio: profileBio,
                statusText: profileStatusText
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["me"] });
            setScreen("thread");
        }
    });

    const sendMutation = useMutation({
        mutationFn: async () => {
            if (!activeThread) {
                throw new Error("Pick a thread first");
            }

            return sendMessage(activeThread.id, { body: draft.trim() });
        },
        onSuccess: async (data) => {
            if (!activeThread) return;

            setDraft("");
            setMentionOpen(false);
            setMentionQuery("");
            setMentionStart(null);
            setSelectedMentionIndex(0);

            queryClient.setQueryData(
                ["messages", activeThread.id],
                (current: typeof messagesQuery.data | undefined) => {
                    const list = current ?? [];
                    return [...list, data.message];
                }
            );

            await queryClient.invalidateQueries({
                queryKey: ["messages", activeThread.id]
            });
        }
    });

    const createThreadMutation = useMutation({
        mutationFn: async (title: string) => {
            if (!activeRoomId) throw new Error("Pick a room first");
            return createTextThread({ title, roomId: activeRoomId });
        },
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["threads", activeRoomId] });
            if (activeRoomId) {
                openRoomThread(activeRoomId, data.thread.id);
            }
        }
    });

    const createRoomMutation = useMutation({
        mutationFn: async () => {
            return createRoom({
                name: roomName
            });
        },
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
            setActiveRoomId(data.room.id);
            setRoomName("");
            setRoomOverlayOpen(false);
        }
    });

    const joinRoomMutation = useMutation({
        mutationFn: async (input: { roomPass: string }) => {
            return joinRoom(input);
        },
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
            setActiveRoomId(data.room.id);
            setRoomOverlayOpen(false);
            setJoinRoomPass("");
        }
    });

    const generateRoomPassMutation = useMutation({
        mutationFn: async (roomId: string) => generateRoomPass(roomId)
    });

    const deleteRoomPassMutation = useMutation({
        mutationFn: async (roomId: string) => deleteRoomPass(roomId)
    });

    const deleteRoomMutation = useMutation({
        mutationFn: async (roomId: string) => deleteRoom(roomId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
            setActiveRoomId(null);
        }
    });

    const deleteThreadMutation = useMutation({
        mutationFn: async (threadId: string) => deleteThread(threadId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["threads", activeRoomId] });

            if (sidebarMode === "threads" && activeRoomId) {
                setSelectedThreadByRoom((prev) => {
                    const next = { ...prev };
                    delete next[activeRoomId];
                    return next;
                });
            } else if (sidebarMode === "whispers") {
                setActiveWhisperId(null);
            }
        }
    });

    const updateRoomIconMutation = useMutation({
        mutationFn: async ({ roomId, iconUrl }: { roomId: string; iconUrl: string | null }) =>
            updateRoom(roomId, { iconUrl }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        }
    });

    const updateMessageMutation = useMutation({
        mutationFn: async () => {
            if (!activeThread || !editingMessageId) {
                throw new Error("Pick a message first");
            }

            return updateMessage(activeThread.id, editingMessageId, {
                body: editingDraft.trim()
            });
        },
        onSuccess: async (data) => {
            if (!activeThread) return;

            setEditingMessageId(null);
            setEditingDraft("");

            queryClient.setQueryData(
                ["messages", activeThread.id],
                (current: typeof messagesQuery.data | undefined) => {
                    const list = current ?? [];
                    return list.map((item) => item.id === data.message.id ? data.message : item);
                }
            );

            await queryClient.invalidateQueries({
                queryKey: ["messages", activeThread.id]
            });
        }
    });

    const deleteMessageMutation = useMutation({
        mutationFn: async ({ threadId, messageId }: { threadId: string; messageId: string }) => {
            return deleteMessage(threadId, messageId);
        },
        onSuccess: async (_, vars) => {
            if (!activeThread) return;

            if (editingMessageId === vars.messageId) {
                cancelEditingMessage();
            }

            setMessageContextMenu(null);

            await queryClient.invalidateQueries({
                queryKey: ["messages", activeThread.id]
            });
        }
    });

    // memos

    const validMentionUsernames = useMemo(() => {
        return new Set((threadMembersQuery.data ?? []).map((member) => member.username.toLowerCase()));
    }, [threadMembersQuery.data]);

    const sidePanelUsers = useMemo(() => {
        if (!activeThread) return [] as User[];

        if (sidebarMode === "whispers") {
            return (threadMembersQuery.data ?? []).map((member) => {
                const fullUser = usersById.get(member.id);
                return {
                    id: member.id,
                    username: member.username,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl,
                    bio: fullUser?.bio ?? "",
                    statusText: fullUser?.statusText ?? "",
                    createdAt: fullUser?.createdAt ?? ""
                } satisfies User;
            });
        }

        return (roomUsersQuery.data ?? []).map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio ?? "",
            statusText: user.statusText ?? "",
            createdAt: user.createdAt
        } satisfies User));
    }, [activeThread, sidebarMode, threadMembersQuery.data, usersById, roomUsersQuery.data]);

    // effects

    useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;

    if (stickToBottomRef.current) {
      requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
      });
    }
    }, [messagesQuery.data, activeThread?.id]);

    useEffect(() => {
        if (!activeRoomId && rooms.length > 0) {
            setActiveRoomId(rooms[0].id);
        }
    }, [rooms, activeRoomId]);

    useEffect(() => {
        if (!meQuery.data?.user) return;

        setProfileDisplayName(meQuery.data.user.displayName ?? "");
        setProfileAvatarUrl(meQuery.data.user.avatarUrl ?? "");
        setProfileBio(meQuery.data.user.bio ?? "");
        setProfileStatusText(meQuery.data.user.statusText ?? "");
    }, [meQuery.data?.user]);

    useEffect(() => {
        if (!activeThread?.id) return;

        markMentionNotificationsRead(activeThread.id)
            .then(() => {
                void queryClient.invalidateQueries({ queryKey: ["mention-notifications"] });
            })
            .catch(() => {});
    }, [activeThread?.id, queryClient]);

    useEffect(() => {
        function closeMenus() {
            setRoomContextMenu(null);
            setMessageContextMenu(null);
        }

        window.addEventListener("click", closeMenus);
        return () => window.removeEventListener("click", closeMenus);
    }, []);

    useEffect(() => {
        function isEditableTarget(target: EventTarget | null) {
            if (!(target instanceof HTMLElement)) return false;

            const tag = target.tagName.toLowerCase();
            return (
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                target.isContentEditable
            );
        }

        function handleGlobalTyping(event: KeyboardEvent) {
            if (screen !== "thread") return;
            if (!activeThread) return;
            if (roomOverlayOpen) return;
            if (selectedUserProfile) return;
            if (accountMenuOpen) return;

            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key.length !== 1) return;
            if (isEditableTarget(event.target)) return;

            const composer = composerRef.current;
            if (!composer) return;

            event.preventDefault();
            composer.focus();

            setDraft((current) => current + event.key);
        }

        window.addEventListener("keydown", handleGlobalTyping);
        return () => window.removeEventListener("keydown", handleGlobalTyping);
    }, [screen, activeThread, roomOverlayOpen, selectedUserProfile, accountMenuOpen]);

    useEffect(() => {
        if (sidebarMode !== "threads") return;
        if (!activeRoom?.id) return;
        if (roomThreads.length === 0) return;

        const current = selectedThreadByRoom[activeRoom.id];
        const stillExists = current && roomThreads.some((thread) => thread.id === current);

        if (!stillExists) {
            setSelectedThreadByRoom((prev) => ({
                ...prev,
                [activeRoom.id]: roomThreads[0].id
            }));
        }
    }, [sidebarMode, activeRoom?.id, roomThreads, selectedThreadByRoom]);

    useEffect(() => {
        if (sidebarMode !== "whispers") return;
        if (whispers.length === 0) return;

        const stillExists = activeWhisperId && whispers.some((thread) => thread.id === activeWhisperId);

        if (!stillExists) {
            setActiveWhisperId(whispers[0].id);
        }
    }, [sidebarMode, whispers, activeWhisperId]);

    useEffect(() => {
        setEditingMessageId(null);
        setEditingDraft("");
    }, [activeThread?.id]);

    // functions

    function renderMessageBody(
        body: string,
        currentUsername?: string,
        onJoinRoomPass?: (roomPass: string) => void
    ) {
        const parts = body.split(/(\s+)/);

        return parts.map((part, index) => {
            if (!part.trim()) {
                return <span key={index}>{part}</span>;
            }

            if (ROOM_PASS_RE.test(part)) {
                return (
                    <button
                        key={index}
                        type="button"
                        className="inline-room-pass"
                        onClick={() => onJoinRoomPass?.(part)}
                    >
                        {part}
                    </button>
                );
            }

            if (URL_TOKEN_RE.test(part)) {
                return (
                    <a
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-link"
                    >
                        {part}
                    </a>
                );
            }

            if (!part.startsWith("@")) {
                return <span key={index}>{part}</span>;
            }

            const usernameMatch = part.match(/^@([a-zA-Z0-9_]+)([^a-zA-Z0-9_]*)$/);
            if (!usernameMatch) {
                return <span key={index}>{part}</span>;
            }

            const [, rawUsername, trailing = ""] = usernameMatch;
            const normalizedUsername = rawUsername.toLowerCase();
            const isValidMention = validMentionUsernames.has(normalizedUsername);

            if (!isValidMention) {
                return <span key={index}>{part}</span>;
            }

            const isSelfMention = normalizedUsername === currentUsername?.toLowerCase();

            return (
                <span key={index}>
                <span className={isSelfMention ? "mention mention-self" : "mention"}>
                    @{rawUsername}
                </span>
                    {trailing}
            </span>
            );
        });
    }

    function extractUrls(text: string) {
        return Array.from(new Set(text.match(EMBED_URL_RE) ?? []));
    }

    function MessageEmbed({url, onJoinRoomPass}: {
        url: string;
        onJoinRoomPass: (roomPass: string) => void;
    }) {
        if (ROOM_PASS_RE.test(url)) {
            return <RoomPassEmbed roomPass={url} onJoin={onJoinRoomPass} />;
        }

        const embedQuery = useQuery({
            queryKey: ["embed", url],
            queryFn: () => fetchEmbed(url).then((data) => data.embed),
            staleTime: 1000 * 60 * 10,
            retry: 1
        });

        if (embedQuery.isLoading) {
            return <div className="link-embed muted">Loading preview…</div>;
        }

        const embed = embedQuery.data;
        if (!embed) return null;

        if (embed.embedType === "video" && embed.embedUrl) {
            return (
                <div className="link-embed">
                    <div className="link-embed-top">
                        <div className="link-embed-site">
                            {embed.iconUrl && <img src={embed.iconUrl} alt="" className="embed-icon" />}
                            <span>{embed.siteName ?? embed.provider ?? "Video"}</span>
                        </div>
                    </div>

                    {embed.title && <strong className="link-embed-title">{embed.title}</strong>}
                    {embed.description && <div className="link-embed-desc">{embed.description}</div>}

                    <div className="embed-media">
                        <iframe
                            src={embed.embedUrl}
                            title={embed.title ?? embed.url}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                </div>
            );
        }

        return (
            <a
                className="link-embed"
                href={embed.url}
                target="_blank"
                rel="noreferrer"
            >
                <div className="link-embed-top">
                    <div className="link-embed-site">
                        {embed.iconUrl && <img src={embed.iconUrl} alt="" className="embed-icon" />}
                        <span>{embed.siteName ?? embed.provider ?? new URL(embed.url).hostname}</span>
                    </div>
                </div>

                {embed.title && <strong className="link-embed-title">{embed.title}</strong>}
                {embed.description && <div className="link-embed-desc">{embed.description}</div>}
                {embed.imageUrl && <img src={embed.imageUrl} alt="" className="embed-image" />}
            </a>
        );
    }

    function closeMentionPicker() {
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSelectedMentionIndex(0);
    }

    function updateMentionState(nextValue: string, caret: number) {
        const beforeCaret = nextValue.slice(0, caret);
        const atIndex = beforeCaret.lastIndexOf("@");

        if (atIndex === -1) {
            closeMentionPicker();
            return;
        }

        const query = beforeCaret.slice(atIndex + 1);

        // keep the current "cancel if invalid characters appear after @"
        if (!/^[a-zA-Z0-9_]*$/.test(query)) {
            closeMentionPicker();
            return;
        }

        setMentionOpen(true);
        setMentionQuery(query);
        setMentionStart(atIndex);
        setSelectedMentionIndex(0);
    }

    function insertMention(username: string) {
        if (mentionStart === null) return;

        const input = composerRef.current;
        const caret = input?.selectionStart ?? draft.length;
        const before = draft.slice(0, mentionStart);
        const after = draft.slice(caret);

        const next = `${before}@${username} ${after}`;
        setDraft(next);
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSelectedMentionIndex(0);

        requestAnimationFrame(() => {
            input?.focus();
            const position = (`${before}@${username} `).length;
            input?.setSelectionRange(position, position);
        });
    }
    
    function insertMentionAtCursor(username: string) {
        const input = composerRef.current;
        const selectionStart = input?.selectionStart ?? draft.length;
        const selectionEnd = input?.selectionEnd ?? selectionStart;
        const before = draft.slice(0, selectionStart);
        const after = draft.slice(selectionEnd);
        const mentionText = `${before.length > 0 && !/\s$/.test(before) ? " " : ""}@${username} `;
        const next = `${before}${mentionText}${after}`;

        setDraft(next);
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSelectedMentionIndex(0);

        requestAnimationFrame(() => {
            input?.focus();
            const position = before.length + mentionText.length;
            input?.setSelectionRange(position, position);
        });
    }

    function logout() {
        setToken(null);
        queryClient.clear();
        onLogout();
    }

    function handleSend(event: SyntheticEvent) {
        event.preventDefault();
        if (!draft.trim()) return;

        sendMutation.mutate();
    }

    function handleProfileSave(event: SyntheticEvent) {
        event.preventDefault();
        updateProfileMutation.mutate();
    }

    function handleCreateThread() {
        if (!activeRoomId) return;

        const trimmed = newThreadTitle.trim();
        if (!trimmed) return;

        createThreadMutation.mutate(trimmed, {
            onSuccess: () => {
                setNewThreadTitle("");
            }
        });
    }

    function openRoomThread(roomId: string, threadId: string) {
        setSidebarMode("threads");
        setActiveRoomId(roomId);
        setSelectedThreadByRoom((prev) => ({
            ...prev,
            [roomId]: threadId
        }));
    }

    function openWhisper(threadId: string) {
        setSidebarMode("whispers");
        setActiveWhisperId(threadId);
    }

    function openUserProfileFromId(userId: string) {
        const user = usersById.get(userId);
        if (!user) return;
        setSelectedUserProfile(user);
    }

    function handleChatIdentityClick(userId: string, username: string, shiftKey: boolean) {
        if (shiftKey) {
            insertMentionAtCursor(username);
            return;
        }

        openUserProfileFromId(userId);
    }

    function handleAuthorMouseUp(
        event: ReactMouseEvent<HTMLElement>,
        userId: string,
        username: string
    ) {
        const selection = window.getSelection()?.toString() ?? "";

        if (selection.length > 0) {
            return;
        }

        handleChatIdentityClick(userId, username, event.shiftKey);
    }

    function RoomPassEmbed({roomPass, onJoin}: {
        roomPass: string;
        onJoin: (roomPass: string) => void;
    }) {return (<div className="room-pass-embed">
                    <div className="room-pass-embed-top">
                        <strong>Room Pass</strong>
                        <span className="muted">Invite link</span>
                    </div>

                    <button
                        type="button"
                        className="room-pass-link"
                        onClick={() => onJoin(roomPass)}
                    >
                        {roomPass}
                    </button>

                    <div className="room-pass-embed-actions">
                        <button
                            type="button"
                            className="button button-primary"
                            onClick={() => onJoin(roomPass)}
                        >
                            Join
                        </button>
                    </div>
                </div>);}

    function startEditingMessage(message: Message) {
        setEditingMessageId(message.id);
        setEditingDraft(message.body);

        requestAnimationFrame(() => {
            messageRefs.current[message.id]?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });
    }

    function cancelEditingMessage() {
        setEditingMessageId(null);
        setEditingDraft("");
    }

    async function joinFromRoomPass(roomPass: string) {
        const data = await joinRoomMutation.mutateAsync({ roomPass });
        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        setActiveRoomId(data.room.id);
    }

    if (meQuery.isLoading) {
        return <div className="centered">Loading…</div>;
    }

    return (
        <div className="shell shell-rooms">
            {roomOverlayOpen && (
                <div
                    className="overlay-backdrop"
                    onClick={() => setRoomOverlayOpen(false)}
                >
                    <div
                        className="overlay-panel room-overlay"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="room-overlay-header">
                            <strong>Rooms</strong>
                            <button
                                className="button"
                                type="button"
                                onClick={() => setRoomOverlayOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="room-overlay-grid">
                            <div className="stack">
                                <div className="section-title">Create / Join Room</div>

                                <input
                                    placeholder="Room name"
                                    value={roomName}
                                    onChange={(event) => setRoomName(event.target.value)}
                                />

                                <button
                                    className="button button-primary"
                                    type="button"
                                    onClick={() => createRoomMutation.mutate()}
                                    disabled={createRoomMutation.isPending || !roomName.trim()}
                                >
                                    {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                                </button>

                                <input
                                    placeholder="starbyte://1234-1234"
                                    value={joinRoomPass}
                                    onChange={(event) => setJoinRoomPass(event.target.value)}
                                />

                                <button
                                    className="button"
                                    type="button"
                                    onClick={() => joinRoomMutation.mutate({ roomPass: joinRoomPass })}
                                    disabled={joinRoomMutation.isPending || !joinRoomPass.trim()}
                                >
                                    {joinRoomMutation.isPending ? "Joining..." : "Join Room"}
                                </button>

                                {createRoomMutation.error && (
                                    <p className="error">{(createRoomMutation.error as Error).message}</p>
                                )}

                                {joinRoomMutation.error && (
                                    <p className="error">{(joinRoomMutation.error as Error).message}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-profile">
                        <AvatarSquare
                            displayName={meQuery.data?.user.displayName ?? "?"}
                            avatarUrl={meQuery.data?.user.avatarUrl}
                            size="lg"/>

                    <div className="sidebar-profile-copy">
                    <strong>{meQuery.data?.user.displayName}</strong>
                    <div className="muted">@{meQuery.data?.user.username}</div>
                    {meQuery.data?.user.statusText && (
                    <div className="muted">{meQuery.data.user.statusText}</div>
                    )}
                    </div>

                        <div className="sidebar-header-actions">
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setSidebarMode((value) => value === "threads" ? "whispers" : "threads")}
                                aria-label="Whispers"
                                title="Whispers"
                            >
                                ✉
                            </button>

                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setAccountMenuOpen((value) => !value)}
                                aria-label="Account settings"
                                title="Account settings"
                            >
                                ⚙
                            </button>
                        </div>

                    </div>

                    {unreadMentionCount > 0 && (
                        <div className="mention-badge">
                            {unreadMentionCount} mention{unreadMentionCount === 1 ? "" : "s"}
                        </div>
                    )}

                  {accountMenuOpen && (
                      <div className="account-menu">
                          <label className="stack">
                              <span className="muted">Theme</span>
                              <select value={theme} onChange={(event) => onThemeChange(event.target.value)}>
                                  <option value="dark">Dark</option>
                                  <option value="light">Light</option>
                                  <option value="dracula">Dracula</option>
                                  <option value="deep-forest">Deep Forest</option>
                              </select>
                          </label>

                          <button
                              className="button"
                              type="button"
                              onClick={() => {
                                  setScreen("profile");
                                  setAccountMenuOpen(false);
                              }}
                          >
                              Edit profile
                          </button>

                          <button
                              className="button"
                              type="button"
                              onClick={() => {
                                  setAccountMenuOpen(false);
                                  logout();
                              }}
                          >
                              Logout
                          </button>
                      </div>
                  )}
              </div>

                <div className="section-title">Rooms</div>

                <div className="room-grid-box">
                    <div className="room-grid">
                        {rooms.map((room: Room) => (
                            <button
                                key={room.id}
                                className={`room-card ${activeRoom?.id === room.id ? "room-card-active" : ""}`}
                                onClick={() => {
                                    setSidebarMode("threads");
                                    setActiveRoomId(room.id);
                                }}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    setRoomContextMenu({
                                        type: "room",
                                        id: room.id,
                                        x: event.clientX,
                                        y: event.clientY
                                    });
                                }}
                                onMouseEnter={(event) =>
                                    setRoomTooltip({
                                        text: room.name,
                                        x: event.clientX + 12,
                                        y: event.clientY - 8
                                    })
                                }
                                onMouseMove={(event) =>
                                    setRoomTooltip({
                                        text: room.name,
                                        x: event.clientX + 12,
                                        y: event.clientY - 8
                                    })
                                }
                                onMouseLeave={() => setRoomTooltip(null)}
                            >
                                <RoomAvatar room={room} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="sidebar-tools room-actions room-actions-bottom">
                    <button
                        className="button room-add-button"
                        type="button"
                        onClick={() => setRoomOverlayOpen(true)}
                        title="Create or join room"
                    >
                        +
                    </button>
                </div>

                <div className="section-title">{sidebarMode === "threads" ? "Threads" : "Whispers"}</div>

                {sidebarMode === "threads" ? (
                    <>
                        <div className="thread-list">
                            {threadsQuery.isFetching && threads.length === 0 ? (
                                <div className="muted">Loading threads…</div>
                            ) : threads.length === 0 ? (
                                <div className="muted">No threads in this room yet.</div>
                            ) : (
                                roomThreads.map((thread: Thread) => (
                                    <button
                                        key={thread.id}
                                        className={`thread-item ${activeThread?.id === thread.id ? "thread-item-active" : ""}`}
                                        onClick={() => {
                                            if (!activeRoom?.id) return;
                                            openRoomThread(activeRoom.id, thread.id);
                                        }}
                                        onContextMenu={(event) => {
                                            event.preventDefault();
                                            setRoomContextMenu({
                                                type: "thread",
                                                id: thread.id,
                                                x: event.clientX,
                                                y: event.clientY
                                            });
                                        }}
                                    >
                                        <span>{thread.kind === "whisper" ? "@" : "#"}</span>
                                        <span>{thread.title}</span>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="sidebar-tools stack">
                            <input
                                placeholder={activeRoom ? "New thread" : "Pick a room first"}
                                value={newThreadTitle}
                                onChange={(event) => setNewThreadTitle(event.target.value)}
                                disabled={!activeRoom || createThreadMutation.isPending}
                            />
                            <button
                                className="button"
                                type="button"
                                onClick={handleCreateThread}
                                disabled={!activeRoom || createThreadMutation.isPending || !newThreadTitle.trim()}
                            >
                                {createThreadMutation.isPending ? "Creating..." : "Create Thread"}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="thread-list">
                        {whispersQuery.isFetching && whispers.length === 0 ? (
                            <div className="muted">Loading whispers…</div>
                        ) : whispers.length === 0 ? (
                            <div className="muted">No whispers yet.</div>
                        ) : (
                            whispers.map((thread: Thread) => (
                                <button
                                    key={thread.id}
                                    className={`thread-item ${activeThread?.id === thread.id ? "thread-item-active" : ""}`}
                                    onClick={() => openWhisper(thread.id)}
                                >
                                    <span>@</span>
                                    <span>{thread.title}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

            </aside>

            {screen === "profile" ? (
                <ProfileScreen
                    user={meQuery.data!.user}
                    displayName={profileDisplayName}
                    setDisplayName={setProfileDisplayName}
                    avatarUrl={profileAvatarUrl}
                    setAvatarUrl={setProfileAvatarUrl}
                    bio={profileBio}
                    setBio={setProfileBio}
                    statusText={profileStatusText}
                    setStatusText={setProfileStatusText}
                    onBack={() => setScreen("thread")}
                    onSave={handleProfileSave}
                    isSaving={updateProfileMutation.isPending}
                    error={updateProfileMutation.error ? (updateProfileMutation.error as Error).message : undefined}
                />
            ) : (
                <main className="thread-panel">
                    {!activeThread ? (
                        <>
                            <header className="thread-header">
                                <h2>No thread selected</h2>
                                <p className="muted">pick a room thread or create one</p>
                            </header>

                            <section className="messages">
                                <div className="centered" style={{ minHeight: "100%", padding: "32px" }}>
                                    <div className="stack" style={{ maxWidth: "420px", textAlign: "center" }}>
                                        <strong>No threads available</strong>
                                        <p className="muted">
                                            This room does not have any threads yet.
                                        </p>
                                        <button
                                            className="button button-primary"
                                            type="button"
                                            onClick={handleCreateThread}
                                            disabled={!activeRoom || createThreadMutation.isPending}
                                        >
                                            {createThreadMutation.isPending ? "Creating..." : "Create first thread"}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </>
                    ) : (
                        <>
                            <header className="thread-header">
                                <h2>
                                    {!activeThread
                                        ? "No thread selected"
                                        : sidebarMode === "whispers"
                                            ? activeThread.title
                                            : `${activeThread.title} · ${activeRoom?.name ?? "No room"}`
                                    }
                                </h2>
                                <p className="muted">
                                    {sidebarMode === "whispers"
                                        ? "private whisper"
                                        : activeRoom
                                            ? `room: ${activeRoom.name}`
                                            : "pick a room thread or create one"}
                                </p>
                            </header>

                            <section
                                className="messages"
                                ref={messagesRef}
                                onScroll={(event) => {
                                    stickToBottomRef.current = isNearBottom(event.currentTarget);
                                }}
                            >
                                {(messagesQuery.data ?? []).map((message, index, list) => {
                                    const previous = list[index - 1];
                                    const grouped = isGroupedWithPrevious(message, previous);
                                    const urls = extractUrls(message.body);
                                    const isEditing = editingMessageId === message.id;

                                    return (
                                        <article
                                            key={message.id}
                                            className={[
                                                "message-line",
                                                grouped ? "message-line-grouped" : ""
                                            ].filter(Boolean).join(" ")}
                                        >
                                            {!grouped ? (
                                                <div className="message-main">
                                                    <button
                                                        type="button"
                                                        className="avatar-button"
                                                        onClick={(event) => handleChatIdentityClick(message.userId, message.username, event.shiftKey)}
                                                    >
                                                        <AvatarSquare
                                                            displayName={message.displayName}
                                                            avatarUrl={message.avatarUrl}
                                                            size="sm"
                                                        />
                                                    </button>

                                                    <div className="message-body-block">
                                                        <div className="message-meta">
                                                            <span
                                                                className="message-author-text"
                                                                onMouseUp={(event) => handleAuthorMouseUp(event, message.userId, message.username)}
                                                            >
                                                                <strong>{message.displayName}</strong>
                                                                <span className="muted">@{message.username}</span>
                                                            </span>

                                                            <span className="muted">
                                                                {new Date(message.createdAt).toLocaleTimeString()}
                                                            </span>
                                                        </div>

                                                        <div className="message-text">
                                                            <span className="message-prefix">&gt;</span>
                                                            <div className="stack">
                                                                {isEditing ? (
                                                                    <div className="message-edit-inline">
                                                                        <input
                                                                            value={editingDraft}
                                                                            onChange={(event) => setEditingDraft(event.target.value)}
                                                                            onKeyDown={(event) => {
                                                                                if (event.key === "Escape") {
                                                                                    event.preventDefault();
                                                                                    cancelEditingMessage();
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                        />

                                                                        <div className="message-inline-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="button button-primary"
                                                                                onClick={() => updateMessageMutation.mutate()}
                                                                                disabled={updateMessageMutation.isPending || !editingDraft.trim()}
                                                                            >
                                                                                {updateMessageMutation.isPending ? "Saving..." : "Save"}
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                className="button"
                                                                                onClick={cancelEditingMessage}
                                                                                disabled={updateMessageMutation.isPending}
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <span>{renderMessageBody(message.body, meQuery.data?.user.username, joinFromRoomPass)}</span>

                                                                        {urls.map((url) => (
                                                                            <MessageEmbed
                                                                                key={url}
                                                                                url={url}
                                                                                onJoinRoomPass={joinFromRoomPass}
                                                                            />
                                                                        ))}

                                                                        {message.userId === meQuery.data?.user.id && (
                                                                            <div className="message-inline-actions">
                                                                                <button
                                                                                    type="button"
                                                                                    className="message-inline-action"
                                                                                    onClick={() => startEditingMessage(message)}
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="message-text message-text-grouped">
                                                    <span className="message-prefix">&gt;</span>
                                                    <div className="stack">
                                                        <span>{renderMessageBody(message.body, meQuery.data?.user.username, joinFromRoomPass)}</span>
                                                        {urls.map((url) => (
                                                            <MessageEmbed
                                                                key={url}
                                                                url={url}
                                                                onJoinRoomPass={joinFromRoomPass}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </section>

                            <form className="composer" onSubmit={handleSend}>
                                <input
                                    ref={composerRef}
                                    value={draft}
                                    onChange={(event) => {
                                        const next = event.target.value;
                                        setDraft(next);
                                        updateMentionState(next, event.target.selectionStart ?? next.length);
                                    }}
                                    onKeyDown={(event) => {
                                        if (!mentionOpen || mentionSuggestions.length === 0) return;

                                        if (event.key === "ArrowDown") {
                                            event.preventDefault();
                                            setSelectedMentionIndex((value) =>
                                                Math.min(value + 1, mentionSuggestions.length - 1)
                                            );
                                            return;
                                        }

                                        if (event.key === "ArrowUp") {
                                            event.preventDefault();
                                            setSelectedMentionIndex((value) => Math.max(value - 1, 0));
                                            return;
                                        }

                                        if (event.key === "Enter" || event.key === "Tab") {
                                            event.preventDefault();
                                            insertMention(mentionSuggestions[selectedMentionIndex].username);
                                            return;
                                        }

                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            setMentionOpen(false);
                                            return;
                                        }
                                    }}
                                    placeholder="Write a message"
                                />

                                {mentionOpen && mentionSuggestions.length > 0 && (
                                    <div className="mention-picker">
                                        {mentionSuggestions.map((member, index) => (
                                            <button
                                                key={member.id}
                                                type="button"
                                                className={`mention-option ${index === selectedMentionIndex ? "mention-option-active" : ""}`}
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    insertMention(member.username);
                                                }}
                                            >
                                                <AvatarSquare
                                                    displayName={member.displayName}
                                                    avatarUrl={member.avatarUrl}
                                                    size="sm"
                                                />
                                                <span>@{member.username}</span>
                                                <span className="muted">{member.displayName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button className="button button-primary" disabled={sendMutation.isPending || !activeThread}>
                                    Send
                                </button>
                            </form>
                        </>
                    )}
                </main>
            )}
            {activeThread && (
                <aside className="room-users-panel">
                    <div className="thread-header">
                        <h2>{sidebarMode === "whispers" ? activeThread.title : activeRoom?.name ?? "No room selected"}</h2>
                        <p className="muted">
                            {sidebarMode === "whispers" ? "whisper participants" : "room users"}
                        </p>
                    </div>

                    <div className="room-user-list">
                        {sidePanelUsers.length === 0 ? (
                            <div className="muted">
                                {sidebarMode === "whispers" ? "No whisper participants found." : "No room users found."}
                            </div>
                        ) : (
                            sidePanelUsers.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className="room-user-item"
                                    onClick={() => setSelectedUserProfile(user)}
                                >
                                    <AvatarSquare
                                        displayName={user.displayName}
                                        avatarUrl={user.avatarUrl}
                                        size="sm"
                                    />
                                    <div className="room-user-copy">
                                        <strong>{user.displayName}</strong>
                                        <div className="muted">@{user.username}</div>
                                        {user.statusText && <div className="muted">{user.statusText}</div>}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </aside>
            )}

            {roomTooltip && (
                <div
                    className="floating-tooltip" style={{ left: roomTooltip.x, top: roomTooltip.y }}
                >
                    {roomTooltip.text}
                </div>
            )}

            {roomContextMenu && (
                <div
                    className="context-menu" style={{ left: roomContextMenu.x, top: roomContextMenu.y }}
                >
                    {roomContextMenu.type === "room" ? (
                        <>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => {
                                    setRoomPassPanelRoomId(roomContextMenu.id);
                                    setCopiedRoomPass(false);
                                    setRoomContextMenu(null);
                                }}
                            >
                                Room Pass
                            </button>

                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => {
                                    const room = rooms.find((item) => item.id === roomContextMenu.id);
                                    setRoomIconPanelRoomId(roomContextMenu.id);
                                    setRoomIconDraft(room?.iconUrl ?? "");
                                    setRoomContextMenu(null);
                                }}
                            >
                                Change Room Icon
                            </button>

                            <button
                                type="button"
                                className="context-menu-item context-menu-item-danger"
                                onClick={async () => {
                                    await deleteRoomMutation.mutateAsync(roomContextMenu.id);
                                    setRoomContextMenu(null);
                                }}
                            >
                                Delete Room
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="context-menu-item context-menu-item-danger"
                            onClick={async () => {
                                await deleteThreadMutation.mutateAsync(roomContextMenu.id);
                                setRoomContextMenu(null);
                            }}
                        >
                            Delete Thread
                        </button>
                    )}
                </div>
            )}

            {roomPassPanelRoom && (
                <div className="overlay-backdrop" onClick={() => setRoomPassPanelRoomId(null)}>
                    <div
                        className="overlay-panel room-overlay room-pass-panel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="room-overlay-header">
                            <strong>Room Pass</strong>
                            <button
                                className="button"
                                type="button"
                                onClick={() => setRoomPassPanelRoomId(null)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="stack">
                            <div className="muted">{roomPassPanelRoom.name}</div>

                            <input
                                readOnly
                                value={roomPassPanelRoom.roomPass ? `starbyte://${roomPassPanelRoom.roomPass}` : ""}
                                placeholder="No room pass yet"
                            />

                            <div className="profile-actions">
                                <button
                                    className="button button-primary"
                                    type="button"
                                    onClick={async () => {
                                        await generateRoomPassMutation.mutateAsync(roomPassPanelRoom.id);
                                        setCopiedRoomPass(false);
                                        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
                                    }}
                                >
                                    {roomPassPanelRoom.roomPass ? "Regenerate" : "Generate"}
                                </button>

                                <button
                                    className="button"
                                    type="button"
                                    disabled={!roomPassPanelRoom.roomPass}
                                    onClick={async () => {
                                        if (!roomPassPanelRoom.roomPass) return;
                                        await navigator.clipboard.writeText(`starbyte://${roomPassPanelRoom.roomPass}`);
                                        setCopiedRoomPass(true);
                                    }}
                                >
                                    {copiedRoomPass ? "Copied" : "Copy link"}
                                </button>

                                <button
                                    className="button"
                                    type="button"
                                    disabled={!roomPassPanelRoom.roomPass}
                                    onClick={async () => {
                                        await deleteRoomPassMutation.mutateAsync(roomPassPanelRoom.id);
                                        setCopiedRoomPass(false);
                                        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedUserProfile && (
                <div className="overlay-backdrop" onClick={() => setSelectedUserProfile(null)}>
                    <div className="overlay-panel room-overlay" onClick={(event) => event.stopPropagation()}>
                        <div className="room-overlay-header">
                            <strong>User Profile</strong>
                            <button className="button" type="button" onClick={() => setSelectedUserProfile(null)}>
                                Close
                            </button>
                        </div>

                        <div className="stack">
                            <div className="profile-screen-top">
                                <AvatarSquare
                                    displayName={selectedUserProfile.displayName}
                                    avatarUrl={selectedUserProfile.avatarUrl}
                                    size="lg"
                                />
                                <div className="profile-screen-copy">
                                    <strong>{selectedUserProfile.displayName}</strong>
                                    <div className="muted">@{selectedUserProfile.username}</div>
                                    {selectedUserProfile.statusText && (
                                        <div className="muted">{selectedUserProfile.statusText}</div>
                                    )}
                                </div>
                            </div>

                            {selectedUserProfile.bio && (
                                <div className="stack">
                                    <span className="muted">Bio</span>
                                    <div>{selectedUserProfile.bio}</div>
                                </div>
                            )}

                            <button
                                className="button button-primary"
                                type="button"
                                disabled={
                                    createWhisperMutation.isPending ||
                                    selectedUserProfile.id === meQuery.data?.user.id
                                }
                                onClick={() => createWhisperMutation.mutate(selectedUserProfile.id)}
                            >
                                {createWhisperMutation.isPending ? "Opening..." : "Message"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {roomIconPanelRoomId && (
                <div className="overlay-backdrop" onClick={() => setRoomIconPanelRoomId(null)}>
                    <div
                        className="overlay-panel room-overlay room-pass-panel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="room-overlay-header">
                            <strong>Room Icon</strong>
                            <button
                                className="button"
                                type="button"
                                onClick={() => setRoomIconPanelRoomId(null)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="stack">
                            <input
                                placeholder="Image URL"
                                value={roomIconDraft}
                                onChange={(event) => setRoomIconDraft(event.target.value)}
                            />

                            <div className="profile-actions">
                                <button
                                    className="button button-primary"
                                    type="button"
                                    onClick={async () => {
                                        await updateRoomIconMutation.mutateAsync({
                                            roomId: roomIconPanelRoomId,
                                            iconUrl: roomIconDraft.trim() || null
                                        });
                                        setRoomIconPanelRoomId(null);
                                    }}
                                >
                                    Save
                                </button>

                                <button
                                    className="button"
                                    type="button"
                                    onClick={async () => {
                                        await updateRoomIconMutation.mutateAsync({
                                            roomId: roomIconPanelRoomId,
                                            iconUrl: null
                                        });
                                        setRoomIconDraft("");
                                        setRoomIconPanelRoomId(null);
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!IS_DESKTOP_BUILD && <PwaPrompt />}
        </div>
    );
}

export default function App() {
    const [hasToken, setHasToken] = useState(Boolean(getToken()));
    const [theme, setTheme] = useState(localStorage.getItem("starbyte.theme") ?? "dark");

    function changeTheme(nextTheme: string) {
        setTheme(nextTheme);
        localStorage.setItem("starbyte.theme", nextTheme);
    }

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    useEffect(() => {
        function handleAuthInvalid() {
            setHasToken(false);
        }

        window.addEventListener("starbyte-auth-invalid", handleAuthInvalid);
        return () => window.removeEventListener("starbyte-auth-invalid", handleAuthInvalid);
    }, []);

    return hasToken ? (
        <ThreadShell
            onLogout={() => setHasToken(false)}
            theme={theme}
            onThemeChange={changeTheme}
        />
    ) : (
        <AuthScreen onAuthenticated={() => setHasToken(true)} />
    );
}