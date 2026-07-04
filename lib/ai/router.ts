import type { ProviderId, TaskKind } from "./types";

export interface Route {
  provider: Exclude<ProviderId, "openrouter">;
  model: string;
}

// Defaults per docs/06-ai-provider-layer.md. Overridable per-user via
// profiles.model_routes (Settings → Advanced).
export const DEFAULT_ROUTES: Record<TaskKind, Route> = {
  writing: { provider: "anthropic", model: "claude-sonnet-4-6" },
  small: { provider: "openai", model: "gpt-4o-mini" },
  transcribe: { provider: "openai", model: "whisper-1" },
};

// When the routed provider has no key, fall back to the other provider with
// a sensible model for the task ('transcribe' requires OpenAI in v1).
export const FALLBACK_ROUTES: Record<
  Exclude<TaskKind, "transcribe">,
  Record<"anthropic" | "openai", string>
> = {
  writing: { anthropic: "claude-sonnet-4-6", openai: "gpt-4o" },
  small: { openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5" },
};

// Options surfaced in the Settings dropdowns.
export const MODEL_OPTIONS: Record<TaskKind, Route[]> = {
  writing: [
    { provider: "anthropic", model: "claude-sonnet-4-6" },
    { provider: "anthropic", model: "claude-sonnet-5" },
    { provider: "anthropic", model: "claude-opus-4-8" },
    { provider: "openai", model: "gpt-4o" },
  ],
  small: [
    { provider: "openai", model: "gpt-4o-mini" },
    { provider: "anthropic", model: "claude-haiku-4-5" },
  ],
  transcribe: [{ provider: "openai", model: "whisper-1" }],
};

export function resolveRoute(
  task: TaskKind,
  userRoutes: Partial<Record<TaskKind, Route>> | null | undefined
): Route {
  const override = userRoutes?.[task];
  if (
    override &&
    (override.provider === "anthropic" || override.provider === "openai") &&
    typeof override.model === "string" &&
    override.model.length > 0
  ) {
    return override;
  }
  return DEFAULT_ROUTES[task];
}
