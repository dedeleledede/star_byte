import type { Room, RoomUser } from "../api";
import { AvatarSquare } from "./Avatars";

interface RoomJoinPanelProps {
    roomName: string;
    onRoomNameChange: (value: string) => void;
    creating: boolean;
    createError: Error | null;
    onCreate: () => void;
    roomPass: string;
    onRoomPassChange: (value: string) => void;
    joining: boolean;
    joinError: Error | null;
    onJoin: () => void;
    onClose: () => void;
}

export function RoomJoinPanel({
    roomName, onRoomNameChange, creating, createError, onCreate,
    roomPass, onRoomPassChange, joining, joinError, onJoin, onClose
}: RoomJoinPanelProps) {
    return (
        <div className="overlay-backdrop" onClick={onClose}>
            <div className="overlay-panel room-overlay" onClick={(event) => event.stopPropagation()}>
                <div className="room-overlay-header">
                    <strong>Rooms</strong>
                    <button className="button" type="button" onClick={onClose}>Close</button>
                </div>
                <div className="room-overlay-grid">
                    <div className="stack">
                        <div className="section-title">Create / Join Room</div>
                        <input placeholder="Room name" value={roomName} onChange={(event) => onRoomNameChange(event.target.value)} />
                        <button className="button button-primary" type="button" onClick={onCreate} disabled={creating || !roomName.trim()}>
                            {creating ? "Creating..." : "Create Room"}
                        </button>
                        <input placeholder="starbyte://1234-1234" value={roomPass} onChange={(event) => onRoomPassChange(event.target.value)} />
                        <button className="button" type="button" onClick={onJoin} disabled={joining || !roomPass.trim()}>
                            {joining ? "Joining..." : "Join Room"}
                        </button>
                        {createError && <p className="error">{createError.message}</p>}
                        {joinError && <p className="error">{joinError.message}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RoomPassPanelProps {
    room: Room;
    copied: boolean;
    onClose: () => void;
    onGenerate: () => void;
    onCopy: () => void;
    onDelete: () => void;
}

export function RoomPassPanel({ room, copied, onClose, onGenerate, onCopy, onDelete }: RoomPassPanelProps) {
    return (
        <div className="overlay-backdrop" onClick={onClose}>
            <div className="overlay-panel room-overlay room-pass-panel" onClick={(event) => event.stopPropagation()}>
                <div className="room-overlay-header">
                    <strong>Room Pass</strong>
                    <button className="button" type="button" onClick={onClose}>Close</button>
                </div>
                <div className="stack">
                    <div className="muted">{room.name}</div>
                    <input readOnly value={room.roomPass ? `starbyte://${room.roomPass}` : ""} placeholder="No room pass yet" />
                    <div className="profile-actions">
                        <button className="button button-primary" type="button" onClick={onGenerate}>
                            {room.roomPass ? "Regenerate" : "Generate"}
                        </button>
                        <button className="button" type="button" disabled={!room.roomPass} onClick={onCopy}>
                            {copied ? "Copied" : "Copy link"}
                        </button>
                        <button className="button" type="button" disabled={!room.roomPass} onClick={onDelete}>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface RoomIconPanelProps {
    draft: string;
    onDraftChange: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
    onRemove: () => void;
}

export function RoomIconPanel({ draft, onDraftChange, onClose, onSave, onRemove }: RoomIconPanelProps) {
    return (
        <div className="overlay-backdrop" onClick={onClose}>
            <div className="overlay-panel room-overlay room-pass-panel" onClick={(event) => event.stopPropagation()}>
                <div className="room-overlay-header">
                    <strong>Room Icon</strong>
                    <button className="button" type="button" onClick={onClose}>Close</button>
                </div>
                <div className="stack">
                    <input placeholder="Image URL" value={draft} onChange={(event) => onDraftChange(event.target.value)} />
                    <div className="profile-actions">
                        <button className="button button-primary" type="button" onClick={onSave}>Save</button>
                        <button className="button" type="button" onClick={onRemove}>Remove</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface UserProfilePanelProps {
    user: RoomUser;
    currentUserId?: string;
    opening: boolean;
    error: Error | null;
    onClose: () => void;
    onMessage: () => void;
}

export function UserProfilePanel({ user, currentUserId, opening, error, onClose, onMessage }: UserProfilePanelProps) {
    return (
        <div className="overlay-backdrop" onClick={onClose}>
            <div className="overlay-panel room-overlay" onClick={(event) => event.stopPropagation()}>
                <div className="room-overlay-header">
                    <strong>User Profile</strong>
                    <button className="button" type="button" onClick={onClose}>Close</button>
                </div>
                <div className="stack">
                    <div className="profile-screen-top">
                        <AvatarSquare displayName={user.displayName} avatarUrl={user.avatarUrl} size="lg" />
                        <div className="profile-screen-copy">
                            <strong>{user.displayName}</strong>
                            <div className="muted">@{user.username}</div>
                            {user.statusText && <div className="muted">{user.statusText}</div>}
                        </div>
                    </div>
                    {user.bio && (
                        <div className="stack">
                            <span className="muted">Bio</span>
                            <div>{user.bio}</div>
                        </div>
                    )}
                    <button className="button button-primary" type="button" disabled={opening || user.id === currentUserId} onClick={onMessage}>
                        {opening ? "Opening..." : "Message"}
                    </button>
                    {error && <p className="error">{error.message}</p>}
                </div>
            </div>
        </div>
    );
}
