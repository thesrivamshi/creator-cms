// OpenGraph metadata + readability-lite text extraction. Used for
// Instagram/Twitter (metadata only — no login-wall scraping in v1) and
// generic articles (docs/04-capture-flows.md).

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface MetaResult {
  title: string | null;
  description: string | null;
  text: string | null; // main article text (articles only)
}

function metaContent(html: string, patterns: string[]): string | null {
  for (const p of patterns) {
    // property/name before or after content= — both orders occur in the wild
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`,
      "i"
    );
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

export async function scrapeMeta(
  url: string,
  extractText: boolean
): Promise<MetaResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    const html = await res.text();

    const titleTag =
      decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "") || null;
    const title = metaContent(html, ["og:title", "twitter:title"]) ?? titleTag;
    const description = metaContent(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);

    let text: string | null = null;
    if (extractText) {
      // Readability-lite: strip scripts/styles, take <p> contents.
      const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "");
      const paragraphs = Array.from(cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
        .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 40);
      const joined = paragraphs.join("\n\n").slice(0, 20000);
      text = joined.length > 0 ? joined : null;
    }

    return { title, description, text };
  } catch {
    return { title: null, description: null, text: null };
  }
}
