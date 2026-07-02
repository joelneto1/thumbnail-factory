import path from "node:path";
import { COMPETITORS_DIR, writeBuffer, toRelative } from "./files";

const YT_VIDEO_ID_REGEXES = [
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/,
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
];

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  for (const re of YT_VIDEO_ID_REGEXES) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

const TITLE_REGEX = /<title>([^<]+)<\/title>/i;
const META_TITLE_REGEX = /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_REGEX = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const og = html.match(OG_TITLE_REGEX);
    if (og) return decodeHtmlEntities(og[1]);

    const meta = html.match(META_TITLE_REGEX);
    if (meta) return decodeHtmlEntities(meta[1]);

    const title = html.match(TITLE_REGEX);
    if (title) {
      // YouTube usa "Título do vídeo - YouTube"
      return decodeHtmlEntities(title[1].replace(/\s*-\s*YouTube\s*$/i, ""));
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeThumbnail(videoId: string): Promise<{
  buffer: Buffer;
  resolution: "max" | "hq";
} | null> {
  // Tenta maxres primeiro
  for (const variant of ["maxresdefault", "hqdefault"] as const) {
    try {
      const url = `https://i.ytimg.com/vi/${videoId}/${variant}.jpg`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1024) {
          return {
            buffer: buf,
            resolution: variant === "maxresdefault" ? "max" : "hq",
          };
        }
      }
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * Pipeline completo: URL → salva thumbnail em data/competitors/, retorna
 * o caminho relativo + título sugerido.
 */
export async function fetchCompetitorFromUrl(input: string): Promise<{
  videoId: string;
  thumbRelPath: string;
  suggestedTitle: string | null;
  resolution: "max" | "hq";
}> {
  const videoId = extractVideoId(input);
  if (!videoId) {
    throw new Error("URL do YouTube inválida ou videoID não encontrado");
  }

  const [thumb, title] = await Promise.all([
    fetchYouTubeThumbnail(videoId),
    fetchYouTubeTitle(videoId),
  ]);

  if (!thumb) {
    throw new Error("Não consegui baixar a thumbnail desse vídeo");
  }

  const filename = `${videoId}_${Date.now()}.jpg`;
  const absPath = path.join(COMPETITORS_DIR, filename);
  await writeBuffer(absPath, thumb.buffer);

  return {
    videoId,
    thumbRelPath: toRelative(absPath),
    suggestedTitle: title,
    resolution: thumb.resolution,
  };
}
