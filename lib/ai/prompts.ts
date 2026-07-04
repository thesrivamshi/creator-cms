// Prompt builders for writing tasks. Every writing prompt injects the user's
// brand_guidelines JSON so voice is user-tunable without code changes
// (docs/05-script-studio.md).

export interface BrandGuidelines {
  real_one?: string;
  operator?: string;
  [k: string]: unknown;
}

export function brandContext(guidelines: BrandGuidelines | null): string {
  const realOne = guidelines?.real_one || "(not set — unfiltered friend energy, funny, direct, zero polish; for ambitious builders on Instagram)";
  const operator = guidelines?.operator || "(not set — high-signal, ownership-oriented, credible; for founders, VCs, hiring managers on LinkedIn/Twitter)";
  return [
    "The creator publishes under two brand personas:",
    `## Persona \"The Real One\" (Instagram)\n${realOne}`,
    `## Persona \"The Operator\" (LinkedIn + Twitter/X)\n${operator}`,
  ].join("\n\n");
}

export const ENRICH_SYSTEM = `You organize a solo creator's content ideas. Given raw captured material (a link's title/description/transcript, a voice transcript, or a typed note), you return STRICT JSON with exactly these keys:
{
  "title": string,            // short, concrete working title
  "summary": string,          // 2-3 sentence summary of the idea
  "pillar": string,           // one short content-pillar tag inferred from the material and personas
  "suggested_brand": "real_one" | "operator" | "both" | "unsure",
  "agent_notes": string       // 1-2 sentences: angle suggestions, what's missing, or caveats
}
Return ONLY the JSON object — no markdown fences, no commentary.`;

export function enrichPrompt(input: {
  sourceType: string;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  transcript?: string | null;
  rawText?: string | null;
  guidelines: BrandGuidelines | null;
}): string {
  // Truncate transcript to keep the prompt within a small-model budget (~8k tokens).
  const transcript = input.transcript ? input.transcript.slice(0, 32000) : null;
  const parts = [
    brandContext(input.guidelines),
    `Captured material (source: ${input.sourceType}${input.url ? `, url: ${input.url}` : ""}):`,
  ];
  if (input.title) parts.push(`Title: ${input.title}`);
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.rawText) parts.push(`Text: ${input.rawText.slice(0, 16000)}`);
  if (transcript) parts.push(`Transcript: ${transcript}`);
  return parts.join("\n\n");
}
