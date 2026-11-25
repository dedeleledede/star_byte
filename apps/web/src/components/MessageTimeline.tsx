import type { RefObject, MouseEvent as ReactMouseEvent } from "react";
import type { Message, User } from "../api";
import { AvatarSquare } from "./Avatars";
import { extractUrls, MessageAttachment, MessageEmbed, renderMessageBody, UPLOADED_IMAGE_RE } from "./MessageContent";

function isGroupedWithPrevious(current: { userId: string; createdAt: string }, previous?: { userId: string; createdAt: string }) {
    if (!previous || previous.userId !== current.userId) return false;
    return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() < 10 * 60 * 1000;
}

interface MessageTimelineProps {
    messages: Message[];
    messagesRef: RefObject<HTMLElement | null>;
    onScrollPosition: (element: HTMLElement) => void;
    onMessageElement: (messageId: string, element: HTMLElement | null) => void;
    searchTargetMessageId?: string;
    currentUser?: User;
    editingMessageId: string | null;
    editingDraft: string;
    onEditingDraftChange: (value: string) => void;
    isSavingEdit: boolean;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onScrollToMessage: (messageId: string) => void;
    onReply: (message: Message) => void;
    onEdit: (message: Message) => void;
    onContextMenu: (menu: { message: Message; x: number; y: number }) => void;
    onChatIdentityClick: (userId: string, username: string, shiftKey: boolean) => void;
    onAuthorMouseUp: (event: ReactMouseEvent<HTMLElement>, userId: string, username: string) => void;
    validMentionUsernames: ReadonlySet<string>;
    onJoinRoomPass: (roomPass: string) => void;
}

export function MessageTimeline({
    messages, messagesRef, onScrollPosition, onMessageElement, searchTargetMessageId,
    currentUser, editingMessageId, editingDraft, onEditingDraftChange, isSavingEdit,
    onSaveEdit, onCancelEdit, onScrollToMessage, onReply, onEdit, onContextMenu,
    onChatIdentityClick, onAuthorMouseUp, validMentionUsernames, onJoinRoomPass
}: MessageTimelineProps) {
    const messagesById = new Map(messages.map((message) => [message.id, message]));

    return (
        <section className="messages" ref={messagesRef} onScroll={(event) => onScrollPosition(event.currentTarget)}>
            {messages.map((message, index) => {
                const grouped = isGroupedWithPrevious(message, messages[index - 1]);
                const isEditing = editingMessageId === message.id;
                const repliedTo = message.replyToMessageId ? messagesById.get(message.replyToMessageId) : null;
                const isOwnMessage = message.userId === currentUser?.id;

                const content = isEditing ? (
                    <div className="message-edit-inline">
                        <input
                            value={editingDraft}
                            onChange={(event) => onEditingDraftChange(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && editingDraft.trim() && !isSavingEdit) {
                                    event.preventDefault();
                                    onSaveEdit();
                                }
                                if (event.key === "Escape") {
                                    event.preventDefault();
                                    onCancelEdit();
                                }
                            }}
                            autoFocus
                        />
                        <div className="message-inline-actions message-inline-actions-visible">
                            <button type="button" className="button button-primary" onClick={onSaveEdit} disabled={isSavingEdit || !editingDraft.trim()}>
                                {isSavingEdit ? "Saving..." : "Save"}
                            </button>
                            <button type="button" className="button" onClick={onCancelEdit} disabled={isSavingEdit}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {message.replyToMessageId && (
                            <button
                                type="button"
                                className="message-reply-reference"
                                onClick={() => repliedTo && onScrollToMessage(repliedTo.id)}
                                disabled={!repliedTo}
                            >
                                {repliedTo
                                    ? `Replying to @${repliedTo.username}: ${repliedTo.body.slice(0, 80)}`
                                    : "Original message unavailable"}
                            </button>
                        )}
                        <span>{renderMessageBody(message.body, currentUser?.username, onJoinRoomPass, validMentionUsernames)}</span>
                        {extractUrls(message.body).map((url) => (
                            UPLOADED_IMAGE_RE.test(url)
                                ? <MessageAttachment key={url} url={url} />
                                : <MessageEmbed key={url} url={url} onJoinRoomPass={onJoinRoomPass} />
                        ))}
                    </>
                );

                const actions = isEditing ? (
                    <div className="message-actions-placeholder" />
                ) : (
                    <div className="message-actions">
                        <button type="button" className="message-inline-action" onClick={() => onReply(message)}>Reply</button>
                        {isOwnMessage && (
                            <button type="button" className="message-inline-action" onClick={() => onEdit(message)}>Edit</button>
                        )}
                    </div>
                );

                const messageText = (
                    <div className={grouped ? "message-text message-text-grouped" : "message-text"}>
                        <span className="message-prefix">&gt;</span>
                        <div className="stack message-content">{content}</div>
                        {actions}
                    </div>
                );

                return (
                    <article
                        key={message.id}
                        ref={(element) => onMessageElement(message.id, element)}
                        className={[
                            "message-line",
                            grouped ? "message-line-grouped" : "",
                            searchTargetMessageId === message.id ? "message-line-search-target" : ""
                        ].filter(Boolean).join(" ")}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            onContextMenu({ message, x: event.clientX, y: event.clientY });
                        }}
                    >
                        {grouped ? messageText : (
                            <div className="message-main">
                                <button
                                    type="button"
                                    className="avatar-button"
                                    onClick={(event) => onChatIdentityClick(message.userId, message.username, event.shiftKey)}
                                >
                                    <AvatarSquare displayName={message.displayName} avatarUrl={message.avatarUrl} size="sm" />
                                </button>
                                <div className="message-body-block">
                                    <div className="message-meta">
                                        <span
                                            className="message-author-text"
                                            onMouseUp={(event) => onAuthorMouseUp(event, message.userId, message.username)}
                                        >
                                            <strong>{message.displayName}</strong>
                                            <span className="muted">@{message.username}</span>
                                        </span>
                                        <span className="muted">{new Date(message.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    {messageText}
                                </div>
                            </div>
                        )}
                    </article>
                );
            })}
        </section>
    );
}
