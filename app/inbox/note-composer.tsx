"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NoteComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/capture/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    if (res.ok) {
      setText("");
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to save note.");
    }
  }

  if (!open) {
    return (
      <button className="btn-secondary w-full" onClick={() => setOpen(true)}>
        ＋ Jot a note
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <textarea
        autoFocus
        className="input min-h-[100px]"
        placeholder="Type the idea while it's hot…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <button
          className="btn-primary disabled:opacity-50"
          disabled={busy || text.trim().length === 0}
          onClick={save}
        >
          {busy ? "Saving…" : "Capture"}
        </button>
        <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
