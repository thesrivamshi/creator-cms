import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichIdea } from "@/lib/capture";

// Typed-note capture from inside the app (session auth, not capture token).
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });

  // Save first.
  const { data: idea, error } = await supabase
    .from("ideas")
    .insert({
      user_id: user.id,
      source_type: "note",
      raw_text: text,
      title: text.slice(0, 80),
      status: "captured",
    })
    .select("id")
    .single();

  if (error || !idea) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  // Enrich second (best-effort).
  const { enrichment, error: aiError } = await enrichIdea({
    supabase,
    userId: user.id,
    sourceType: "note",
    rawText: text,
  });

  if (enrichment) {
    await supabase
      .from("ideas")
      .update({
        title: enrichment.title ?? text.slice(0, 80),
        summary: enrichment.summary,
        pillar: enrichment.pillar,
        suggested_brand: enrichment.suggested_brand,
        agent_notes: enrichment.agent_notes,
      })
      .eq("id", idea.id);
  } else if (aiError) {
    await supabase
      .from("ideas")
      .update({ agent_notes: `AI enrichment failed: ${aiError}` })
      .eq("id", idea.id);
  }

  return NextResponse.json({ ok: true, id: idea.id, enriched: enrichment !== null });
}
