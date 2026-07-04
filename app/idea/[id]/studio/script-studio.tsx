"use client";

// Script Studio (docs/05-script-studio.md): Hook → Story (parts with visual
// refs) → End. Touch-first: drag handles use pointer events (not HTML5 DnD),
// all targets ≥44px. Debounced autosave everywhere — nothing gets lost.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DrawingModal from "./drawing-modal";

interface Part {
  id: string;
  position: number;
  body: string;
  visual_kind: "note" | "image" | "drawing" | null;
  visual_text: string | null;
  visual_path: string | null;
}

interface Props {
  idea: {
    id: string;
    title: string | null;
    summary: string | null;
    transcript: string | null;
    suggested_brand: string;
  };
  script: { id: string; hook: string | null; ending: string | null; notes: string | null };
  initialParts: Part[];
  initialSignedUrls: Record<string, string>;
  audioUrl: string | null;
  userId: string;
}

function parseStringArray(text: string): string[] {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      const arr = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
    }
  } catch {
    // fall through to line-splitting
  }
  return text
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.]+/, "").trim())
    .filter((l) => l.length > 10);
}

export default function ScriptStudio(props: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { idea, script, userId } = props;

  const [hook, setHook] = useState(script.hook ?? "");
  const [ending, setEnding] = useState(script.ending ?? "");
  const [parts, setParts] = useState<Part[]>(props.initialParts);
  const [signedUrls, setSignedUrls] = useState(props.initialSignedUrls);
  const [brand, setBrand] = useState<"real_one" | "operator">(
    idea.suggested_brand === "operator" ? "operator" : "real_one"
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showTranscript, setShowTranscript] = useState(false);
  const [drawingFor, setDrawingFor] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [hookSuggestions, setHookSuggestions] = useState<string[]>([]);
  const [endingSuggestions, setEndingSuggestions] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "twitter", "linkedin"]);

  const cursorRef = useRef<Record<string, number>>({});
  const scriptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const firstRender = useRef(true);

  /* ------------- autosave: script hook/ending ------------- */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (scriptTimer.current) clearTimeout(scriptTimer.current);
    setSaveState("saving");
    scriptTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("scripts")
        .update({ hook: hook || null, ending: ending || null })
        .eq("id", script.id);
      setSaveState(error ? "error" : "saved");
    }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook, ending]);

  /* ------------- parts CRUD ------------- */

  const persistPartBody = useCallback(
    (partId: string, body: string) => {
      if (partTimers.current[partId]) clearTimeout(partTimers.current[partId]);
      setSaveState("saving");
      partTimers.current[partId] = setTimeout(async () => {
        const { error } = await supabase
          .from("script_parts")
          .update({ body })
          .eq("id", partId);
        setSaveState(error ? "error" : "saved");
      }, 800);
    },
    [supabase]
  );

  function setPartBody(partId: string, body: string) {
    setParts((ps) => ps.map((p) => (p.id === partId ? { ...p, body } : p)));
    persistPartBody(partId, body);
  }

  async function renumber(next: Part[]) {
    // Two passes because (script_id, position) is unique — pass 1 moves
    // everything out of the way, pass 2 sets final ints. Solo user, no
    // concurrency concerns (fractional indexing would replace this at scale).
    setSaveState("saving");
    for (let i = 0; i < next.length; i++) {
      await supabase.from("script_parts").update({ position: i + 1 + 10000 }).eq("id", next[i].id);
    }
    for (let i = 0; i < next.length; i++) {
      await supabase.from("script_parts").update({ position: i + 1 }).eq("id", next[i].id);
    }
    setSaveState("saved");
  }

  async function addPart(afterIndex?: number, body = "") {
    const insertAt = afterIndex === undefined ? parts.length : afterIndex + 1;
    setSaveState("saving");
    const { data, error } = await supabase
      .from("script_parts")
      .insert({
        user_id: userId,
        script_id: script.id,
        position: parts.length + 1 + 20000, // temp slot; renumber fixes it
        body,
      })
      .select("id, position, body, visual_kind, visual_text, visual_path")
      .single();
    if (error || !data) {
      setSaveState("error");
      return null;
    }
    const next = [...parts];
    next.splice(insertAt, 0, data as Part);
    setParts(next);
    await renumber(next);
    return data as Part;
  }

  async function deletePart(partId: string) {
    if (!confirm("Delete this part?")) return;
    const next = parts.filter((p) => p.id !== partId);
    setParts(next);
    setSaveState("saving");
    await supabase.from("script_parts").delete().eq("id", partId);
    await renumber(next);
  }

  async function splitPart(part: Part, index: number) {
    const cursor = cursorRef.current[part.id] ?? part.body.length;
    const before = part.body.slice(0, cursor).trimEnd();
    const after = part.body.slice(cursor).trimStart();
    if (!after) return; // nothing to split off
    setPartBody(part.id, before);
    await addPart(index, after);
  }

  async function movePart(from: number, to: number) {
    if (to < 0 || to >= parts.length || from === to) return;
    const next = [...parts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setParts(next);
    await renumber(next);
  }

  /* ------------- touch drag reorder ------------- */

  function handleDragStart(index: number) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragIndex(index);
    };
  }

  function handleDragMove(e: React.PointerEvent) {
    if (dragIndex === null) return;
    const el = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((n) => n instanceof HTMLElement && n.dataset.partIndex !== undefined) as
      | HTMLElement
      | undefined;
    if (!el) return;
    const over = Number(el.dataset.partIndex);
    if (!Number.isNaN(over) && over !== dragIndex) {
      setParts((ps) => {
        const next = [...ps];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(over, 0, moved);
        return next;
      });
      setDragIndex(over);
    }
  }

  async function handleDragEnd() {
    if (dragIndex === null) return;
    setDragIndex(null);
    await renumber(parts);
  }

  /* ------------- visuals ------------- */

  async function uploadVisual(part: Part, blob: Blob, kind: "image" | "drawing") {
    setSaveState("saving");
    const objectPath = `${userId}/${part.id}.png`;
    const { error: upErr } = await supabase.storage
      .from("visuals")
      .upload(objectPath, blob, { upsert: true, contentType: "image/png" });
    if (upErr) {
      setSaveState("error");
      setAiError("Image upload failed — try again.");
      return;
    }
    await supabase
      .from("script_parts")
      .update({ visual_kind: kind, visual_path: `visuals/${objectPath}`, visual_text: null })
      .eq("id", part.id);
    const { data } = await supabase.storage.from("visuals").createSignedUrl(objectPath, 3600);
    setSignedUrls((s) => ({ ...s, [part.id]: data?.signedUrl ?? "" }));
    setParts((ps) =>
      ps.map((p) =>
        p.id === part.id
          ? { ...p, visual_kind: kind, visual_path: `visuals/${objectPath}`, visual_text: null }
          : p
      )
    );
    setSaveState("saved");
  }

  async function setVisualNote(part: Part, text: string) {
    setParts((ps) =>
      ps.map((p) => (p.id === part.id ? { ...p, visual_kind: "note", visual_text: text } : p))
    );
    if (partTimers.current[`v-${part.id}`]) clearTimeout(partTimers.current[`v-${part.id}`]);
    partTimers.current[`v-${part.id}`] = setTimeout(async () => {
      await supabase
        .from("script_parts")
        .update({ visual_kind: "note", visual_text: text })
        .eq("id", part.id);
      setSaveState("saved");
    }, 800);
  }

  async function clearVisual(part: Part) {
    setParts((ps) =>
      ps.map((p) =>
        p.id === part.id ? { ...p, visual_kind: null, visual_text: null, visual_path: null } : p
      )
    );
    await supabase
      .from("script_parts")
      .update({ visual_kind: null, visual_text: null, visual_path: null })
      .eq("id", part.id);
  }

  function switchVisualKind(part: Part, kind: "note" | "image" | "drawing" | null) {
    if (kind === null) return void clearVisual(part);
    if (kind === "note") {
      setParts((ps) =>
        ps.map((p) => (p.id === part.id ? { ...p, visual_kind: "note" } : p))
      );
    }
    if (kind === "drawing") setDrawingFor(part.id);
    // 'image' is handled by the file input / paste directly
  }

  function handlePaste(part: Part) {
    return (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      if (item) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void uploadVisual(part, file, "image");
        }
      }
    };
  }

  /* ------------- AI assists ------------- */

  async function callAI(task: string, payload: Record<string, unknown>): Promise<string | null> {
    setAiBusy(task);
    setAiError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data?.error ?? "AI request failed.");
        return null;
      }
      return data.text as string;
    } catch {
      setAiError("AI request failed — check your connection.");
      return null;
    } finally {
      setAiBusy(null);
    }
  }

  async function suggestHooks() {
    const text = await callAI("suggest_hooks", {
      title: idea.title,
      summary: idea.summary,
      transcript: idea.transcript,
      existingHook: hook,
      brand,
    });
    if (text) setHookSuggestions(parseStringArray(text).slice(0, 5));
  }

  async function draftParts() {
    const text = await callAI("draft_parts", {
      title: idea.title,
      summary: idea.summary,
      transcript: idea.transcript,
      hook,
      brand,
    });
    if (!text) return;
    const beats = parseStringArray(text).slice(0, 6);
    // Insert as suggestions (new parts appended) — never overwrite user parts.
    for (const beat of beats) {
      // eslint-disable-next-line no-await-in-loop
      await addPart(undefined, beat);
    }
  }

  async function suggestEnding() {
    const text = await callAI("suggest_ending", {
      hook,
      parts: parts.map((p) => p.body),
      brand,
    });
    if (text) setEndingSuggestions(parseStringArray(text).slice(0, 3));
  }

  /* ------------- render ------------- */

  return (
    <div className="space-y-6">
      {/* Context bar */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/idea/${idea.id}`} className="text-sm text-neutral-500 underline">
              ← Idea
            </Link>
            <h1 className="truncate text-lg font-bold">{idea.title ?? "Untitled idea"}</h1>
            {idea.summary && (
              <p className="line-clamp-2 text-sm text-neutral-500">{idea.summary}</p>
            )}
          </div>
          <span className="shrink-0 text-sm text-neutral-400">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved ✓"}
            {saveState === "error" && <span className="text-red-600">Save failed</span>}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {props.audioUrl && (
            <audio controls preload="none" src={props.audioUrl} className="h-11 max-w-full" />
          )}
          {idea.transcript && (
            <button className="btn-secondary text-sm" onClick={() => setShowTranscript(true)}>
              Transcript
            </button>
          )}
          <span className="flex-1" />
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
            {(["real_one", "operator"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`btn !min-h-0 !min-w-0 !rounded-lg !px-3 !py-2 text-xs ${
                  brand === b ? "bg-white shadow" : "text-neutral-500"
                }`}
              >
                {b === "real_one" ? "The Real One" : "The Operator"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {aiError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{aiError}</p>
      )}

      {/* HOOK */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold tracking-wide">HOOK</h2>
          <button
            className="btn-secondary !min-h-0 !py-2 text-sm disabled:opacity-50"
            disabled={aiBusy !== null}
            onClick={suggestHooks}
          >
            {aiBusy === "suggest_hooks" ? "Thinking…" : "✨ Suggest 5"}
          </button>
        </div>
        <textarea
          className="input min-h-[80px]"
          placeholder="The opener that stops the scroll…"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
        />
        {hookSuggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {hookSuggestions.map((s, i) => (
              <li key={i}>
                <button
                  className="w-full rounded-xl border border-dashed border-neutral-300 p-3 text-left text-sm active:bg-neutral-50"
                  onClick={() => {
                    setHook(s);
                    setHookSuggestions([]);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* STORY */}
      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-semibold tracking-wide">STORY</h2>
          <button
            className="btn-secondary !min-h-0 !py-2 text-sm disabled:opacity-50"
            disabled={aiBusy !== null}
            onClick={draftParts}
          >
            {aiBusy === "draft_parts" ? "Thinking…" : "✨ Draft beats"}
          </button>
        </div>

        <div className="space-y-3" onPointerMove={handleDragMove} onPointerUp={handleDragEnd}>
          {parts.map((part, index) => (
            <div
              key={part.id}
              data-part-index={index}
              className={`rounded-2xl border bg-white p-3 ${
                dragIndex === index ? "border-neutral-900 shadow-lg" : "border-neutral-200"
              }`}
              onPaste={handlePaste(part)}
            >
              <div className="flex gap-2">
                <div className="flex flex-col items-center gap-1">
                  <button
                    aria-label="Drag to reorder"
                    className="flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-100"
                    onPointerDown={handleDragStart(index)}
                  >
                    ⠹⠹
                  </button>
                  <span className="text-xs font-medium text-neutral-400">{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <textarea
                    className="input min-h-[70px]"
                    placeholder={`Beat ${index + 1} — what happens here?`}
                    value={part.body}
                    onChange={(e) => setPartBody(part.id, e.target.value)}
                    onSelect={(e) => {
                      cursorRef.current[part.id] =
                        (e.target as HTMLTextAreaElement).selectionStart ?? part.body.length;
                    }}
                  />

                  {/* Visual reference */}
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-xs text-neutral-400">visual:</span>
                      {([null, "note", "drawing"] as const).map((kind) => (
                        <button
                          key={kind ?? "none"}
                          onClick={() => switchVisualKind(part, kind)}
                          className={`btn !min-h-0 !min-w-0 !rounded-lg !px-3 !py-2 text-xs ${
                            (part.visual_kind ?? null) === kind
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {kind === null ? "none" : kind === "drawing" ? "draw" : kind}
                        </button>
                      ))}
                      <label
                        className={`btn !min-h-0 !min-w-0 cursor-pointer !rounded-lg !px-3 !py-2 text-xs ${
                          part.visual_kind === "image"
                            ? "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        img
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadVisual(part, f, "image");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {part.visual_kind === "note" && (
                      <input
                        className="input mt-2 !min-h-0 !py-2 text-sm"
                        placeholder='e.g. "screen recording of the dashboard here"'
                        value={part.visual_text ?? ""}
                        onChange={(e) => setVisualNote(part, e.target.value)}
                      />
                    )}
                    {(part.visual_kind === "image" || part.visual_kind === "drawing") &&
                      signedUrls[part.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signedUrls[part.id]}
                          alt="visual reference"
                          className="mt-2 max-h-40 rounded-xl border border-neutral-200"
                        />
                      )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      className="btn !min-h-0 !min-w-0 bg-neutral-100 !px-3 !py-2 text-xs"
                      onClick={() => splitPart(part, index)}
                    >
                      ✂ Split here
                    </button>
                    <button
                      className="btn !min-h-0 !min-w-0 bg-neutral-100 !px-3 !py-2 text-xs disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => movePart(index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn !min-h-0 !min-w-0 bg-neutral-100 !px-3 !py-2 text-xs disabled:opacity-30"
                      disabled={index === parts.length - 1}
                      onClick={() => movePart(index, index + 1)}
                    >
                      ↓
                    </button>
                    <span className="flex-1" />
                    <button
                      className="btn !min-h-0 !min-w-0 bg-neutral-100 !px-3 !py-2 text-xs !text-red-600"
                      onClick={() => deletePart(part.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-secondary mt-3 w-full" onClick={() => addPart()}>
          ＋ Add part
        </button>
      </section>

      {/* END */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold tracking-wide">END / CLIFFHANGER</h2>
          <button
            className="btn-secondary !min-h-0 !py-2 text-sm disabled:opacity-50"
            disabled={aiBusy !== null}
            onClick={suggestEnding}
          >
            {aiBusy === "suggest_ending" ? "Thinking…" : "✨ Suggest"}
          </button>
        </div>
        <textarea
          className="input min-h-[80px]"
          placeholder="Land the point, or set the cliffhanger…"
          value={ending}
          onChange={(e) => setEnding(e.target.value)}
        />
        {endingSuggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {endingSuggestions.map((s, i) => (
              <li key={i}>
                <button
                  className="w-full rounded-xl border border-dashed border-neutral-300 p-3 text-left text-sm active:bg-neutral-50"
                  onClick={() => {
                    setEnding(s);
                    setEndingSuggestions([]);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Generate platform variants */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 font-semibold tracking-wide">PLATFORM VARIANTS</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {["instagram", "twitter", "linkedin"].map((p) => (
            <button
              key={p}
              onClick={() =>
                setPlatforms((cur) =>
                  cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
                )
              }
              className={`btn !min-w-0 !rounded-xl !px-4 text-sm ${
                platforms.includes(p)
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {p === "instagram" ? "Instagram · Real One" : p === "twitter" ? "Twitter/X · Operator" : "LinkedIn · Operator"}
            </button>
          ))}
        </div>
        <button
          className="btn-primary w-full disabled:opacity-50"
          disabled={aiBusy !== null || platforms.length === 0}
          onClick={async () => {
            setAiBusy("variants");
            setAiError(null);
            try {
              const res = await fetch("/api/variants/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ideaId: idea.id, platforms }),
              });
              const data = await res.json();
              if (!res.ok) {
                setAiError(data?.error ?? "Variant generation failed.");
                return;
              }
              router.push(`/idea/${idea.id}#variants`);
              router.refresh();
            } catch {
              setAiError("Variant generation failed — check your connection.");
            } finally {
              setAiBusy(null);
            }
          }}
        >
          {aiBusy === "variants" ? "Writing variants…" : "Generate platform variants ▸"}
        </button>
      </section>

      {/* Transcript slide-over */}
      {showTranscript && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowTranscript(false)}>
          <div
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Transcript</h3>
              <button className="btn-secondary !min-h-0 !py-2 text-sm" onClick={() => setShowTranscript(false)}>
                Close
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">{idea.transcript}</p>
          </div>
        </div>
      )}

      {drawingFor && (
        <DrawingModal
          onClose={() => setDrawingFor(null)}
          onSave={async (png) => {
            const part = parts.find((p) => p.id === drawingFor);
            if (part) await uploadVisual(part, png, "drawing");
            setDrawingFor(null);
          }}
        />
      )}
    </div>
  );
}
