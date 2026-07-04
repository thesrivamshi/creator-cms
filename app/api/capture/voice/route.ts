import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/ai";
import { AIError, AI_ERROR_MESSAGES } from "@/lib/ai/types";
import { enrichIdea } from "@/lib/capture";

// Voice pipeline step 2 (docs/04-capture-flows.md): the client has ALREADY
// uploaded the original recording to Storage (upload-first — the recording is
// the source of truth and is kept permanently). This route downloads it, runs
// Whisper with the user's OpenAI key, saves the transcript, then enriches.
// Retryable and idempotent: re-running overwrites the transcript only.

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ideaId = typeof body?.ideaId === "string" ? body.ideaId : null;
  if (!ideaId) return NextResponse.json({ error: "ideaId required" }, { status: 400 });

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, audio_path, transcript")
    .eq("id", ideaId)
    .maybeSingle();

  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  if (!idea.audio_path) {
    return NextResponse.json({ error: "No recording attached to this idea" }, { status: 400 });
  }

  // Download the original from Storage (RLS: owner only).
  const objectPath = idea.audio_path.replace(/^audio\//, "");
  const { data: blob, error: dlError } = await supabase.storage
    .from("audio")
    .download(objectPath);

  if (dlError || !blob) {
    return NextResponse.json({ error: "Could not read the recording from storage" }, { status: 500 });
  }

  const filename = objectPath.split("/").pop() ?? "recording.m4a";

  let transcript: string;
  try {
    transcript = await transcribeAudio({
      supabase,
      userId: user.id,
      audio: Buffer.from(await blob.arrayBuffer()),
      filename,
    });
  } catch (err) {
    const code = err instanceof AIError ? err.code : "provider_down";
    const message = err instanceof AIError ? AI_ERROR_MESSAGES[err.code] : "Transcription failed.";
    // Binding failure rule: idea keeps its audio; note why transcription failed.
    await supabase
      .from("ideas")
      .update({ agent_notes: `Transcription failed: ${message}` })
      .eq("id", ideaId);
    return NextResponse.json({ error: message, code }, { status: 502 });
  }

  await supabase.from("ideas").update({ transcript }).eq("id", ideaId);

  // Enrich (best-effort — never blocks the transcript save).
  const { enrichment, error: aiError } = await enrichIdea({
    supabase,
    userId: user.id,
    sourceType: "voice",
    transcript,
  });

  if (enrichment) {
    await supabase
      .from("ideas")
      .update({
        title: enrichment.title,
        summary: enrichment.summary,
        pillar: enrichment.pillar,
        suggested_brand: enrichment.suggested_brand,
        agent_notes: enrichment.agent_notes,
      })
      .eq("id", ideaId);
  } else if (aiError) {
    await supabase
      .from("ideas")
      .update({ agent_notes: `Transcribed OK; AI tagging failed: ${aiError}` })
      .eq("id", ideaId);
  }

  return NextResponse.json({
    ok: true,
    id: ideaId,
    transcribed: true,
    enriched: enrichment !== null,
  });
}
