"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type KeyRow = { provider: string; key_last4: string };
type Routes = Record<string, { provider: string; model: string }>;

const DEFAULT_REAL_ONE = `Voice: unfiltered friend energy. Funny, direct, attention-grabbing, zero polish.
Audience: ambitious builders/creators. Depth over reach; 1,000 true fans.
Pillars: raw journey ("confused to 5 income streams"), building in public, values/way of working, AI experiments as life content.`;

const DEFAULT_OPERATOR = `Voice: high-signal, ownership-oriented, credible. Show the work.
Audience: founders, VCs, hiring managers, top engineers.
Pillars: real AI systems built, paper/tool/model breakdowns, product experiments, engineer→product transition story.`;

const WRITING_OPTIONS = [
  "anthropic/claude-sonnet-4-6",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-4-8",
  "openai/gpt-4o",
];
const SMALL_OPTIONS = ["openai/gpt-4o-mini", "anthropic/claude-haiku-4-5"];

export default function SettingsClient(props: {
  initialKeys: KeyRow[];
  initialToken: string | null;
  initialGuidelines: Record<string, string>;
  initialRoutes: Routes;
}) {
  return (
    <div className="space-y-10">
      <KeysSection initialKeys={props.initialKeys} />
      <TokenSection initialToken={props.initialToken} />
      <GuidelinesSection initial={props.initialGuidelines} />
      <RoutingSection initial={props.initialRoutes} />
    </div>
  );
}

/* ---------------- API keys ---------------- */

