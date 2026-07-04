import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeTask } from "@/lib/ai";
import { AIError, AI_ERROR_MESSAGES, type TaskKind } from "@/lib/ai/types";
import { variantPrompt, variantSystem, type BrandGuidelines } from "@/lib/ai/prompts";
import type { Route } from "@/lib/ai/router";

// Tone adapter (docs/05): compile hook + parts + end and rewrite per platform
// in the correct persona voice. Creates draft variant rows.

export const maxDuration = 300;

const PLATFORMS = ["instagram", "twitter", "linkedin"] as const;
type Platform = (typeof PLATFORMS)[number];

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ideaId = typeof body?.ideaId === "string" ? body.ideaId : null;
  const requested = (Array.isArray(body?.platforms) ? body.platforms : PLATFORMS).filter(
    (p: string): p is Platform => (PLATFORMS as readonly string[]).includes(p)
  );
  if (!ideaId || requested.length === 0) {
    return NextResponse.json({ error: "ideaId and platforms required" }, { status: 400 });
  }

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, title, summary, transcript, status")
    .eq("id", ideaId)
    .maybeSingle();
  if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });

  const { data: script } = await supabase
    .from("scripts")
    .select("id, hook, ending")
    .eq("idea_id", ideaId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: parts } = script
    ? await supabase
        .from("script_parts")
        .select("body, visual_kind, visual_text")
        .eq("script_id", script.id)
        .order("position", { ascending: true })
    : { data: [] as { body: string; visual_kind: string | null; visual_text: string | null }[] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_guidelines, model_routes")
    .eq("user_id", user.id)
    .maybeSingle();
  const guidelines = (profile?.brand_guidelines ?? null) as BrandGuidelines | null;
  const userRoutes = (profile?.model_routes ?? null) as Partial<Record<TaskKind, Route>> | null;

  const promptInput = {
    title: idea.title,
    summary: idea.summary,
    hook: script?.hook ?? null,
    ending: script?.ending ?? null,
    transcript: idea.transcript,
    parts: (parts ?? []).map((p) => ({
      body: p.body,
      visual: p.visual_kind === "note" ? p.visual_text : p.visual_kind,
    })),
  };

  const created: unknown[] = [];
  const errors: Record<string, string> = {};

  // One writing call per platform, run in parallel.
  await Promise.all(
    requested.map(async (platform: Platform) => {
      try {
        const result = await completeTask({
          supabase,
          userId: user.id,
          task: "writing",
          system: variantSystem(platform),
          prompt: variantPrompt({ platform, ...promptInput }, guidelines),
          maxTokens: 1500,
          userRoutes,
        });
        const parsed = parseVariant(result.text);
        if (!parsed) {
          errors[platform] = "Model returned unparseable output";
          return;
        }
        const { data: row } = await supabase
          .from("variants")
          .insert({
            user_id: user.id,
            idea_id: idea.id,
            script_id: script?.id ?? null,
            platform,
            hook: parsed.hook,
            body: parsed.body,
            media_notes: parsed.media_notes,
            status: "draft",
          })
          .select("id, platform, hook, body, media_notes, status")
          .single();
        if (row) created.push(row);
      } catch (err) {
        errors[platform] =
          err instanceof AIError ? AI_ERROR_MESSAGES[err.code] : "generation failed";
      }
    })
  );

  if (created.length > 0 && ["captured", "reviewed", "scripted"].includes(idea.status)) {
    await supabase.from("ideas").update({ status: "drafted" }).eq("id", idea.id);
  }

  if (created.length === 0) {
    const firstError = Object.values(errors)[0] ?? "Variant generation failed.";
    return NextResponse.json({ error: firstError, errors }, { status: 502 });
  }

  return NextResponse.json({ ok: true, variants: created, errors });
}

function parseVariant(
  text: string
): { hook: string | null; body: string; media_notes: string | null } | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.body !== "string" || obj.body.length === 0) return null;
    return {
      hook: typeof obj.hook === "string" ? obj.hook : null,
      body: obj.body,
      media_notes: typeof obj.media_notes === "string" ? obj.media_notes : null,
    };
  } catch {
    return null;
  }
}
