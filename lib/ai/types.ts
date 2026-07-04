export type TaskKind = "writing" | "small" | "transcribe";
export type ProviderId = "anthropic" | "openai" | "openrouter";

export type AIErrorCode =
  | "missing_key"
  | "invalid_key"
  | "rate_limit"
  | "provider_down"
  | "bad_request";

/** Uniform error shape across providers — each code maps to a distinct
 *  user-facing message (docs/06-ai-provider-layer.md). Never include key
 *  material in messages. */
export class AIError extends Error {
  code: AIErrorCode;
  constructor(code: AIErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AIError";
  }
}

export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  missing_key: "No API key configured for this provider. Add one in Settings.",
  invalid_key: "The API key was rejected by the provider. Check it in Settings.",
  rate_limit: "The provider is rate-limiting requests. Try again in a moment.",
  provider_down: "The provider is having trouble right now. Try again later.",
  bad_request: "The request was rejected by the provider.",
};

export interface CompletionRequest {
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  text: string;
  usage: Usage;
  model: string;
  provider: ProviderId;
}

export interface AIProvider {
  id: ProviderId;
  /** Text completion. Throws AIError on failure. */
  complete(key: string, req: CompletionRequest): Promise<CompletionResult>;
  /** Minimal (~1 token) call to validate a key. Throws AIError on failure. */
  test(key: string): Promise<void>;
}
