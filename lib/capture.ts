import type { SupabaseClient } from "@supabase/supabase-js";
import { completeTask } from "@/lib/ai";
import { ENRICH_SYSTEM, enrichPrompt, type BrandGuidelines } from "@/lib/ai/prompts";
import type { Route } from "@/lib/ai/router";
import type { TaskKind } from "@/lib/ai/types";

export type SourceType =
  | "youtube"
  | "instagram"
  | "twitter"
  | "article"
  | "note"
  | "voice";

export function detectSourceType(url: string): SourceType {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("instagram.com")) return "instagram";
    if (host === "x.com" || host.endsWith("twitter.com")) return "twitter";
    return "article";
  } catch {
    return "article";
  }
}

export interface Enrichment {
  title: string | null;
  summary: string | null;
  pillar: string | null;
  suggested_brand: "real_one" | "operator" | "both" | "unsure";
  agent_notes: string | null;
}

/** Run AI enrichment (small task). Returns null on ANY failure — captures must
 *  never be lost because a model call failed (docs/04-capture-flows.md). */
export async function enrichIdea(opts: {
  supabase: SupabaseClient;
  userId: string;
  sourceType: SourceType;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  transcript?: string | null;
  rawText?: string | null;
}): Promise<{ enrichment: Enrichment | null; error: string | null }> {
  try {
    const { data: profile } = await opts.supabase
      .from("profiles")
      .select("brand_guidelines, model_routes")
      .eq("user_id", opts.userId)
      .maybeSingle();

    const guidelines = (profile?.brand_guidelines ?? null) as BrandGuidelines | null;
    const userRoutes = (profile?.model_routes ?? null) as Partial<
      Record<TaskKind, Route>
    > | null;

    const result = await completeTask({
      supabase: opts.supabase,
      userId: opts.userId,
      task: "small",
      system: ENRICH_SYSTEM,
      prompt: enrichPrompt({
        sourceType: opts.sourceType,
        url: opts.url,
        title: opts.title,
        description: opts.description,
        transcript: opts.transcript,
        rawText: opts.rawText,
        guidelines,
      }),
      maxTokens: 600,
      userRoutes,
    });

    const parsed = parseEnrichment(result.text);
    if (!parsed) return { enrichment: null, error: "AI returned unparseable output" };
    return { enrichment: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "enrichment failed";
    return { enrichment: null, error: message };
  }
}

function parseEnrichment(text: string): Enrichment | null {
  try {
    // Tolerate accidental markdown fences.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const brand = ["real_one", "operator", "both", "unsure"].includes(obj.suggested_brand)
      ? obj.suggested_brand
      : "unsure";
    return {
      title: typeof obj.title === "string" ? obj.title.slice(0, 300) : null,
      summary: typeof obj.summary === "string" ? obj.summary : null,
      pillar: typeof obj.pillar === "string" ? obj.pillar.slice(0, 100) : null,
      suggested_brand: brand,
      agent_notes: typeof obj.agent_notes === "string" ? obj.agent_notes : null,
    };
  } catch {
    return null;
  }
}
