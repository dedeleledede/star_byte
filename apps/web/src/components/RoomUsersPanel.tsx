import type { Room, Thread, User } from "../api";
import { AvatarSquare } from "./Avatars";

interface RoomUsersPanelProps {
    thread: Thread;
    room: Room | null;
    users: User[];
    sidebarMode: "threads" | "whispers";
    showSearch: boolean;
    onSearch: () => void;
    onOpenUser: (user: User) => void;
}

export function RoomUsersPanel({ thread, room, users, sidebarMode, showSearch, onSearch, onOpenUser }: RoomUsersPanelProps) {
    return (
        <aside className="room-users-panel">
            <div className="thread-header room-search-header">
                <div className="chat-header-copy">
                    <h2>{thread.kind === "whisper" || !thread.roomId ? thread.title : room?.name ?? "No room selected"}</h2>
                    <p className="muted">{thread.kind === "whisper" ? "whisper participants" : "room users"}</p>
                </div>
                {showSearch && <button className="button" type="button" onClick={onSearch}>Search</button>}
            </div>
            <div className="room-user-list">
                {users.length === 0 ? (
                    <div className="muted">{sidebarMode === "whispers" ? "No whisper participants found." : "No room users found."}</div>
                ) : users.map((user) => (
                    <button key={user.id} type="button" className="room-user-item" onClick={() => onOpenUser(user)}>
                        <AvatarSquare displayName={user.displayName} avatarUrl={user.avatarUrl} size="sm" />
                        <div className="room-user-copy">
                            <strong>{user.displayName}</strong>
                            <div className="muted">@{user.username}</div>
                            {user.statusText && <div className="muted">{user.statusText}</div>}
                        </div>
                    </button>
                ))}
            </div>
        </aside>
    );
}
