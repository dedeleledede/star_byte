import type { Dispatch, RefObject, SetStateAction, SyntheticEvent } from "react";
import type { MessageSearchFilters, SearchMessage, Thread, User } from "../api";
import { SearchDatePicker, SearchUserPicker } from "./SearchControls";

interface SearchOverlayProps {
    context: { roomId?: string; threadId?: string; label: string } | null;
    filters: MessageSearchFilters;
    setFilters: Dispatch<SetStateAction<MessageSearchFilters>>;
    users: User[];
    threads: Thread[];
    inputRef: RefObject<HTMLInputElement | null>;
    onSubmit: (event: SyntheticEvent) => void;
    onClose: () => void;
    pending: boolean;
    hasResults: boolean;
    error: Error | null;
    results: SearchMessage[];
    hasNextPage: boolean;
    fetchingNextPage: boolean;
    onFetchNextPage: () => void;
    onOpenResult: (result: SearchMessage) => void;
}

export function SearchOverlay({
    context, filters, setFilters, users, threads, inputRef, onSubmit, onClose,
    pending, hasResults, error, results, hasNextPage, fetchingNextPage,
    onFetchNextPage, onOpenResult
}: SearchOverlayProps) {
    return (
        <div className="overlay-backdrop" onClick={onClose}>
            <div className="overlay-panel search-overlay" role="dialog" aria-modal="true" aria-label="Search messages" onClick={(event) => event.stopPropagation()}>
                <div className="room-overlay-header">
                    <strong>Search in {context?.label}</strong>
                    <button className="button" type="button" onClick={onClose}>Close</button>
                </div>
                <form className="search-form" onSubmit={onSubmit}>
                    <label className="stack search-wide">
                        <span>Text</span>
                        <input ref={inputRef} autoFocus placeholder="Search message text" value={filters.q ?? ""} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value }))} />
                    </label>
                    <SearchUserPicker label="Sent from" users={users} value={filters.userId} valueKey="id" onChange={(userId) => setFilters((value) => ({ ...value, userId }))} />
                    {context?.roomId && (
                        <label className="stack">
                            <span>Thread</span>
                            <select value={filters.threadId ?? ""} onChange={(event) => setFilters((value) => ({ ...value, threadId: event.target.value || undefined }))}>
                                <option value="">All threads</option>
                                {threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}
                            </select>
                        </label>
                    )}
                    <SearchDatePicker label="From date" value={filters.after} onChange={(after) => setFilters((value) => ({ ...value, after }))} />
                    <SearchDatePicker label="Through date" value={filters.before} onChange={(before) => setFilters((value) => ({ ...value, before }))} />
                    <SearchUserPicker label="Mentions" users={users} value={filters.mentions} valueKey="username" onChange={(mentions) => setFilters((value) => ({ ...value, mentions }))} />
                    <div className="search-checks">
                        <label><input type="checkbox" checked={Boolean(filters.hasLink)} onChange={(event) => setFilters((value) => ({ ...value, hasLink: event.target.checked }))} /> Links</label>
                        <label><input type="checkbox" checked={Boolean(filters.hasAttachment)} onChange={(event) => setFilters((value) => ({ ...value, hasAttachment: event.target.checked }))} /> Attachments</label>
                    </div>
                    <button className="button button-primary search-wide" type="submit">Search</button>
                </form>
                <div className="search-results" aria-live="polite">
                    {pending && <p className="muted">Searching…</p>}
                    {error && <p className="error">{error.message}</p>}
                    {results.map((result) => (
                        <button className="search-result" type="button" key={result.id} onClick={() => onOpenResult(result)}>
                            <span className="muted">{result.roomName ? `${result.roomName} / ` : ""}{result.threadTitle} · @{result.username} · {new Date(result.createdAt).toLocaleString()}</span>
                            <span>{result.body}</span>
                        </button>
                    ))}
                    {hasResults && results.length === 0 && <p className="muted">No messages found.</p>}
                    {hasNextPage && (
                        <button className="button" type="button" disabled={fetchingNextPage} onClick={onFetchNextPage}>
                            {fetchingNextPage ? "Loading…" : "Load more"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
