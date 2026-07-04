import OpenAI from "openai";
import { toFile } from "openai/uploads";
import {
  AIError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "../types";

function mapError(err: unknown): AIError {
  if (err instanceof OpenAI.AuthenticationError) {
    return new AIError("invalid_key", "OpenAI rejected the API key.");
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new AIError("rate_limit", "OpenAI rate limit reached.");
  }
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    if (status >= 500) {
      return new AIError("provider_down", "OpenAI is unavailable right now.");
    }
    return new AIError("bad_request", "OpenAI rejected the request.");
  }
  return new AIError("provider_down", "Could not reach OpenAI.");
}

export const openaiProvider: AIProvider = {
  id: "openai",

  async complete(key: string, req: CompletionRequest): Promise<CompletionResult> {
    const client = new OpenAI({ apiKey: key });
    try {
      const response = await client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxTokens ?? 2048,
        messages: [
          ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
          { role: "user" as const, content: req.prompt },
        ],
      });
      return {
        text: response.choices[0]?.message?.content ?? "",
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
        model: req.model,
        provider: "openai",
      };
    } catch (err) {
      throw mapError(err);
    }
  },

  async test(key: string): Promise<void> {
    const client = new OpenAI({ apiKey: key });
    try {
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      });
    } catch (err) {
      throw mapError(err);
    }
  },
};

/** Whisper transcription (docs/04-capture-flows.md). Audio is a Buffer of the
 *  original recording downloaded from Storage; the original is always kept. */
export async function transcribe(
  key: string,
  audio: Buffer,
  filename: string
): Promise<string> {
  const client = new OpenAI({ apiKey: key });
  try {
    const file = await toFile(audio, filename);
    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return result.text;
  } catch (err) {
    throw mapError(err);
  }
}
