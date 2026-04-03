import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

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
    if (url.hostname.includes("youtu.be")) {
        return url.pathname.slice(1) || null;
    }

    if (url.hostname.includes("youtube.com")) {
        if (url.pathname === "/watch") {
            return url.searchParams.get("v");
        }

        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.findIndex((part) => part === "embed" || part === "shorts");
        if (idx !== -1) {
            return parts[idx + 1] ?? null;
        }
    }

    return null;
}

export const embedRoutes: FastifyPluginAsync = async (app) => {
    app.get("/embeds", {
        preHandler: app.authenticate
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
            let title: string | null = null;
            let author: string | null = null;

            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = (await response.json()) as {
                        title?: string;
                        author_name?: string;
                        thumbnail_url?: string;
                    };

                    title = data.title ?? null;
                    author = data.author_name ?? null;

                    return {
                        embed: {
                            url: url.toString(),
                            siteName: "YouTube",
                            title,
                            description: author,
                            imageUrl: data.thumbnail_url ?? null,
                            iconUrl: "https://www.youtube.com/favicon.ico",
                            embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
                            embedType: "video",
                            provider: "YouTube"
                        }
                    };
                }
            } catch {
                // fall through to generic
            }
        }

        try {
            const response = await fetch(url.toString(), {
                redirect: "follow",
                headers: {
                    "User-Agent": "StarByteBot/1.0 (+https://starbyte.local)"
                }
            });

            const html = await response.text();
            const finalUrl = response.url || url.toString();
            const final = new URL(finalUrl);

            return {
                embed: {
                    url: finalUrl,
                    siteName: extractSiteName(html, final),
                    title:
                        extractMeta(html, "property", "og:title") ??
                        extractMeta(html, "name", "twitter:title") ??
                        extractTitle(html),
                    description: extractDescription(html),
                    imageUrl: extractImage(html, finalUrl),
                    iconUrl: extractFavicon(html, finalUrl),
                    embedUrl: null,
                    embedType: "generic",
                    provider: final.hostname.replace(/^www\./i, "")
                }
            };
        } catch {
            return {
                embed: {
                    url: url.toString(),
                    siteName: url.hostname.replace(/^www\./i, ""),
                    title: url.hostname.replace(/^www\./i, ""),
                    description: null,
                    imageUrl: null,
                    iconUrl: absolutize(url.toString(), "/favicon.ico"),
                    embedUrl: null,
                    embedType: "generic",
                    provider: url.hostname.replace(/^www\./i, "")
                }
            };
        }
    });
};