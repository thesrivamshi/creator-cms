"use client";

// Variant cards: edit, copy-to-clipboard (manual publish), mark posted with
// optional live URL — docs/01 §7. No auto-posting (binding non-goal).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export interface Variant {
  id: string;
  platform: string;
  hook: string | null;
  body: string;
  media_notes: string | null;
  status: string;
  posted_url: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
};

export default function VariantsList({ variants }: { variants: Variant[] }) {
  if (variants.length === 0) return null;
  return (
    <section id="variants" className="space-y-3">
      <h2 className="text-lg font-semibold">Platform variants</h2>
      {variants.map((v) => (
        <VariantCard key={v.id} variant={v} />
      ))}
    </section>
  );
}

function VariantCard({ variant }: { variant: Variant }) {
  const router = useRouter();
  const [body, setBody] = useState(variant.body);
  const [status, setStatus] = useState(variant.status);
  const [postedUrl, setPostedUrl] = useState(variant.posted_url ?? "");
  const [showPostForm, setShowPostForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  async function saveBody(next: string) {
    setBody(next);
    setSaveState("saving");
    const supabase = createClient();
    await supabase.from("variants").update({ body: next }).eq("id", variant.id);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1200);
  }

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function markPosted() {
    const supabase = createClient();
    await supabase
      .from("variants")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        posted_url: postedUrl || null,
      })
      .eq("id", variant.id);
    // Any schedule slots for this variant are done now.
    await supabase.from("schedule").update({ done: true }).eq("variant_id", variant.id);
    setStatus("posted");
    setShowPostForm(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this variant?")) return;
    const supabase = createClient();
    await supabase.from("variants").delete().eq("id", variant.id);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
          {PLATFORM_LABEL[variant.platform] ?? variant.platform}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === "posted" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {status}
        </span>
        <span className="ml-auto text-xs text-neutral-400">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}
        </span>
      </div>

      <textarea
        className="input min-h-[140px] font-[inherit]"
        value={body}
        onChange={(e) => saveBody(e.target.value)}
      />
      {variant.media_notes && (
        <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500">
          🎬 {variant.media_notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary !min-h-0 !py-2 text-sm" onClick={copy}>
          {copied ? "Copied ✓" : "Copy text"}
        </button>
        {status !== "posted" && (
          <button
            className="btn-secondary !min-h-0 !py-2 text-sm"
            onClick={() => setShowPostForm((s) => !s)}
          >
            Mark posted
          </button>
        )}
        {status === "posted" && variant.posted_url && (
          <a
            href={variant.posted_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline"
          >
            View live post
          </a>
        )}
        <span className="flex-1" />
        <button className="btn-secondary !min-h-0 !py-2 text-sm !text-red-600" onClick={remove}>
          Delete
        </button>
      </div>

      {showPostForm && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-neutral-50 p-3 sm:flex-row">
          <input
            className="input flex-1 !min-h-0 !py-2 text-sm"
            placeholder="Live post URL (optional)"
            value={postedUrl}
            onChange={(e) => setPostedUrl(e.target.value)}
          />
          <button className="btn-primary !min-h-0 !py-2 text-sm" onClick={markPosted}>
            Confirm posted
          </button>
        </div>
      )}
    </div>
  );
}
