import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_JSON_BYTES = 64 * 1024;

function extractMeta(html: string, attr: "property" | "name", key: string) {
    const re = new RegExp(
        `<meta[^>]+${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i"
    );
    return html.match(re)?.[1] ?? null;
}

function extractTitle(html: string) {
    return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
}

function absolutize(base: string, value: string | null) {
    if (!value) return null;
    try {
        return new URL(value, base).toString();
    } catch {
        return null;
    }
}

function extractDescription(html: string) {
    return (
        extractMeta(html, "property", "og:description") ??
        extractMeta(html, "name", "description") ??
        extractMeta(html, "name", "twitter:description")
    );
}

function extractImage(html: string, base: string) {
    return absolutize(
        base,
        extractMeta(html, "property", "og:image") ??
        extractMeta(html, "name", "twitter:image")
    );
}

function extractSiteName(html: string, url: URL) {
    return (
        extractMeta(html, "property", "og:site_name") ??
        extractMeta(html, "name", "application-name") ??
        url.hostname.replace(/^www\./i, "")
    );
}

function extractFavicon(html: string, base: string) {
    const re = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i;
    const href = html.match(re)?.[1] ?? "/favicon.ico";
    return absolutize(base, href);
}

function extractYouTubeVideoId(url: URL) {
    if (url.hostname === "youtu.be") {
        return url.pathname.slice(1) || null;
    }

    if (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) {
        if (url.pathname === "/watch") {
            return url.searchParams.get("v");
        }

        const parts = url.pathname.split("/").filter(Boolean);
        const index = parts.findIndex((part) => part === "embed" || part === "shorts");
        if (index !== -1) {
            return parts[index + 1] ?? null;
        }
    }

    return null;
}

function isPrivateIpv4(address: string) {
    const octets = address.split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return true;
    }

    const [a, b] = octets;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 0) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 198 && b === 51 && octets[2] === 100) ||
        (a === 203 && b === 0 && octets[2] === 113) ||
        a >= 224
    );
}

function isPrivateAddress(address: string) {
    const normalized = address.toLowerCase().split("%")[0];

    if (isIP(normalized) === 4) {
        return isPrivateIpv4(normalized);
    }

    if (isIP(normalized) !== 6) {
        return true;
    }

    if (normalized.startsWith("::ffff:")) {
        return isPrivateIpv4(normalized.slice("::ffff:".length));
    }

    return (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        /^fe[89abcdef]/.test(normalized) ||
        normalized.startsWith("ff") ||
        normalized.startsWith("2001:db8:")
    );
}

async function assertPublicUrl(url: URL) {
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("unsupported protocol");
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
        throw new Error("private host");
    }

    const addresses = isIP(hostname)
        ? [{ address: hostname }]
        : await lookup(hostname, { all: true, verbatim: true });

    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error("private host");
    }
}

async function readLimitedText(response: Response, maxBytes: number) {
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
        throw new Error("response too large");
    }

    if (!response.body) return "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bytes += value.byteLength;
        if (bytes > maxBytes) {
            await reader.cancel();
            throw new Error("response too large");
        }

        text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
}

async function fetchPublicText(
    initialUrl: URL,
    acceptedContentTypes: string[],
    maxBytes: number
) {
    let url = initialUrl;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        await assertPublicUrl(url);

        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
                "User-Agent": "StarByteBot/1.0"
            }
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location || redirectCount === MAX_REDIRECTS) {
                throw new Error("invalid redirect");
            }

            url = new URL(location, url);
            continue;
        }

        if (!response.ok) {
            throw new Error("embed fetch failed");
        }

        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (!acceptedContentTypes.some((accepted) => contentType.startsWith(accepted))) {
            throw new Error("unsupported content type");
        }

        return {
            text: await readLimitedText(response, maxBytes),
            url
        };
    }

    throw new Error("too many redirects");
}

function fallbackEmbed(url: URL) {
    return {
        embed: {
            url: url.toString(),
            siteName: url.hostname.replace(/^www\./i, ""),
            title: url.hostname.replace(/^www\./i, ""),
            description: null,
            imageUrl: null,
            iconUrl: absolutize(url.toString(), "/favicon.ico"),
            embedUrl: null,
            embedType: "generic" as const,
            provider: url.hostname.replace(/^www\./i, "")
        }
    };
}

export const embedRoutes: FastifyPluginAsync = async (app) => {
    app.get("/embeds", {
        preHandler: app.authenticate,
        config: {
            rateLimit: { max: 30, timeWindow: "1 minute" }
        }
    }, async (request, reply) => {
        const parsed = z.object({
            url: z.string().url()
        }).safeParse(request.query);

        if (!parsed.success) {
            return reply.code(400).send({ error: "invalid url" });
        }

        const url = new URL(parsed.data.url);
        if (!["http:", "https:"].includes(url.protocol)) {
            return reply.code(400).send({ error: "unsupported protocol" });
        }

        const youtubeId = extractYouTubeVideoId(url);
        if (youtubeId) {
            try {
                const oembedUrl = new URL(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`);
                const response = await fetchPublicText(oembedUrl, ["application/json"], MAX_JSON_BYTES);
                const data = JSON.parse(response.text) as {
                    title?: string;
                    author_name?: string;
                    thumbnail_url?: string;
                };

                return {
                    embed: {
                        url: url.toString(),
                        siteName: "YouTube",
                        title: data.title ?? null,
                        description: data.author_name ?? null,
                        imageUrl: data.thumbnail_url ?? null,
                        iconUrl: "https://www.youtube.com/favicon.ico",
                        embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
                        embedType: "video",
                        provider: "YouTube"
                    }
                };
            } catch {
                // Fall through to the bounded generic preview.
            }
        }

        try {
            const response = await fetchPublicText(url, ["text/html", "application/xhtml+xml"], MAX_HTML_BYTES);
            const finalUrl = response.url.toString();

            return {
                embed: {
                    url: finalUrl,
                    siteName: extractSiteName(response.text, response.url),
                    title:
                        extractMeta(response.text, "property", "og:title") ??
                        extractMeta(response.text, "name", "twitter:title") ??
                        extractTitle(response.text),
                    description: extractDescription(response.text),
                    imageUrl: extractImage(response.text, finalUrl),
                    iconUrl: extractFavicon(response.text, finalUrl),
                    embedUrl: null,
                    embedType: "generic",
                    provider: response.url.hostname.replace(/^www\./i, "")
                }
            };
        } catch {
            return fallbackEmbed(url);
        }
    });
};
