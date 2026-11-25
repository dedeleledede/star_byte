import type { Room, Thread, User } from "../api";
import { AvatarSquare, RoomAvatar } from "./Avatars";
import { DesktopUpdater } from "./DesktopUpdater";

const IS_TAURI = "__TAURI_INTERNALS__" in window;

type Menu = { type: "room" | "thread"; id: string; x: number; y: number };
type Tooltip = { text: string; x: number; y: number };

interface ConversationSidebarProps {
    user?: User;
    theme: string;
    onThemeChange: (theme: string) => void;
    accountMenuOpen: boolean;
    onToggleAccountMenu: () => void;
    onEditProfile: () => void;
    onLogout: () => void;
    onToggleMode: () => void;
    unreadMentionCount: number;
    rooms: Room[];
    activeRoom: Room | null;
    onOpenRoom: (roomId: string) => void;
    onRoomContextMenu: (menu: Menu) => void;
    onRoomTooltip: (tooltip: Tooltip | null) => void;
    onOpenRoomOverlay: () => void;
    sidebarMode: "threads" | "whispers";
    threadsLoading: boolean;
    roomThreads: Thread[];
    activeThreadId?: string;
    onOpenRoomThread: (roomId: string, threadId: string) => void;
    canDeleteRoomThread: (thread: Thread) => boolean;
    newThreadTitle: string;
    onNewThreadTitleChange: (title: string) => void;
    onResetCreateThread: () => void;
    createThreadPending: boolean;
    onCreateThread: () => void;
    createThreadError: Error | null;
    deleteThreadError: Error | null;
    whispersLoading: boolean;
    whispers: Thread[];
    onOpenWhisper: (threadId: string) => void;
}

export function ConversationSidebar({
    user, theme, onThemeChange, accountMenuOpen, onToggleAccountMenu, onEditProfile, onLogout,
    onToggleMode, unreadMentionCount, rooms, activeRoom, onOpenRoom, onRoomContextMenu,
    onRoomTooltip, onOpenRoomOverlay, sidebarMode, threadsLoading, roomThreads, activeThreadId,
    onOpenRoomThread, canDeleteRoomThread, newThreadTitle, onNewThreadTitleChange,
    onResetCreateThread, createThreadPending, onCreateThread, createThreadError,
    deleteThreadError, whispersLoading, whispers, onOpenWhisper
}: ConversationSidebarProps) {
    return (
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-profile">
                        <AvatarSquare
                            displayName={user?.displayName ?? "?"}
                            avatarUrl={user?.avatarUrl}
                            size="lg"/>

                    <div className="sidebar-profile-copy">
                    <strong>{user?.displayName}</strong>
                    <div className="muted">@{user?.username}</div>
                    {user?.statusText && (
                    <div className="muted">{user.statusText}</div>
                    )}
                    </div>

                        <div className="sidebar-header-actions">
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => {
                                    onToggleMode();
                                }}
                                aria-label="Whispers"
                                title="Whispers"
                            >
                                ✉
                            </button>

                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => onToggleAccountMenu()}
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
                                  onEditProfile();
                              }}
                          >
                              Edit profile
                          </button>

                          {IS_TAURI && <DesktopUpdater />}

                          <button
                              className="button"
                              type="button"
                              onClick={() => {
                                  onLogout();
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
                                onClick={() => onOpenRoom(room.id)}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    onRoomContextMenu({
                                        type: "room",
                                        id: room.id,
                                        x: event.clientX,
                                        y: event.clientY
                                    });
                                }}
                                onMouseEnter={(event) =>
                                    onRoomTooltip({
                                        text: room.name,
                                        x: event.clientX + 12,
                                        y: event.clientY - 8
                                    })
                                }
                                onMouseMove={(event) =>
                                    onRoomTooltip({
                                        text: room.name,
                                        x: event.clientX + 12,
                                        y: event.clientY - 8
                                    })
                                }
                                onMouseLeave={() => onRoomTooltip(null)}
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
                        onClick={() => onOpenRoomOverlay()}
                        title="Create or join room"
                    >
                        +
                    </button>
                </div>

                <div className="section-title">{sidebarMode === "threads" ? "Threads" : "Whispers"}</div>

                {sidebarMode === "threads" ? (
                    <>
                        <div className="thread-list">
                            {threadsLoading && roomThreads.length === 0 ? (
                                <div className="muted">Loading threads…</div>
                            ) : roomThreads.length === 0 ? (
                                <div className="muted">No threads in this room yet.</div>
                            ) : (
                                roomThreads.map((thread: Thread) => (
                                    <button
                                        key={thread.id}
                                        className={`thread-item ${activeThreadId === thread.id ? "thread-item-active" : ""}`}
                                        onClick={() => {
                                            if (!activeRoom?.id) return;
                                            onOpenRoomThread(activeRoom.id, thread.id);
                                        }}
                                        onContextMenu={(event) => {
                                            if (!canDeleteRoomThread(thread)) return;
                                            event.preventDefault();
                                            onRoomContextMenu({
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
                                onChange={(event) => {
                                    onNewThreadTitleChange(event.target.value);
                                    onResetCreateThread();
                                }}
                                disabled={!activeRoom || createThreadPending}
                            />
                            <button
                                className="button"
                                type="button"
                                onClick={onCreateThread}
                                disabled={!activeRoom || createThreadPending || !newThreadTitle.trim()}
                            >
                                {createThreadPending ? "Creating..." : "Create Thread"}
                            </button>
                            {createThreadError && (
                                <p className="error">{createThreadError.message}</p>
                            )}
                            {deleteThreadError && (
                                <p className="error">{deleteThreadError.message}</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="thread-list">
                        {whispersLoading && whispers.length === 0 ? (
                            <div className="muted">Loading whispers…</div>
                        ) : whispers.length === 0 ? (
                            <div className="muted">No whispers yet.</div>
                        ) : (
                            whispers.map((thread: Thread) => (
                                <button
                                    key={thread.id}
                                    className={`thread-item ${activeThreadId === thread.id ? "thread-item-active" : ""}`}
                                    onClick={() => onOpenWhisper(thread.id)}
                                >
                                    <span>@</span>
                                    <span>{thread.title}</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

            </aside>
    );
}
