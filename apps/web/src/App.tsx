import {
    SyntheticEvent,
    useMemo,
    useState,
    useEffect,
    useRef,
    type MouseEvent as ReactMouseEvent
} from "react";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    fetchMe,
    fetchUsers,
    fetchMessages,
    fetchWhispers,
    fetchThreads,
    fetchThreadMembers,
    fetchMentionNotifications,
    searchMessages,

    markMentionNotificationsRead,
    sendMessage,

    setToken,
    getToken,

    updateMessage,

    createWhisper,
    createTextThread,
    createRoom,
    joinRoom,

    type Message,
    type MessageSearchFilters,
    type SearchMessage,
    type Thread,
    type Room,
    type RoomUser, fetchRooms, fetchRoomUsers, deleteThread, updateRoom, deleteRoom, deleteRoomPass, generateRoomPass, deleteMessage,
    uploadImage,
    User
} from "./api";
import { useSocket } from "./hooks/useSocket";
import { useThreadDrafts } from "./hooks/useThreadDrafts";
import { useProfileEditor } from "./hooks/useProfileEditor";
import { PwaPrompt } from "./components/PwaPrompt";
import { AvatarSquare } from "./components/Avatars";
import { ProfileScreen } from "./components/ProfileScreen";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { AuthScreen } from "./components/AuthScreen";
import { SearchDatePicker, SearchUserPicker } from "./components/SearchControls";
import { MessageTimeline } from "./components/MessageTimeline";

