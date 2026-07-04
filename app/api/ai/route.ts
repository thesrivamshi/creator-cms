import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeTask } from "@/lib/ai";
import { AIError, AI_ERROR_MESSAGES, type TaskKind } from "@/lib/ai/types";
import {
  DRAFT_PARTS_SYSTEM,
  SUGGEST_ENDING_SYSTEM,
  SUGGEST_HOOKS_SYSTEM,
  draftPartsPrompt,
  suggestEndingPrompt,
  suggestHooksPrompt,
  type BrandGuidelines,
} from "@/lib/ai/prompts";
import type { Route } from "@/lib/ai/router";

// Single AI gateway (docs/06-ai-provider-layer.md): all client AI actions call
// POST /api/ai with { task, payload }. Script Studio tasks are wired here as
// they land in M4/M5.

interface TaskSpec {
  kind: Exclude<TaskKind, "transcribe">;
  system: (g: BrandGuidelines | null) => string;
  prompt: (payload: Record<string, unknown>, g: BrandGuidelines | null) => string;
  maxTokens: number;
}

const TASKS: Record<string, TaskSpec> = {
  suggest_hooks: {
    kind: "writing",
    system: () => SUGGEST_HOOKS_SYSTEM,
    prompt: suggestHooksPrompt,
    maxTokens: 800,
  },
  draft_parts: {
    kind: "writing",
    system: () => DRAFT_PARTS_SYSTEM,
    prompt: draftPartsPrompt,
    maxTokens: 1200,
  },
  suggest_ending: {
    kind: "writing",
    system: () => SUGGEST_ENDING_SYSTEM,
    prompt: suggestEndingPrompt,
    maxTokens: 600,
  },
  // M5 platform-variant generation registers here.
};

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const task = body?.task as string;
  const payload = (body?.payload ?? {}) as Record<string, unknown>;

  const spec = TASKS[task];
  if (!spec) {
    return NextResponse.json(
      { error: `Unknown task '${task}'. Available: ${Object.keys(TASKS).join(", ")}` },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_guidelines, model_routes")
    .eq("user_id", user.id)
    .maybeSingle();

  const guidelines = (profile?.brand_guidelines ?? null) as BrandGuidelines | null;
  const userRoutes = (profile?.model_routes ?? null) as Partial<
    Record<TaskKind, Route>
  > | null;

  try {
    const result = await completeTask({
      supabase,
      userId: user.id,
      task: spec.kind,
      system: spec.system(guidelines),
      prompt: spec.prompt(payload, guidelines),
      maxTokens: spec.maxTokens,
      userRoutes,
    });
    return NextResponse.json({ text: result.text, usage: result.usage });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        { error: AI_ERROR_MESSAGES[err.code], code: err.code },
        { status: err.code === "missing_key" ? 400 : 502 }
      );
    }
    console.error("[/api/ai] unexpected error");
    return NextResponse.json({ error: "AI request failed." }, { status: 500 });
  }
}
