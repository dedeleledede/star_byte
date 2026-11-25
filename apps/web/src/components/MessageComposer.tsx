import type { Dispatch, RefObject, SetStateAction, SyntheticEvent } from "react";
import type { Message, ThreadMember } from "../api";
import { AvatarSquare } from "./Avatars";

interface MessageComposerProps {
    composerRef: RefObject<HTMLInputElement | null>;
    draft: string;
    onDraftChange: (value: string, caret: number) => void;
    onSend: (event: SyntheticEvent) => void;
    canSend: boolean;
    sending: boolean;
    sendError: Error | null;
    replyingToMessage: Message | null;
    onCancelReply: () => void;
    mentionOpen: boolean;
    mentionSuggestions: ThreadMember[];
    selectedMentionIndex: number;
    setSelectedMentionIndex: Dispatch<SetStateAction<number>>;
    onCloseMention: () => void;
    onInsertMention: (username: string) => void;
    uploading: boolean;
    uploadError: Error | null;
    onUpload: (file: File) => void;
}

export function MessageComposer({
    composerRef, draft, onDraftChange, onSend, canSend, sending, sendError,
    replyingToMessage, onCancelReply, mentionOpen, mentionSuggestions,
    selectedMentionIndex, setSelectedMentionIndex, onCloseMention, onInsertMention,
    uploading, uploadError, onUpload
}: MessageComposerProps) {
    return (
        <form className="composer" onSubmit={onSend}>
            {replyingToMessage && (
                <div className="composer-context">
                    <span>Replying to <strong>@{replyingToMessage.username}</strong>: {replyingToMessage.body.slice(0, 90)}</span>
                    <button type="button" className="message-inline-action" onClick={onCancelReply}>Cancel</button>
                </div>
            )}
            <input
                ref={composerRef}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
                onKeyDown={(event) => {
                    if (!mentionOpen || mentionSuggestions.length === 0) return;
                    if (event.ctrlKey || event.metaKey || event.altKey) return;

                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setSelectedMentionIndex((value) => Math.min(value + 1, mentionSuggestions.length - 1));
                    } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setSelectedMentionIndex((value) => Math.max(value - 1, 0));
                    } else if (event.key === "Enter" || event.key === "Tab") {
                        event.preventDefault();
                        onInsertMention(mentionSuggestions[selectedMentionIndex].username);
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        onCloseMention();
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
                                onInsertMention(member.username);
                            }}
                        >
                            <AvatarSquare displayName={member.displayName} avatarUrl={member.avatarUrl} size="sm" />
                            <span>@{member.username}</span>
                            <span className="muted">{member.displayName}</span>
                        </button>
                    ))}
                </div>
            )}

            <label className="button attachment-button">
                {uploading ? "Uploading..." : "Image"}
                <input
                    className="file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    disabled={uploading}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUpload(file);
                        event.target.value = "";
                    }}
                />
            </label>
            <button className="button button-primary" disabled={sending || !canSend}>Send</button>
            {sendError && <p className="error">{sendError.message}</p>}
            {uploadError && <p className="error">{uploadError.message}</p>}
        </form>
    );
}
