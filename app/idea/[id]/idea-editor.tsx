"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function TranscribeAgain({ ideaId, onDone }: { ideaId: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setState("busy");
    setMessage(null);
    const res = await fetch("/api/capture/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaId }),
    });
    if (res.ok) {
      setState("idle");
      onDone();
    } else {
      const data = await res.json().catch(() => null);
      setState("error");
      setMessage(data?.error ?? "Transcription failed.");
    }
  }

  return (
    <div className="mt-2">
      <button className="btn-secondary !min-h-0 !px-3 !py-2 text-sm disabled:opacity-50" disabled={state === "busy"} onClick={run}>
        {state === "busy" ? "Transcribing…" : "Transcribe again"}
      </button>
      {message && <p className="mt-1 text-sm text-red-600">{message}</p>}
    </div>
  );
}

const STATUSES = [
  "captured",
  "reviewed",
  "scripted",
  "drafted",
  "scheduled",
  "posted",
  "archived",
] as const;

const BRANDS = [
  { value: "real_one", label: "The Real One" },
  { value: "operator", label: "The Operator" },
  { value: "both", label: "Both" },
  { value: "unsure", label: "Unsure" },
] as const;

interface Idea {
  id: string;
  title: string | null;
  summary: string | null;
  pillar: string | null;
  suggested_brand: string;
  status: string;
  source_type: string;
  source_url: string | null;
  raw_text: string | null;
  transcript: string | null;
  agent_notes: string | null;
  audio_path: string | null;
  created_at: string;
}

export default function IdeaEditor({
  idea,
  audioUrl,
}: {
  idea: Idea;
  audioUrl: string | null;
}) {
  const router = useRouter();
  const [fields, setFields] = useState({
    title: idea.title ?? "",
    summary: idea.summary ?? "",
    pillar: idea.pillar ?? "",
    suggested_brand: idea.suggested_brand,
    status: idea.status,
    agent_notes: idea.agent_notes ?? "",
    transcript: idea.transcript ?? "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  // Debounced autosave — nothing gets lost (docs/05-script-studio.md).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("ideas")
        .update({
          title: fields.title || null,
          summary: fields.summary || null,
          pillar: fields.pillar || null,
          suggested_brand: fields.suggested_brand,
          status: fields.status,
          agent_notes: fields.agent_notes || null,
          transcript: fields.transcript || null,
        })
        .eq("id", idea.id);
      setSaveState(error ? "error" : "saved");
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function set<K extends keyof typeof fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function copyTranscript() {
    await navigator.clipboard.writeText(fields.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function archive() {
    if (!confirm("Archive this idea?")) return;
    const supabase = createClient();
    await supabase.from("ideas").update({ status: "archived" }).eq("id", idea.id);
    router.push("/inbox");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/inbox" className="text-sm text-neutral-500 underline">
          ← Inbox
        </Link>
        <span className="text-sm text-neutral-400">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved ✓"}
          {saveState === "error" && <span className="text-red-600">Save failed</span>}
        </span>
      </div>

      <input
        className="input !text-xl !font-semibold"
        value={fields.title}
        placeholder="Idea title"
        onChange={(e) => set("title", e.target.value)}
      />

      <Link href={`/idea/${idea.id}/studio`} className="btn-primary w-full">
        ✍️ Open Script Studio
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Status</span>
          <select
            className="input"
            value={fields.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Brand</span>
          <select
            className="input"
            value={fields.suggested_brand}
            onChange={(e) => set("suggested_brand", e.target.value)}
          >
            {BRANDS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Pillar</span>
          <input
            className="input"
            value={fields.pillar}
            placeholder="e.g. building in public"
            onChange={(e) => set("pillar", e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Summary</span>
        <textarea
          className="input min-h-[90px]"
          value={fields.summary}
          onChange={(e) => set("summary", e.target.value)}
        />
      </label>

      {idea.source_url && (
        <p className="text-sm">
          <span className="font-medium">Source ({idea.source_type}): </span>
          <a
            href={idea.source_url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-blue-600 underline"
          >
            {idea.source_url}
          </a>
        </p>
      )}

      {audioUrl && (
        <div>
          <span className="mb-1 block text-sm font-medium">Original recording</span>
          {/* The recording is the source of truth; it is kept permanently. */}
          <audio controls preload="metadata" src={audioUrl} className="w-full" />
          <TranscribeAgain ideaId={idea.id} onDone={() => router.refresh()} />
        </div>
      )}

      {(fields.transcript || idea.audio_path) && (
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-sm font-medium">
            Transcript
            <button className="btn-secondary !min-h-0 !px-3 !py-1 text-xs" onClick={copyTranscript}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </span>
          <textarea
            className="input min-h-[160px]"
            value={fields.transcript}
            placeholder="No transcript yet."
            onChange={(e) => set("transcript", e.target.value)}
          />
        </label>
      )}

      {idea.raw_text && !fields.transcript && (
        <details className="rounded-xl border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">Captured text</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{idea.raw_text}</p>
        </details>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Agent notes</span>
        <textarea
          className="input min-h-[70px]"
          value={fields.agent_notes}
          onChange={(e) => set("agent_notes", e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <button className="btn-secondary !text-red-600" onClick={archive}>
          Archive
        </button>
        <span className="text-xs text-neutral-400">
          Captured {new Date(idea.created_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
