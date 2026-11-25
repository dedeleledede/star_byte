import { useQuery } from "@tanstack/react-query";
import { fetchEmbed, mediaUrl } from "../api";

const ROOM_PASS_RE = /starbyte:\/\/\d{4}-\d{4}/i;
const URL_TOKEN_RE = /^(?:https?:\/\/[^\s<]+|\/api\/uploads\/images\/[^\s<]+)$/i;
const EMBED_URL_RE = /https?:\/\/[^\s<]+|\/api\/uploads\/images\/[^\s<]+|starbyte:\/\/\d{4}-\d{4}/gi;
export const UPLOADED_IMAGE_RE = /^\/api\/uploads\/images\/[a-f0-9-]+\.(?:png|jpg|gif|webp)$/i;

export function renderMessageBody(
    body: string,
    currentUsername: string | undefined,
    onJoinRoomPass: (roomPass: string) => void,
    validMentionUsernames: ReadonlySet<string>
) {
    const parts = body.split(/(\s+)/);

    return parts.map((part, index) => {
        if (!part.trim()) {
            return <span key={index}>{part}</span>;
        }

        if (ROOM_PASS_RE.test(part)) {
            return (
                <button
                    key={index}
                    type="button"
                    className="inline-room-pass"
                    onClick={() => onJoinRoomPass(part)}
                >
                    {part}
                </button>
            );
        }

        if (URL_TOKEN_RE.test(part)) {
            return (
                <a
                    key={index}
                    href={mediaUrl(part)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-link"
                >
                    {part}
                </a>
            );
        }

        if (!part.startsWith("@")) {
            return <span key={index}>{part}</span>;
        }

        const usernameMatch = part.match(/^@([a-zA-Z0-9_]+)([^a-zA-Z0-9_]*)$/);
        if (!usernameMatch) {
            return <span key={index}>{part}</span>;
        }

        const [, rawUsername, trailing = ""] = usernameMatch;
        const normalizedUsername = rawUsername.toLowerCase();
        const isValidMention = validMentionUsernames.has(normalizedUsername);

        if (!isValidMention) {
            return <span key={index}>{part}</span>;
        }

        const isSelfMention = normalizedUsername === currentUsername?.toLowerCase();

        return (
            <span key={index}>
            <span className={isSelfMention ? "mention mention-self" : "mention"}>
                @{rawUsername}
            </span>
                {trailing}
        </span>
        );
    });
}

export function extractUrls(text: string) {
    return Array.from(new Set(text.match(EMBED_URL_RE) ?? []));
}

export function MessageEmbed({url, onJoinRoomPass}: {
    url: string;
    onJoinRoomPass: (roomPass: string) => void;
}) {
    if (ROOM_PASS_RE.test(url)) {
        return <RoomPassEmbed roomPass={url} onJoin={onJoinRoomPass} />;
    }

    return <LinkEmbed url={url} />;
}

function LinkEmbed({url}: {url: string}) {
    const embedQuery = useQuery({
        queryKey: ["embed", url],
        queryFn: () => fetchEmbed(url).then((data) => data.embed),
        staleTime: 1000 * 60 * 10,
        retry: 1
    });

    if (embedQuery.isLoading) {
        return <div className="link-embed muted">Loading preview…</div>;
    }

    const embed = embedQuery.data;
    if (!embed) return null;

    if (embed.embedType === "video" && embed.embedUrl) {
        return (
            <div className="link-embed">
                <div className="link-embed-top">
                    <div className="link-embed-site">
                        {embed.iconUrl && <img src={embed.iconUrl} alt="" className="embed-icon" />}
                        <span>{embed.siteName ?? embed.provider ?? "Video"}</span>
                    </div>
                </div>

                {embed.title && <strong className="link-embed-title">{embed.title}</strong>}
                {embed.description && <div className="link-embed-desc">{embed.description}</div>}

                <div className="embed-media">
                    <iframe
                        src={embed.embedUrl}
                        title={embed.title ?? embed.url}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            </div>
        );
    }

    return (
        <a
            className="link-embed"
            href={embed.url}
            target="_blank"
            rel="noreferrer"
        >
            <div className="link-embed-top">
                <div className="link-embed-site">
                    {embed.iconUrl && <img src={embed.iconUrl} alt="" className="embed-icon" />}
                    <span>{embed.siteName ?? embed.provider ?? new URL(embed.url).hostname}</span>
                </div>
            </div>

            {embed.title && <strong className="link-embed-title">{embed.title}</strong>}
            {embed.description && <div className="link-embed-desc">{embed.description}</div>}
            {embed.imageUrl && <img src={embed.imageUrl} alt="" className="embed-image" />}
        </a>
    );
}

export function MessageAttachment({url}: { url: string }) {
    return (
        <a className="uploaded-image" href={mediaUrl(url)} target="_blank" rel="noreferrer">
            <img src={mediaUrl(url)} alt="Uploaded attachment" />
        </a>
    );
}

function RoomPassEmbed({roomPass, onJoin}: {
    roomPass: string;
    onJoin: (roomPass: string) => void;
}) {
    return (
        <div className="room-pass-embed">
            <div className="room-pass-embed-top">
                <strong>Room Pass</strong>
                <span className="muted">Invite link</span>
            </div>

            <button
                type="button"
                className="room-pass-link"
                onClick={() => onJoin(roomPass)}
            >
                {roomPass}
            </button>

            <div className="room-pass-embed-actions">
                <button
                    type="button"
                    className="button button-primary"
                    onClick={() => onJoin(roomPass)}
                >
                    Join
                </button>
            </div>
        </div>
    );
}

