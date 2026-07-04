"use client";

// Minimal Apple-Pencil-friendly drawing canvas (docs/05-script-studio.md):
// black pen, eraser, undo, clear — raw <canvas> with pointer events, no
// drawing framework. Exports a PNG blob.

import { useEffect, useRef, useState } from "react";

type Stroke = { erase: boolean; points: { x: number; y: number }[] };

export default function DrawingModal({
  onSave,
  onClose,
}: {
  onSave: (png: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saving, setSaving] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Size the bitmap to the on-screen size × devicePixelRatio for crisp pencil lines.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ctx2d() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function redraw() {
    const canvas = canvasRef.current;
    const ctx = ctx2d();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length === 0) return;
    ctx.strokeStyle = s.erase ? "#ffffff" : "#111111";
    ctx.lineWidth = s.erase ? 24 : 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    currentRef.current = { erase: tool === "eraser", points: [pos(e)] };
  }

  function move(e: React.PointerEvent) {
    const s = currentRef.current;
    const ctx = ctx2d();
    if (!s || !ctx) return;
    s.points.push(pos(e));
    // Incremental draw of just the last segment keeps the pencil latency low.
    const n = s.points.length;
    drawStroke(ctx, { ...s, points: s.points.slice(n - 2) });
  }

  function up() {
    if (currentRef.current) {
      strokesRef.current.push(currentRef.current);
      currentRef.current = null;
      forceRender((x) => x + 1);
    }
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
    forceRender((x) => x + 1);
  }

  function clear() {
    strokesRef.current = [];
    redraw();
    forceRender((x) => x + 1);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    canvas.toBlob(async (blob) => {
      if (blob) await onSave(blob);
      setSaving(false);
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            className={`btn !min-w-0 !px-4 !py-2 text-sm ${tool === "pen" ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
            onClick={() => setTool("pen")}
          >
            ✏️ Pen
          </button>
          <button
            className={`btn !min-w-0 !px-4 !py-2 text-sm ${tool === "eraser" ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
            onClick={() => setTool("eraser")}
          >
            ◻ Eraser
          </button>
          <button
            className="btn !min-w-0 bg-neutral-100 !px-4 !py-2 text-sm disabled:opacity-40"
            onClick={undo}
            disabled={strokesRef.current.length === 0}
          >
            ↩ Undo
          </button>
          <button className="btn !min-w-0 bg-neutral-100 !px-4 !py-2 text-sm" onClick={clear}>
            Clear
          </button>
          <span className="flex-1" />
          <button className="btn-secondary !min-h-0 !py-2 text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary !min-h-0 !py-2 text-sm disabled:opacity-50" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full flex-1 touch-none rounded-xl border border-neutral-200"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
    </div>
  );
}
