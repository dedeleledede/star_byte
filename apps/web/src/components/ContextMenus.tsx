import type { Message } from "../api";

export interface RoomMenuState {
    type: "room" | "thread";
    id: string;
    x: number;
    y: number;
}

interface RoomContextMenuProps {
    menu: RoomMenuState;
    onRoomPass: () => void;
    onRoomIcon: () => void;
    onDeleteRoom: () => void;
    onDeleteThread: () => void;
}

export function RoomContextMenu({ menu, onRoomPass, onRoomIcon, onDeleteRoom, onDeleteThread }: RoomContextMenuProps) {
    return (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
            {menu.type === "room" ? (
                <>
                    <button type="button" className="context-menu-item" onClick={onRoomPass}>Room Pass</button>
                    <button type="button" className="context-menu-item" onClick={onRoomIcon}>Change Room Icon</button>
                    <button type="button" className="context-menu-item context-menu-item-danger" onClick={onDeleteRoom}>Delete Room</button>
                </>
            ) : (
                <button type="button" className="context-menu-item context-menu-item-danger" onClick={onDeleteThread}>Delete Thread</button>
            )}
        </div>
    );
}

export interface MessageMenuState {
    message: Message;
    x: number;
    y: number;
}

interface MessageContextMenuProps {
    menu: MessageMenuState;
    currentUserId?: string;
    onReply: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function MessageContextMenu({ menu, currentUserId, onReply, onEdit, onDelete }: MessageContextMenuProps) {
    return (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
            <button type="button" className="context-menu-item" onClick={onReply}>Reply</button>
            {menu.message.userId === currentUserId && (
                <>
                    <button type="button" className="context-menu-item" onClick={onEdit}>Edit Message</button>
                    <button type="button" className="context-menu-item context-menu-item-danger" onClick={onDelete}>Delete Message</button>
                </>
            )}
        </div>
    );
}
