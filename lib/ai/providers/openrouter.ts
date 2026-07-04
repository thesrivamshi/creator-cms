import { AIError, type AIProvider } from "../types";

// TODO: OpenRouter is intentionally a stub in v1 (docs/06-ai-provider-layer.md).
// The ai_provider enum already includes 'openrouter'; implementing this
// interface (OpenAI-compatible API at https://openrouter.ai/api/v1) makes it a
// drop-in third provider. Do not wire it into routing until implemented.
export const openrouterProvider: AIProvider = {
  id: "openrouter",

  async complete(): Promise<never> {
    throw new AIError("bad_request", "OpenRouter is not supported yet.");
  },

  async test(): Promise<void> {
    throw new AIError("bad_request", "OpenRouter is not supported yet.");
  },
};
