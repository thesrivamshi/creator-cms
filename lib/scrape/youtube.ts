// YouTube extraction without API keys: parse ytInitialPlayerResponse from the
// watch page for title/description + caption track, then fetch the captions.
// If captions are unavailable, callers fall back to title+description only
// and note it in agent_notes (docs/04-capture-flows.md).

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface YouTubeResult {
  title: string | null;
  description: string | null;
  transcript: string | null;
  captionNote: string | null;
}

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

export async function scrapeYouTube(url: string): Promise<YouTubeResult> {
  const id = youtubeVideoId(url);
  const watchUrl = id ? `https://www.youtube.com/watch?v=${id}` : url;

  let title: string | null = null;
  let description: string | null = null;
  let transcript: string | null = null;
  let captionNote: string | null = null;

  try {
    const res = await fetch(watchUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();

    const playerJson = extractPlayerResponse(html);
    if (playerJson) {
      title = playerJson.videoDetails?.title ?? null;
      description = playerJson.videoDetails?.shortDescription ?? null;

      const tracks: CaptionTrack[] =
        playerJson.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      const track =
        tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
        tracks.find((t) => t.languageCode?.startsWith("en")) ??
        tracks[0];

      if (track?.baseUrl) {
        transcript = await fetchCaptions(track.baseUrl);
        if (!transcript) captionNote = "Captions exist but YouTube blocked server-side fetch; using title/description.";
      } else {
        captionNote = "No captions available; using title/description only.";
      }
    }
  } catch {
    captionNote = "YouTube page fetch failed.";
  }

  // oEmbed fallback for the title (no key required, rarely blocked).
  if (!title) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { title?: string };
        title = data.title ?? null;
      }
    } catch {
      // keep nulls; capture is still saved
    }
  }

  return { title, description, transcript, captionNote };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlayerResponse(html: string): any | null {
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  // Balanced-brace scan — the object is followed by `;` then more script.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchCaptions(baseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}&fmt=json3`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      events?: { segs?: { utf8?: string }[] }[];
    };
    const text = (data.events ?? [])
      .flatMap((e) => e.segs ?? [])
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
