import { mediaUrl, type Room } from "../api";

function avatarInitial(name?: string) {
    return (name?.trim()?.charAt(0) || "?").toUpperCase();
}

export function AvatarSquare({displayName, avatarUrl, size = "sm"}: {
    displayName: string;
    avatarUrl?: string | null;
    size?: "sm" | "lg";
}) {return (<div className={`avatar-square avatar-square-${size}`}>
            {avatarUrl ? (
                <img src={mediaUrl(avatarUrl)} alt={displayName} className="avatar-image" />
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

export function RoomAvatar({ room }: { room: Room }) {
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