const IS_TAURI = "__TAURI_INTERNALS__" in window;
function ThreadShell({ onLogout, theme, onThemeChange }: { onLogout: () => void; theme: string; onThemeChange: (theme: string) => void; }) {
    const queryClient = useQueryClient();

    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [screen, setScreen] = useState<"thread" | "profile">("thread");

    const [selectedUserProfile, setSelectedUserProfile] = useState<RoomUser | null>(null);
    const [sidebarMode, setSidebarMode] = useState<"threads" | "whispers">("threads");

    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    const [roomName, setRoomName] = useState("");
    const [joinRoomPass, setJoinRoomPass] = useState("");
    const [roomOverlayOpen, setRoomOverlayOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchFilters, setSearchFilters] = useState<MessageSearchFilters>({});
    const [searchContext, setSearchContext] = useState<{ roomId?: string; threadId?: string; label: string } | null>(null);
    const [submittedSearch, setSubmittedSearch] = useState<MessageSearchFilters | null>(null);
    const [searchTarget, setSearchTarget] = useState<{ threadId: string; messageId: string } | null>(null);
    const [searchThread, setSearchThread] = useState<Thread | null>(null);
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
    const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

    const composerRef = useRef<HTMLInputElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const messagesRef = useRef<HTMLElement | null>(null);
    const messageRefs = useRef<Record<string, HTMLElement | null>>({});
    const stickToBottomRef = useRef(true);

    const meQuery = useQuery({queryKey: ["me"], queryFn: fetchMe});
    const {
        profileDisplayName, setProfileDisplayName,
        profileAvatarUrl, setProfileAvatarUrl,
        profileBio, setProfileBio,
        profileStatusText, setProfileStatusText,
        updateProfileMutation, uploadProfileImageMutation
    } = useProfileEditor(meQuery.data?.user, () => setScreen("thread"));

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
        if (searchThread && searchTarget?.threadId === searchThread.id) return searchThread;
        if (sidebarMode === "threads") {
            return roomThreads.find((thread) => thread.id === activeRoomThreadId) ?? roomThreads[0] ?? null;
        }

        return whispers.find((thread) => thread.id === activeWhisperId) ?? whispers[0] ?? null;
    }, [sidebarMode, roomThreads, whispers, activeRoomThreadId, activeWhisperId, searchThread, searchTarget]);

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

    const focusedMessageId = searchTarget && activeThread?.id === searchTarget.threadId
        ? searchTarget.messageId
        : null;

    const messagesQuery = useQuery({
        queryKey: ["messages", activeThread?.id, focusedMessageId],
        queryFn: () => fetchMessages(activeThread!.id, focusedMessageId ?? undefined).then((data) => data.messages),
        enabled: Boolean(activeThread?.id),
        refetchInterval: 2000,
        refetchOnWindowFocus: true
    });

    const searchQuery = useInfiniteQuery({
        queryKey: ["message-search", submittedSearch],
        queryFn: ({ pageParam }) => searchMessages(submittedSearch!, pageParam),
        initialPageParam: 0,
        getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length * 50 : undefined,
        enabled: searchOpen && submittedSearch !== null
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

    useSocket(Boolean(meQuery.data?.user));
    const userId = meQuery.data?.user.id;
    const threadId = activeThread?.id;
    const { draft, setDraft, setDraftForThread } = useThreadDrafts(userId, threadId);

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

    const uploadChatImageMutation = useMutation({
        mutationFn: ({ file }: { file: File; threadId: string }) => uploadImage(file),
        onSuccess: (data, variables) => {
            setDraftForThread(variables.threadId, (current) => current.trim() ? `${current.trim()} ${data.url}` : data.url);
            if (activeThread?.id === variables.threadId) requestAnimationFrame(() => composerRef.current?.focus());
        }
    });

    const sendMutation = useMutation({
        mutationFn: ({ threadId, body, replyToMessageId }: { threadId: string; body: string; replyToMessageId: string | null }) => {
            return sendMessage(threadId, { body, replyToMessageId });
        },
        onSuccess: async (data, variables) => {
            setDraftForThread(variables.threadId, (current) => current.trim() === variables.body ? "" : current);
            if (activeThread?.id === variables.threadId) {
                setMentionOpen(false);
                setMentionQuery("");
                setMentionStart(null);
                setSelectedMentionIndex(0);
                if (replyingToMessage?.id === variables.replyToMessageId) setReplyingToMessage(null);
            }

            queryClient.setQueryData(
                ["messages", variables.threadId],
                (current: typeof messagesQuery.data | undefined) => {
                    const list = current ?? [];
                    return list.some((message) => message.id === data.message.id)
                        ? list
                        : [...list, data.message];
                }
            );

            await queryClient.invalidateQueries({
                queryKey: ["messages", variables.threadId]
            });
        }
    });

    const createThreadMutation = useMutation({
        mutationFn: async (title: string) => {
            if (!activeRoomId) throw new Error("Escolha uma Room antes de criar uma Thread.");
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
            openRoom(data.room.id);
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
            openRoom(data.room.id);
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
        onSuccess: async (_data, deletedThreadId) => {
            setDraftForThread(deletedThreadId, "");
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
        if (searchTarget?.threadId !== activeThread?.id || !messagesQuery.data?.some((message) => message.id === searchTarget.messageId)) return;
        requestAnimationFrame(() => messageRefs.current[searchTarget.messageId]?.scrollIntoView({ block: "center" }));
    }, [searchTarget, activeThread?.id, messagesQuery.data]);

    useEffect(() => {
        if (!activeRoomId && rooms.length > 0) {
            setActiveRoomId(rooms[0].id);
        }
    }, [rooms, activeRoomId]);

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
        function handleSearchShortcut(event: KeyboardEvent) {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "f") return;
            if (screen !== "thread" || !activeThread || roomOverlayOpen) return;
            event.preventDefault();
            if (searchOpen) searchInputRef.current?.focus();
            else openSearch();
        }
        window.addEventListener("keydown", handleSearchShortcut);
        return () => window.removeEventListener("keydown", handleSearchShortcut);
    }, [screen, activeThread, activeRoom, roomOverlayOpen, searchOpen]);

    useEffect(() => {
        function handleKeyboardNavigation(event: KeyboardEvent) {
            if (!event.altKey || event.metaKey || event.shiftKey) return;
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            if (screen !== "thread") return;
            if (roomOverlayOpen || roomPassPanelRoom || roomIconPanelRoomId) return;
            if (selectedUserProfile || accountMenuOpen || roomContextMenu || messageContextMenu) return;
            if (editingMessageId) return;

            const direction = event.key === "ArrowUp" ? -1 : 1;

            if (event.ctrlKey) {
                if (rooms.length < 2) return;

                const currentIndex = rooms.findIndex((room) => room.id === activeRoom?.id);
                const nextIndex = currentIndex + direction;
                const nextRoom = rooms[nextIndex];
                if (!nextRoom) return;

                event.preventDefault();
                openRoom(nextRoom.id);
                return;
            }

            const conversations = sidebarMode === "threads" ? roomThreads : whispers;
            if (conversations.length < 2) return;

            const currentIndex = conversations.findIndex((thread) => thread.id === activeThread?.id);
            const nextIndex = currentIndex + direction;
            const nextConversation = conversations[nextIndex];
            if (!nextConversation) return;

            event.preventDefault();

            if (sidebarMode === "threads" && activeRoom) {
                openRoomThread(activeRoom.id, nextConversation.id);
            } else {
                openWhisper(nextConversation.id);
            }
        }

        window.addEventListener("keydown", handleKeyboardNavigation);
        return () => window.removeEventListener("keydown", handleKeyboardNavigation);
    }, [
        screen, roomOverlayOpen, roomPassPanelRoom,
        roomIconPanelRoomId, selectedUserProfile,
        accountMenuOpen, roomContextMenu,
        messageContextMenu, editingMessageId,
        rooms, activeRoom, sidebarMode,
        roomThreads, whispers, activeThread
    ]);

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
        setReplyingToMessage(null);
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSelectedMentionIndex(0);
    }, [activeThread?.id]);

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

        function handleArrowUpEdit(event: KeyboardEvent) {
            if (event.key !== "ArrowUp") return;
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (screen !== "thread") return;
            if (!activeThread) return;
            if (roomOverlayOpen) return;
            if (selectedUserProfile) return;
            if (accountMenuOpen) return;
            if (mentionOpen) return;
            if (editingMessageId) return;
            if (draft.trim()) return;

            const targetIsComposer = event.target === composerRef.current;
            if (isEditableTarget(event.target) && !targetIsComposer) return;

            const latest = findLatestOwnMessage();
            if (!latest) return;

            event.preventDefault();
            startEditingMessage(latest);
        }

        window.addEventListener("keydown", handleArrowUpEdit);
        return () => window.removeEventListener("keydown", handleArrowUpEdit);
    }, [
        screen, activeThread,
        roomOverlayOpen, selectedUserProfile,
        accountMenuOpen, mentionOpen,
        editingMessageId, draft,
        messagesQuery.data, meQuery.data?.user.id
    ]);

    // functions

    function findLatestOwnMessage() {
        const myUserId = meQuery.data?.user.id;
        if (!myUserId) return null;

        const list = messagesQuery.data ?? [];
        for (let index = list.length - 1; index >= 0; index -= 1) {
            if (list[index].userId === myUserId) {
                return list[index];
            }
        }

        return null;
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
        if (!activeThread || !draft.trim()) return;

        sendMutation.mutate({ threadId: activeThread.id, body: draft.trim(), replyToMessageId: replyingToMessage?.id ?? null });
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

    function canDeleteRoomThread(thread: Thread) {
        const currentUserId = meQuery.data?.user.id;
        return Boolean(
            currentUserId &&
            activeRoom &&
            (activeRoom.hostUserId === currentUserId || thread.createdBy === currentUserId)
        );
    }

    function openRoom(roomId: string) {
        setScreen("thread");
        setSelectedUserProfile(null);
        setSearchTarget(null);
        setSearchThread(null);
        setSidebarMode("threads");
        setActiveRoomId(roomId);
    }

    function openRoomThread(roomId: string, threadId: string) {
        openRoom(roomId);
        setSelectedThreadByRoom((prev) => ({
            ...prev,
            [roomId]: threadId
        }));
    }

    function openWhisper(threadId: string) {
        setScreen("thread");
        setSelectedUserProfile(null);
        setSearchTarget(null);
        setSearchThread(null);
        setSidebarMode("whispers");
        setActiveWhisperId(threadId);
    }

    function openSearchResult(result: SearchMessage) {
        if (result.roomId) openRoomThread(result.roomId, result.threadId);
        else if (result.threadKind === "whisper") openWhisper(result.threadId);
        else {
            setSidebarMode("threads");
            setSearchThread({ id: result.threadId, title: result.threadTitle, kind: "text", roomId: null,
                slug: null, createdBy: null, isPrivate: 0, createdAt: result.createdAt });
        }
        setSearchTarget({ threadId: result.threadId, messageId: result.id });
        setScreen("thread");
        setSearchOpen(false);
    }

    function openSearch() {
        if (!activeThread) return;
        const context = activeThread.kind === "whisper" || !activeThread.roomId
            ? { threadId: activeThread.id, label: activeThread.title }
            : { roomId: activeThread.roomId, label: activeRoom?.name ?? "Room" };
        setSearchContext(context);
        setSearchFilters({});
        setSubmittedSearch(null);
        setSearchOpen(true);
    }

    function openUserProfileFromId(userId: string) {
        const user = usersById.get(userId);
        if (!user) return;
        createWhisperMutation.reset();
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

    function startReplyingToMessage(message: Message) {
        setReplyingToMessage(message);
        setMessageContextMenu(null);
        requestAnimationFrame(() => composerRef.current?.focus());
    }

    function scrollToMessage(messageId: string) {
        messageRefs.current[messageId]?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    function cancelEditingMessage() {
        setEditingMessageId(null);
        setEditingDraft("");
    }

    async function joinFromRoomPass(roomPass: string) {
        const data = await joinRoomMutation.mutateAsync({ roomPass });
        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        openRoom(data.room.id);
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
                                    onChange={(event) => {
                                        setRoomName(event.target.value);
                                        createRoomMutation.reset();
                                    }}
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
                                    onChange={(event) => {
                                        setJoinRoomPass(event.target.value);
                                        joinRoomMutation.reset();
                                    }}
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
            {searchOpen && (
                <div className="overlay-backdrop" onClick={() => setSearchOpen(false)}>
                    <div className="overlay-panel search-overlay" role="dialog" aria-modal="true" aria-label="Search messages" onClick={(event) => event.stopPropagation()}>
                        <div className="room-overlay-header">
                            <strong>Search in {searchContext?.label}</strong>
                            <button className="button" type="button" onClick={() => setSearchOpen(false)}>Close</button>
                        </div>
                        <form className="search-form" onSubmit={(event) => { event.preventDefault(); if (searchContext) setSubmittedSearch({ ...searchFilters, roomId: searchContext.roomId, threadId: searchContext.roomId ? searchFilters.threadId : searchContext.threadId, q: searchFilters.q?.trim() }); }}>
                            <label className="stack search-wide"><span>Text</span><input ref={searchInputRef} autoFocus placeholder="Search message text" value={searchFilters.q ?? ""} onChange={(event) => setSearchFilters((value) => ({ ...value, q: event.target.value }))} /></label>
                            <SearchUserPicker label="Sent from" users={sidePanelUsers} value={searchFilters.userId} valueKey="id" onChange={(userId) => setSearchFilters((filters) => ({ ...filters, userId }))} />
                            {searchContext?.roomId && <label className="stack"><span>Thread</span><select value={searchFilters.threadId ?? ""} onChange={(event) => setSearchFilters((value) => ({ ...value, threadId: event.target.value || undefined }))}><option value="">All threads</option>{roomThreads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}</select></label>}
                            <SearchDatePicker label="From date" value={searchFilters.after} onChange={(after) => setSearchFilters((filters) => ({ ...filters, after }))} />
                            <SearchDatePicker label="Through date" value={searchFilters.before} onChange={(before) => setSearchFilters((filters) => ({ ...filters, before }))} />
                            <SearchUserPicker label="Mentions" users={sidePanelUsers} value={searchFilters.mentions} valueKey="username" onChange={(mentions) => setSearchFilters((filters) => ({ ...filters, mentions }))} />
                            <div className="search-checks"><label><input type="checkbox" checked={Boolean(searchFilters.hasLink)} onChange={(event) => setSearchFilters((value) => ({ ...value, hasLink: event.target.checked }))} /> Links</label><label><input type="checkbox" checked={Boolean(searchFilters.hasAttachment)} onChange={(event) => setSearchFilters((value) => ({ ...value, hasAttachment: event.target.checked }))} /> Attachments</label></div>
                            <button className="button button-primary search-wide" type="submit">Search</button>
                        </form>
                        <div className="search-results" aria-live="polite">
                            {searchQuery.isPending && submittedSearch && <p className="muted">Searching…</p>}
                            {searchQuery.isError && <p className="error">{(searchQuery.error as Error).message}</p>}
                            {searchQuery.data?.pages.flatMap((page) => page.messages).map((result) => <button className="search-result" type="button" key={result.id} onClick={() => openSearchResult(result)}><span className="muted">{result.roomName ? `${result.roomName} / ` : ""}{result.threadTitle} · @{result.username} · {new Date(result.createdAt).toLocaleString()}</span><span>{result.body}</span></button>)}
                            {searchQuery.data && searchQuery.data.pages[0].messages.length === 0 && <p className="muted">No messages found.</p>}
                            {searchQuery.hasNextPage && <button className="button" type="button" disabled={searchQuery.isFetchingNextPage} onClick={() => void searchQuery.fetchNextPage()}>{searchQuery.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
                        </div>
                    </div>
                </div>
            )}
            <ConversationSidebar
                user={meQuery.data?.user}
                theme={theme}
                onThemeChange={onThemeChange}
                accountMenuOpen={accountMenuOpen}
                onToggleAccountMenu={() => setAccountMenuOpen((value) => !value)}
                onEditProfile={() => { setScreen("profile"); setAccountMenuOpen(false); }}
                onLogout={() => { setAccountMenuOpen(false); logout(); }}
                onToggleMode={() => { setScreen("thread"); setSidebarMode((value) => value === "threads" ? "whispers" : "threads"); }}
                unreadMentionCount={unreadMentionCount}
                rooms={rooms}
                activeRoom={activeRoom}
                onOpenRoom={openRoom}
                onRoomContextMenu={setRoomContextMenu}
                onRoomTooltip={setRoomTooltip}
                onOpenRoomOverlay={() => setRoomOverlayOpen(true)}
                sidebarMode={sidebarMode}
                threadsLoading={threadsQuery.isFetching}
                roomThreads={roomThreads}
                activeThreadId={activeThread?.id}
                onOpenRoomThread={openRoomThread}
                canDeleteRoomThread={canDeleteRoomThread}
                newThreadTitle={newThreadTitle}
                onNewThreadTitleChange={(title) => setNewThreadTitle(title)}
                onResetCreateThread={() => createThreadMutation.reset()}
                createThreadPending={createThreadMutation.isPending}
                onCreateThread={handleCreateThread}
                createThreadError={createThreadMutation.error}
                deleteThreadError={deleteThreadMutation.error}
                whispersLoading={whispersQuery.isFetching}
                whispers={whispers}
                onOpenWhisper={openWhisper}
            />

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
                    onAvatarUpload={(file) => uploadProfileImageMutation.mutate(file)}
                    isUploadingAvatar={uploadProfileImageMutation.isPending}
                    onBack={() => setScreen("thread")}
                    onSave={handleProfileSave}
                    isSaving={updateProfileMutation.isPending}
                    error={updateProfileMutation.error ? (updateProfileMutation.error as Error).message : undefined}
                    uploadError={uploadProfileImageMutation.error ? (uploadProfileImageMutation.error as Error).message : undefined}
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
                                            onClick={() => createThreadMutation.mutate("general")}
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
                            <header className="thread-header chat-header">
                                <div className="chat-header-copy">
                                    <h2>
                                        {activeThread.kind === "whisper"
                                            ? activeThread.title
                                            : activeThread.roomId ? `${activeThread.title} · ${activeRoom?.name ?? "No room"}` : activeThread.title}
                                    </h2>
                                    <p className="muted">
                                        {activeThread.kind === "whisper"
                                            ? "private whisper"
                                            : !activeThread.roomId ? "thread" : activeRoom
                                                ? `room: ${activeRoom.name}`
                                                : "pick a room thread or create one"}
                                    </p>
                                </div>
                                <button className="button search-compact-button" type="button" onClick={openSearch}>Search</button>
                            </header>

                            <MessageTimeline
                                messages={messagesQuery.data ?? []}
                                messagesRef={messagesRef}
                                onScrollPosition={(element) => { stickToBottomRef.current = isNearBottom(element); }}
                                onMessageElement={(messageId, element) => { messageRefs.current[messageId] = element; }}
                                searchTargetMessageId={searchTarget?.messageId}
                                currentUser={meQuery.data?.user}
                                editingMessageId={editingMessageId}
                                editingDraft={editingDraft}
                                onEditingDraftChange={setEditingDraft}
                                isSavingEdit={updateMessageMutation.isPending}
                                onSaveEdit={() => updateMessageMutation.mutate()}
                                onCancelEdit={cancelEditingMessage}
                                onScrollToMessage={scrollToMessage}
                                onReply={startReplyingToMessage}
                                onEdit={startEditingMessage}
                                onContextMenu={setMessageContextMenu}
                                onChatIdentityClick={handleChatIdentityClick}
                                onAuthorMouseUp={handleAuthorMouseUp}
                                validMentionUsernames={validMentionUsernames}
                                onJoinRoomPass={joinFromRoomPass}
                            />

                            <form className="composer" onSubmit={handleSend}>
                                {replyingToMessage && (
                                    <div className="composer-context">
                                        <span>
                                            Replying to <strong>@{replyingToMessage.username}</strong>: {replyingToMessage.body.slice(0, 90)}
                                        </span>
                                        <button type="button" className="message-inline-action" onClick={() => setReplyingToMessage(null)}>
                                            Cancel
                                        </button>
                                    </div>
                                )}
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
                                        if (event.ctrlKey || event.metaKey || event.altKey) return;

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

                                <label className="button attachment-button">
                                    {uploadChatImageMutation.isPending ? "Uploading..." : "Image"}
                                    <input
                                        className="file-input"
                                        type="file"
                                        accept="image/png,image/jpeg,image/gif,image/webp"
                                        disabled={uploadChatImageMutation.isPending}
                                        onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file && activeThread) uploadChatImageMutation.mutate({ file, threadId: activeThread.id });
                                            event.target.value = "";
                                        }}
                                    />
                                </label>
                                <button className="button button-primary" disabled={sendMutation.isPending || !activeThread}>
                                    Send
                                </button>
                                {sendMutation.error && <p className="error">{(sendMutation.error as Error).message}</p>}
                                {uploadChatImageMutation.error && <p className="error">{(uploadChatImageMutation.error as Error).message}</p>}
                            </form>
                        </>
                    )}
                </main>
            )}
            {activeThread && (
                <aside className="room-users-panel">
                    <div className="thread-header room-search-header">
                        <div className="chat-header-copy">
                            <h2>{activeThread.kind === "whisper" || !activeThread.roomId ? activeThread.title : activeRoom?.name ?? "No room selected"}</h2>
                            <p className="muted">{activeThread.kind === "whisper" ? "whisper participants" : "room users"}</p>
                        </div>
                        {screen === "thread" && <button className="button" type="button" onClick={openSearch}>Search</button>}
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
                                    onClick={() => {
                                        createWhisperMutation.reset();
                                        setSelectedUserProfile(user);
                                    }}
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

            {messageContextMenu && (
                <div
                    className="context-menu"
                    style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
                >
                    <button
                        type="button"
                        className="context-menu-item"
                        onClick={() => {
                            startReplyingToMessage(messageContextMenu.message);
                        }}
                    >
                        Reply
                    </button>

                    {messageContextMenu.message.userId === meQuery.data?.user.id && (
                        <>
                            <button
                                type="button"
                                className="context-menu-item"
                                onClick={() => {
                                    startEditingMessage(messageContextMenu.message);
                                    setMessageContextMenu(null);
                                }}
                            >
                                Edit Message
                            </button>

                            <button
                                type="button"
                                className="context-menu-item context-menu-item-danger"
                                onClick={async () => {
                                    if (!activeThread) return;

                                    await deleteMessageMutation.mutateAsync({
                                        threadId: activeThread.id,
                                        messageId: messageContextMenu.message.id
                                    });
                                }}
                            >
                                Delete Message
                            </button>
                        </>
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
                            {createWhisperMutation.error && (
                                <p className="error">{(createWhisperMutation.error as Error).message}</p>
                            )}
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

            {!IS_TAURI && <PwaPrompt />}
        </div>
    );
}

function DesktopTitlebar() {
    async function withWindow(action: (window: import("@tauri-apps/api/window").Window) => Promise<unknown>) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await action(getCurrentWindow());
    }

    return (
        <header
            className="desktop-titlebar"
            data-tauri-drag-region
        >
            <strong className="desktop-titlebar-brand" data-tauri-drag-region>
                <img src="/sb_logo.svg" alt="" />
                <span>star_byte</span>
            </strong>
            <div className="desktop-window-controls" onDoubleClick={(event) => event.stopPropagation()}>
                <button
                    type="button"
                    aria-label="Minimize"
                    title="Minimize"
                    onClick={() => void withWindow((window) => window.minimize())}
                >
                    -
                </button>
                <button
                    type="button"
                    aria-label="Maximize"
                    title="Maximize"
                    onClick={() => void withWindow((window) => window.toggleMaximize())}
                >
                    []
                </button>
                <button
                    type="button"
                    className="desktop-window-close"
                    aria-label="Close"
                    title="Close"
                    onClick={() => void withWindow((window) => window.close())}
                >
                    x
                </button>
            </div>
        </header>
    );
}

function DesktopResizeHandles() {
    const directions = [
        "North",
        "NorthEast",
        "East",
        "SouthEast",
        "South",
        "SouthWest",
        "West",
        "NorthWest"
    ] as const;

    async function startResize(direction: typeof directions[number]) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().startResizeDragging(direction);
    }

    return (
        <>
            {directions.map((direction) => (
                <div
                    key={direction}
                    className={`window-resize-handle window-resize-${direction.toLowerCase()}`}
                    onMouseDown={(event) => {
                        if (event.button === 0) void startResize(direction);
                    }}
                    aria-hidden="true"
                />
            ))}
        </>
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

    const content = hasToken ? (
        <ThreadShell
            onLogout={() => setHasToken(false)}
            theme={theme}
            onThemeChange={changeTheme}
        />
    ) : (
        <AuthScreen onAuthenticated={() => setHasToken(true)} />
    );

    if (!IS_TAURI) return content;

    return (
        <div className="tauri-frame">
            <DesktopResizeHandles />
            <DesktopTitlebar />
            <div className="tauri-content">{content}</div>
        </div>
    );
}
