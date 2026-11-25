import { useEffect, useMemo, useState, type RefObject } from "react";
import type { ThreadMember } from "../api";

export function useMentions(
    draft: string,
    setDraft: (value: string) => void,
    composerRef: RefObject<HTMLInputElement | null>,
    members: ThreadMember[],
    threadId?: string
) {
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    const mentionSuggestions = useMemo(() => {
        const q = mentionQuery.trim().toLowerCase();

        return members.filter((member) => {
            if (!q) return true;
            return (
                member.username.toLowerCase().includes(q) ||
                member.displayName.toLowerCase().includes(q)
            );
        });
    }, [members, mentionQuery]);

    function resetMentions() {
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        setSelectedMentionIndex(0);
    }

    function updateMentionState(nextValue: string, caret: number) {
        const beforeCaret = nextValue.slice(0, caret);
        const atIndex = beforeCaret.lastIndexOf("@");

        if (atIndex === -1) {
            resetMentions();
            return;
        }

        const query = beforeCaret.slice(atIndex + 1);

        // keep the current "cancel if invalid characters appear after @"
        if (!/^[a-zA-Z0-9_]*$/.test(query)) {
            resetMentions();
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

    useEffect(() => {
        resetMentions();
    }, [threadId]);

    return {
        mentionOpen, mentionSuggestions,
        selectedMentionIndex, setSelectedMentionIndex,
        updateMentionState, insertMention, insertMentionAtCursor, resetMentions
    };
}
