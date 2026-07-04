import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeYouTube } from "@/lib/scrape/youtube";
import { scrapeMeta } from "@/lib/scrape/meta";
import { detectSourceType, enrichIdea } from "@/lib/capture";

// Called by the iOS Shortcut with `Authorization: Bearer <capture_token>`.
// Save-first, enrich-second: the idea row exists before any scrape/AI work,
// so a capture is never lost (docs/04-capture-flows.md).

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Missing capture token" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("capture_token", token)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Invalid capture token" }, { status: 401 });
  }
  const userId = profile.user_id;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : null;
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Body must be { \"url\": \"https://…\" }" }, { status: 400 });
  }

  const sourceType = detectSourceType(url);

  // 1. Save first — the capture exists no matter what happens below.
  const { data: idea, error: insertError } = await supabase
    .from("ideas")
    .insert({
      user_id: userId,
      source_type: sourceType,
      source_url: url,
      status: "captured",
      title: url, // placeholder until scrape/enrichment improves it
    })
    .select("id")
    .single();

  if (insertError || !idea) {
    return NextResponse.json({ error: "Failed to save capture" }, { status: 500 });
  }

  // 2. Extract content (best-effort).
  const notes: string[] = [];
  let title: string | null = null;
  let description: string | null = null;
  let transcript: string | null = null;
  let rawText: string | null = null;

  try {
    if (sourceType === "youtube") {
      const yt = await scrapeYouTube(url);
      title = yt.title;
      description = yt.description;
      transcript = yt.transcript;
      if (yt.captionNote) notes.push(yt.captionNote);
    } else if (sourceType === "instagram" || sourceType === "twitter") {
      const meta = await scrapeMeta(url, false);
      title = meta.title;
      description = meta.description;
      if (!meta.title && !meta.description) {
        notes.push("No public metadata available for this link.");
      }
    } else {
      const meta = await scrapeMeta(url, true);
      title = meta.title;
      description = meta.description;
      rawText = meta.text;
    }
  } catch {
    notes.push("Content extraction failed; saved the raw link.");
  }

  // 3. AI enrichment (best-effort — never blocks the capture).
  const { enrichment, error: aiError } = await enrichIdea({
    supabase,
    userId,
    sourceType,
    url,
    title,
    description,
    transcript,
    rawText,
  });
  if (aiError) notes.push(`AI enrichment failed: ${aiError}`);

  // 4. Update the row with whatever we got.
  await supabase
    .from("ideas")
    .update({
      title: enrichment?.title ?? title ?? url,
      summary: enrichment?.summary ?? description,
      pillar: enrichment?.pillar ?? null,
      suggested_brand: enrichment?.suggested_brand ?? "unsure",
      agent_notes: [enrichment?.agent_notes, ...notes].filter(Boolean).join(" | ") || null,
      raw_text: rawText ?? description,
      transcript,
    })
    .eq("id", idea.id);

  return NextResponse.json({
    ok: true,
    id: idea.id,
    enriched: enrichment !== null,
  });
}