function KeysSection({ initialKeys }: { initialKeys: KeyRow[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">AI provider keys</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Bring your own keys. They are encrypted before storage, used only
        server-side, and never shown again after saving.
      </p>
      <div className="space-y-4">
        <KeyCard
          provider="anthropic"
          label="Anthropic"
          hint="Used for writing tasks (hooks, story drafts, platform variants)."
          initial={initialKeys.find((k) => k.provider === "anthropic") ?? null}
        />
        <KeyCard
          provider="openai"
          label="OpenAI"
          hint="Used for small tasks (idea tagging) and Whisper voice transcription."
          initial={initialKeys.find((k) => k.provider === "openai") ?? null}
        />
      </div>
    </section>
  );
}

function KeyCard({
  provider,
  label,
  hint,
  initial,
}: {
  provider: string;
  label: string;
  hint: string;
  initial: KeyRow | null;
}) {
  const [last4, setLast4] = useState<string | null>(initial?.key_last4 ?? null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy("save");
    setStatus(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key: input }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      setLast4(data.last4);
      setInput("");
      setStatus({ kind: "ok", text: "Saved. Tap Test to verify." });
    } else {
      setStatus({ kind: "err", text: data.error ?? "Failed to save." });
    }
  }

  async function test() {
    setBusy("test");
    setStatus(null);
    const res = await fetch("/api/keys/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    setBusy(null);
    setStatus(
      data.ok
        ? { kind: "ok", text: "✓ Key works" }
        : { kind: "err", text: `✗ ${data.error ?? "Test failed"}` }
    );
  }

  async function remove() {
    setBusy("remove");
    setStatus(null);
    const res = await fetch(`/api/keys?provider=${provider}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setLast4(null);
      setStatus({ kind: "ok", text: "Key removed." });
    } else {
      setStatus({ kind: "err", text: "Failed to remove." });
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        {last4 && (
          <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs">
            sk-…{last4}
          </span>
        )}
      </div>
      <p className="mb-3 text-sm text-neutral-500">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          className="input flex-1"
          placeholder={last4 ? "Replace key…" : "Paste API key…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 disabled:opacity-50 sm:flex-none"
            disabled={busy !== null || input.trim().length < 20}
            onClick={save}
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            className="btn-secondary flex-1 disabled:opacity-50 sm:flex-none"
            disabled={busy !== null || !last4}
            onClick={test}
          >
            {busy === "test" ? "Testing…" : "Test"}
          </button>
          <button
            className="btn-secondary flex-1 !text-red-600 disabled:opacity-50 sm:flex-none"
            disabled={busy !== null || !last4}
            onClick={remove}
          >
            {busy === "remove" ? "…" : "Remove"}
          </button>
        </div>
      </div>
      {status && (
        <p
          className={`mt-2 text-sm ${
            status.kind === "ok" ? "text-green-700" : "text-red-600"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}

/* ---------------- Capture token ---------------- */

function TokenSection({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function rotate() {
    if (token && !confirm("Rotate the token? Your iOS Shortcut will need the new value.")) return;
    setBusy(true);
    const res = await fetch("/api/capture-token", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (res.ok) setToken(data.token);
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Capture token</h2>
      <p className="mb-4 text-sm text-neutral-500">
        Your iOS Shortcut sends this as a Bearer header to capture links from
        the share sheet. Setup guide ships with the Inbox (M2).
      </p>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        {token ? (
          <div className="mb-3 break-all rounded-lg bg-neutral-50 p-3 font-mono text-xs">
            {token}
          </div>
        ) : (
          <p className="mb-3 text-sm text-neutral-500">No token yet.</p>
        )}
        <div className="flex gap-2">
          <button className="btn-primary disabled:opacity-50" disabled={busy} onClick={rotate}>
            {busy ? "Working…" : token ? "Rotate token" : "Generate token"}
          </button>
          {token && (
            <button className="btn-secondary" onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Brand guidelines ---------------- */

function GuidelinesSection({ initial }: { initial: Record<string, string> }) {
  const [realOne, setRealOne] = useState(initial.real_one ?? "");
  const [operator, setOperator] = useState(initial.operator ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setState("saving");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setState("error");
    const { error } = await supabase
      .from("profiles")
      .update({ brand_guidelines: { real_one: realOne, operator } })
      .eq("user_id", user.id);
    setState(error ? "error" : "saved");
    if (!error) setTimeout(() => setState("idle"), 1500);
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Brand guidelines</h2>
      <p className="mb-4 text-sm text-neutral-500">
        These persona docs are injected into every AI writing prompt, so the
        voice is yours to tune — no code changes needed.
      </p>
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 font-medium">
            “The Real One” <span className="text-sm font-normal text-neutral-400">— Instagram</span>
          </h3>
          <textarea
            className="input min-h-[120px]"
            placeholder={DEFAULT_REAL_ONE}
            value={realOne}
            onChange={(e) => setRealOne(e.target.value)}
          />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 font-medium">
            “The Operator” <span className="text-sm font-normal text-neutral-400">— LinkedIn + Twitter/X</span>
          </h3>
          <textarea
            className="input min-h-[120px]"
            placeholder={DEFAULT_OPERATOR}
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-primary disabled:opacity-50"
            disabled={state === "saving"}
            onClick={save}
          >
            {state === "saving" ? "Saving…" : "Save guidelines"}
          </button>
          {state === "saved" && <span className="text-sm text-green-700">Saved ✓</span>}
          {state === "error" && <span className="text-sm text-red-600">Failed to save</span>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Model routing (advanced) ---------------- */

function RoutingSection({ initial }: { initial: Routes }) {
  const [writing, setWriting] = useState(
    initial.writing ? `${initial.writing.provider}/${initial.writing.model}` : WRITING_OPTIONS[0]
  );
  const [small, setSmall] = useState(
    initial.small ? `${initial.small.provider}/${initial.small.model}` : SMALL_OPTIONS[0]
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setState("saving");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setState("error");
    const [wp, wm] = writing.split("/");
    const [sp, sm] = small.split("/");
    const { error } = await supabase
      .from("profiles")
      .update({
        model_routes: {
          writing: { provider: wp, model: wm },
          small: { provider: sp, model: sm },
          transcribe: { provider: "openai", model: "whisper-1" },
        },
      })
      .eq("user_id", user.id);
    setState(error ? "error" : "saved");
    if (!error) setTimeout(() => setState("idle"), 1500);
  }

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Model routing <span className="text-sm font-normal text-neutral-400">(advanced)</span></h2>
      <p className="mb-4 text-sm text-neutral-500">
        Which model handles each kind of task. Defaults are sensible; change
        only if you know why. Transcription is always OpenAI whisper-1 in v1.
      </p>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Writing tasks</span>
            <select className="input" value={writing} onChange={(e) => setWriting(e.target.value)}>
              {WRITING_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Small tasks</span>
            <select className="input" value={small} onChange={(e) => setSmall(e.target.value)}>
              {SMALL_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="btn-primary disabled:opacity-50"
            disabled={state === "saving"}
            onClick={save}
          >
            {state === "saving" ? "Saving…" : "Save routing"}
          </button>
          {state === "saved" && <span className="text-sm text-green-700">Saved ✓</span>}
          {state === "error" && <span className="text-sm text-red-600">Failed to save</span>}
        </div>
      </div>
    </section>
  );
}
