import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider, transcribe as whisperTranscribe } from "./providers/openai";
import { loadKey } from "./keys";
import { FALLBACK_ROUTES, resolveRoute, type Route } from "./router";
import {
  AIError,
  type AIProvider,
  type CompletionResult,
  type TaskKind,
} from "./types";

// The single gateway all AI calls go through (docs/06-ai-provider-layer.md).
// No component or other API route may import provider SDKs directly.

const PROVIDERS: Record<"anthropic" | "openai", AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
};

export interface CompleteTaskOptions {
  supabase: SupabaseClient;
  userId: string;
  task: Exclude<TaskKind, "transcribe">;
  prompt: string;
  system?: string;
  maxTokens?: number;
  userRoutes?: Partial<Record<TaskKind, Route>> | null;
}

export async function completeTask(
  opts: CompleteTaskOptions
): Promise<CompletionResult> {
  const route = resolveRoute(opts.task, opts.userRoutes);

  let provider = route.provider;
  let model = route.model;
  let key = await loadKey(opts.supabase, opts.userId, provider);

  if (!key) {
    // Fall back to the other provider if its key exists (per docs/06).
    const other = provider === "anthropic" ? "openai" : "anthropic";
    const otherKey = await loadKey(opts.supabase, opts.userId, other);
    if (otherKey) {
      provider = other;
      model = FALLBACK_ROUTES[opts.task][other];
      key = otherKey;
    } else {
      throw new AIError(
        "missing_key",
        "No AI provider keys configured. Add your Anthropic or OpenAI key in Settings."
      );
    }
  }

  const result = await PROVIDERS[provider].complete(key, {
    model,
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens,
  });

  // Cost transparency: log token usage (never keys, never prompt content).
  console.log(
    `[ai] task=${opts.task} provider=${result.provider} model=${result.model} in=${result.usage.inputTokens} out=${result.usage.outputTokens}`
  );

  return result;
}

export async function transcribeAudio(opts: {
  supabase: SupabaseClient;
  userId: string;
  audio: Buffer;
  filename: string;
}): Promise<string> {
  // Transcription requires OpenAI (whisper-1) in v1.
  const key = await loadKey(opts.supabase, opts.userId, "openai");
  if (!key) {
    throw new AIError(
      "missing_key",
      "Transcription needs an OpenAI key. Add one in Settings."
    );
  }
  const text = await whisperTranscribe(key, opts.audio, opts.filename);
  console.log(`[ai] task=transcribe provider=openai model=whisper-1 bytes=${opts.audio.length}`);
  return text;
}

export async function testProviderKey(
  supabase: SupabaseClient,
  userId: string,
  provider: "anthropic" | "openai"
): Promise<void> {
  const key = await loadKey(supabase, userId, provider);
  if (!key) {
    throw new AIError("missing_key", "No key stored for this provider.");
  }
  await PROVIDERS[provider].test(key);
}
