import Anthropic from "@anthropic-ai/sdk";
import {
  AIError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "../types";

function mapError(err: unknown): AIError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new AIError("invalid_key", "Anthropic rejected the API key.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AIError("rate_limit", "Anthropic rate limit reached.");
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    if (status >= 500 || status === 529) {
      return new AIError("provider_down", "Anthropic is unavailable right now.");
    }
    return new AIError("bad_request", "Anthropic rejected the request.");
  }
  return new AIError("provider_down", "Could not reach Anthropic.");
}

export const anthropicProvider: AIProvider = {
  id: "anthropic",

  async complete(key: string, req: CompletionRequest): Promise<CompletionResult> {
    const client = new Anthropic({ apiKey: key });
    try {
      const response = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: req.model,
        provider: "anthropic",
      };
    } catch (err) {
      throw mapError(err);
    }
  },

  async test(key: string): Promise<void> {
    const client = new Anthropic({ apiKey: key });
    try {
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    } catch (err) {
      throw mapError(err);
    }
  },
};
