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

/* ---------------- Script Studio assists (writing tasks, Anthropic) -------- */

function brandVoice(brand: string, g: BrandGuidelines | null): string {
  if (brand === "operator") return `Write in the "The Operator" voice:\n${g?.operator || "high-signal, ownership-oriented, credible"}`;
  if (brand === "both") return brandContext(g);
  return `Write in the "The Real One" voice:\n${g?.real_one || "unfiltered friend energy, funny, direct, zero polish"}`;
}

export const SUGGEST_HOOKS_SYSTEM = `You write scroll-stopping opening hooks for short-form creator content. Return a JSON array of exactly 5 hook strings — each under 140 characters, each a different angle (curiosity, contrarian, stakes, specificity, story-drop). Return ONLY the JSON array.`;

export function suggestHooksPrompt(p: Record<string, unknown>, g: BrandGuidelines | null): string {
  return [
    brandVoice(String(p.brand ?? "real_one"), g),
    `Idea title: ${p.title ?? ""}`,
    p.summary ? `Summary: ${p.summary}` : "",
    p.transcript ? `Transcript excerpt: ${String(p.transcript).slice(0, 8000)}` : "",
    p.existingHook ? `The creator's current hook draft (write 5 alternatives, don't repeat it): ${p.existingHook}` : "",
    "Write 5 hooks for this idea.",
  ].filter(Boolean).join("\n\n");
}

export const DRAFT_PARTS_SYSTEM = `You structure short-form creator stories. Given raw material, propose a beat structure of 3-6 story beats (the Story between the Hook and the End). Each beat is 1-3 sentences the creator can film/say. Return a JSON array of beat strings only.`;

export function draftPartsPrompt(p: Record<string, unknown>, g: BrandGuidelines | null): string {
  return [
    brandVoice(String(p.brand ?? "real_one"), g),
    p.hook ? `Hook: ${p.hook}` : "",
    `Idea title: ${p.title ?? ""}`,
    p.summary ? `Summary: ${p.summary}` : "",
    p.transcript ? `Transcript: ${String(p.transcript).slice(0, 12000)}` : "",
    "Propose the story beats.",
  ].filter(Boolean).join("\n\n");
}

export const SUGGEST_ENDING_SYSTEM = `You write endings for short-form creator content: either a tight close that lands the point, or a cliffhanger that makes the next post inevitable. Return a JSON array of exactly 3 alternative ending strings (each under 200 characters). Return ONLY the JSON array.`;

export function suggestEndingPrompt(p: Record<string, unknown>, g: BrandGuidelines | null): string {
  const parts = Array.isArray(p.parts) ? (p.parts as string[]).join("\n- ") : "";
  return [
    brandVoice(String(p.brand ?? "real_one"), g),
    p.hook ? `Hook: ${p.hook}` : "",
    parts ? `Story beats:\n- ${parts}` : "",
    "Write 3 alternative endings/cliffhangers.",
  ].filter(Boolean).join("\n\n");
}

/* ---------------- Platform variants (tone adapter, M5) -------------------- */

const PLATFORM_RULES: Record<string, string> = {
  instagram:
    "Instagram Reel caption + on-screen script. Persona: The Real One. Structure: killer first line (the hook), short punchy lines, line breaks for rhythm, a CTA to comment/share, 3-5 lowercase hashtags at the end. Total under 2,200 characters — aim for 300-800.",
  twitter:
    "Twitter/X post or short thread. Persona: The Operator. If one post: under 280 characters, high-signal, no hashtags. If a thread (2-5 tweets): number them '1/' '2/' etc, first tweet is the hook, each tweet stands alone. No emojis unless they carry meaning.",
  linkedin:
    "LinkedIn post. Persona: The Operator. Structure: 1-2 line hook before the fold, short paragraphs with whitespace, concrete numbers/artifacts where possible, a closing line that invites discussion. 900-1,800 characters. No hashtag spam (0-3 max).",
};

export function variantSystem(platform: string): string {
  return `You adapt a creator's script into a platform-native post. ${PLATFORM_RULES[platform] ?? ""}
Return STRICT JSON: {"hook": string, "body": string, "media_notes": string}
- "hook": the opening line/scroll-stopper for this platform
- "body": the COMPLETE post text, ready to copy-paste (include the hook inside it where natural)
- "media_notes": 1-2 sentences on what visual/clip to pair (draw on the script's visual references if given)
Return ONLY the JSON object.`;
}

export function variantPrompt(
  p: {
    platform: string;
    title: string | null;
    summary: string | null;
    hook: string | null;
    parts: { body: string; visual: string | null }[];
    ending: string | null;
    transcript: string | null;
  },
  g: BrandGuidelines | null
): string {
  const persona = p.platform === "instagram" ? "real_one" : "operator";
  const voice =
    persona === "real_one"
      ? `Persona "The Real One":\n${g?.real_one || "unfiltered friend energy, funny, direct, zero polish"}`
      : `Persona "The Operator":\n${g?.operator || "high-signal, ownership-oriented, credible; show the work"}`;
  const beats = p.parts
    .map((part, i) => `${i + 1}. ${part.body}${part.visual ? ` [visual: ${part.visual}]` : ""}`)
    .join("\n");
  return [
    voice,
    `Idea: ${p.title ?? ""}`,
    p.summary ? `Summary: ${p.summary}` : "",
    p.hook ? `Script hook: ${p.hook}` : "",
    beats ? `Story beats:\n${beats}` : "",
    p.ending ? `Ending: ${p.ending}` : "",
    !p.hook && !beats && p.transcript ? `Raw transcript: ${p.transcript.slice(0, 8000)}` : "",
    `Write the ${p.platform} variant.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

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
