"use client";

// Voice capture per docs/04-capture-flows.md:
// record (MediaRecorder, Safari = audio/mp4 AAC) → upload the ORIGINAL first
// → transcribe → enrich. If upload fails the blob is kept in memory and the
// user can retry — a recording is never silently dropped.
// Max 20 minutes, soft warning at 15. Survives rotation/brief backgrounding
// because recording state lives in refs, not the DOM.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase =
  | "idle"
  | "recording"
  | "uploading"
  | "transcribing"
  | "done"
  | "upload_failed"
  | "transcribe_failed";

const MAX_SECONDS = 20 * 60;
const WARN_SECONDS = 15 * 60;

function pickMimeType(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "m4a" };
  if (MediaRecorder.isTypeSupported("audio/mp4")) return { mime: "audio/mp4", ext: "m4a" };
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
    return { mime: "audio/webm;codecs=opus", ext: "webm" };
  if (MediaRecorder.isTypeSupported("audio/webm")) return { mime: "audio/webm", ext: "webm" };
  return { mime: "", ext: "m4a" };
}

export default function VoiceRecorder() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0..1 mic level for the pulse ring

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const extRef = useRef("m4a");
  const ideaIdRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Allow the mic in Safari settings and try again.");
      return;
    }

    const { mime, ext } = pickMimeType();
    extRef.current = ext;
    const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mime || "audio/mp4" });
      blobRef.current = blob;
      void uploadAndTranscribe();
    };
    recorderRef.current = recorder;
    recorder.start(1000); // timeslice: chunks survive even if the tab dies

    // Simple level meter (visible waveform substitute).
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, sum / data.length / 80));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // level meter is cosmetic — recording continues without it
    }

    setSeconds(0);
    setPhase("recording");
    tickRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop(); // onstop → uploadAndTranscribe
    }
  }

  async function uploadAndTranscribe() {
    const blob = blobRef.current;
    if (!blob || blob.size === 0) {
      setError("Nothing was recorded.");
      setPhase("idle");
      return;
    }

    setPhase("uploading");
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired — reload and sign in.");
      setPhase("upload_failed");
      return;
    }

    try {
      // Create the idea row first so the storage path can use its id.
      if (!ideaIdRef.current) {
        const { data: idea, error: insertError } = await supabase
          .from("ideas")
          .insert({
            user_id: user.id,
            source_type: "voice",
            title: `Voice note — ${new Date().toLocaleString()}`,
            status: "captured",
          })
          .select("id")
          .single();
        if (insertError || !idea) throw new Error("Could not create the idea row");
        ideaIdRef.current = idea.id;
      }

      // Upload the ORIGINAL recording first — it is kept permanently.
      const objectPath = `${user.id}/${ideaIdRef.current}.${extRef.current}`;
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(objectPath, blob, { upsert: true, contentType: blob.type });
      if (uploadError) throw new Error("Upload failed");

      await supabase
        .from("ideas")
        .update({ audio_path: `audio/${objectPath}` })
        .eq("id", ideaIdRef.current);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Upload failed") +
          " — the recording is still on this page; tap Retry."
      );
      setPhase("upload_failed");
      return;
    }

    // Transcribe (retryable server-side step).
    setPhase("transcribing");
    try {
      const res = await fetch("/api/capture/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: ideaIdRef.current }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Transcription failed");
      }
      setPhase("done");
      blobRef.current = null;
      const id = ideaIdRef.current;
      ideaIdRef.current = null;
      router.push(`/idea/${id}`);
      router.refresh();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Transcription failed") +
          " — your audio is saved. You can retry, or find the idea in the Inbox and tap Transcribe again."
      );
      setPhase("transcribe_failed");
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (phase === "recording") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={stop}
            aria-label="Stop recording"
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white"
            style={{ boxShadow: `0 0 0 ${4 + level * 14}px rgba(220,38,38,0.25)` }}
          >
            <span className="block h-5 w-5 rounded-sm bg-white" />
          </button>
          <div>
            <p className="font-mono text-2xl tabular-nums">{mm}:{ss}</p>
            <p className="text-sm text-neutral-500">
              {seconds >= WARN_SECONDS
                ? `Wrapping up? Hard limit at 20:00.`
                : "Recording… tap to stop"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "uploading" || phase === "transcribing") {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="font-medium">
          {phase === "uploading" ? "Uploading recording…" : "Transcribing…"}
        </p>
        <p className="text-sm text-neutral-500">
          {phase === "uploading"
            ? "Saving the original audio first — it's never thrown away."
            : "Whisper is listening. This can take a moment for long notes."}
        </p>
      </div>
    );
  }

  if (phase === "upload_failed" || phase === "transcribe_failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4">
        <p className="mb-2 text-sm text-red-600">{error}</p>
        <div className="flex gap-2">
          <button
            className="btn-primary"
            onClick={() =>
              phase === "upload_failed" ? uploadAndTranscribe() : uploadAndTranscribe()
            }
          >
            Retry
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              blobRef.current = null;
              ideaIdRef.current = null;
              setPhase("idle");
            }}
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={start}
        aria-label="Record a voice note"
        className="btn-primary w-full !bg-red-600 active:!bg-red-700"
      >
        ● Record voice note
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
