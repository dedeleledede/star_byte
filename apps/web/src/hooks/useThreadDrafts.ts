import { useEffect, useState } from "react";

const DRAFT_STORAGE_KEY = "starbyte.thread-drafts";

function loadDrafts(): Record<string, Record<string, string>> {
    try {
        const stored = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? "{}");
        if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};

        return Object.fromEntries(Object.entries(stored).map(([userId, drafts]) => [
            userId,
            drafts && typeof drafts === "object" && !Array.isArray(drafts)
                ? Object.fromEntries(Object.entries(drafts).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
                : {}
        ]));
    } catch {
        return {};
    }
}

export function useThreadDrafts(userId?: string, threadId?: string) {
    const [draftsByUser, setDraftsByUser] = useState(loadDrafts);
    const draft = userId && threadId ? draftsByUser[userId]?.[threadId] ?? "" : "";

    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftsByUser));
        } catch {
            // Drafts remain available in this session if local storage is unavailable.
        }
    }, [draftsByUser]);

    function setDraftForThread(targetThreadId: string, value: string | ((current: string) => string)) {
        if (!userId) return;

        setDraftsByUser((current) => {
            const userDrafts = current[userId] ?? {};
            const previous = userDrafts[targetThreadId] ?? "";
            const nextValue = typeof value === "function" ? value(previous) : value;
            if (previous === nextValue) return current;

            const nextUserDrafts = { ...userDrafts };
            if (nextValue) nextUserDrafts[targetThreadId] = nextValue;
            else delete nextUserDrafts[targetThreadId];

            const next = { ...current };
            if (Object.keys(nextUserDrafts).length) next[userId] = nextUserDrafts;
            else delete next[userId];
            return next;
        });
    }

    function setDraft(value: string | ((current: string) => string)) {
        if (threadId) setDraftForThread(threadId, value);
    }

    return { draft, setDraft, setDraftForThread };
}
