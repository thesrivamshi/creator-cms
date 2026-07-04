"use client";

// Touch-first calendar (docs/01 §6, docs/07 M5): week/month views, drag
// variant cards onto dates with pointer events (works with touch, not just
// mouse), copy-to-clipboard, mark posted. No auto-posting — manual publish.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Variant {
  id: string;
  idea_id: string;
  platform: string;
  hook: string | null;
  body: string;
  status: string;
  posted_url: string | null;
}

interface Slot {
  id: string;
  variant_id: string;
  slot_at: string;
  done: boolean;
}

const PLATFORM_STYLE: Record<string, string> = {
  instagram: "bg-rose-100 text-rose-800",
  twitter: "bg-sky-100 text-sky-800",
  linkedin: "bg-indigo-100 text-indigo-800",
};

const PLATFORM_SHORT: Record<string, string> = {
  instagram: "IG",
  twitter: "X",
  linkedin: "LI",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday start
  out.setHours(0, 0, 0, 0);
  return out;
}

export default function CalendarClient({
  initialVariants,
  initialSlots,
  userId,
}: {
  initialVariants: Variant[];
  initialSlots: Slot[];
  userId: string;
}) {
  const supabase = createClient();
  const [variants, setVariants] = useState(initialVariants);
  const [slots, setSlots] = useState(initialSlots);
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [draggingVariant, setDraggingVariant] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ slot: Slot; variant: Variant } | null>(null);
  const dragMoved = useRef(false);

  const variantById = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, v])),
    [variants]
  );
  const slotsByDay = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      const key = dayKey(new Date(s.slot_at));
      (map[key] ??= []).push(s);
    }
    return map;
  }, [slots]);

  const scheduledVariantIds = new Set(slots.filter((s) => !s.done).map((s) => s.variant_id));
  const tray = variants.filter((v) => v.status !== "posted" && !scheduledVariantIds.has(v.id));

  /* ---------- date ranges ---------- */

  const days: Date[] = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [anchor, view]);

  function shift(delta: number) {
    const d = new Date(anchor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setAnchor(d);
  }

  /* ---------- scheduling ops ---------- */

  async function scheduleVariant(variantId: string, day: string) {
    const slotAt = new Date(`${day}T09:00:00`);
    const existing = slots.find((s) => s.variant_id === variantId && !s.done);
    if (existing) {
      // moving an already-scheduled variant
      setSlots((ss) =>
        ss.map((s) => (s.id === existing.id ? { ...s, slot_at: slotAt.toISOString() } : s))
      );
      await supabase
        .from("schedule")
        .update({ slot_at: slotAt.toISOString() })
        .eq("id", existing.id);
    } else {
      const { data } = await supabase
        .from("schedule")
        .insert({ user_id: userId, variant_id: variantId, slot_at: slotAt.toISOString() })
        .select("id, variant_id, slot_at, done")
        .single();
      if (data) setSlots((ss) => [...ss, data as Slot]);
      await supabase.from("variants").update({ status: "scheduled" }).eq("id", variantId);
      setVariants((vs) =>
        vs.map((v) => (v.id === variantId ? { ...v, status: "scheduled" } : v))
      );
    }
  }

  async function unschedule(slot: Slot) {
    setSlots((ss) => ss.filter((s) => s.id !== slot.id));
    await supabase.from("schedule").delete().eq("id", slot.id);
    await supabase.from("variants").update({ status: "draft" }).eq("id", slot.variant_id);
    setVariants((vs) =>
      vs.map((v) => (v.id === slot.variant_id ? { ...v, status: "draft" } : v))
    );
    setSheet(null);
  }

  async function markPosted(slot: Slot, variant: Variant, url: string) {
    await supabase
      .from("variants")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        posted_url: url || null,
      })
      .eq("id", variant.id);
    await supabase.from("schedule").update({ done: true }).eq("id", slot.id);
    setSlots((ss) => ss.map((s) => (s.id === slot.id ? { ...s, done: true } : s)));
    setVariants((vs) =>
      vs.map((v) => (v.id === variant.id ? { ...v, status: "posted", posted_url: url || null } : v))
    );
    setSheet(null);
  }

  /* ---------- pointer drag ---------- */

  function startDrag(variantId: string) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragMoved.current = false;
      setDraggingVariant(variantId);
    };
  }

  function onDragMove(e: React.PointerEvent) {
    if (!draggingVariant) return;
    dragMoved.current = true;
    const el = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((n) => n instanceof HTMLElement && n.dataset.day) as HTMLElement | undefined;
    setDragOverDay(el?.dataset.day ?? null);
  }

  async function onDragEnd() {
    const variantId = draggingVariant;
    const day = dragOverDay;
    setDraggingVariant(null);
    setDragOverDay(null);
    if (variantId && day && dragMoved.current) {
      await scheduleVariant(variantId, day);
    }
  }

  /* ---------- render ---------- */

  const todayKey = dayKey(new Date());
  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div onPointerMove={onDragMove} onPointerUp={onDragEnd} className="space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <span className="flex-1" />
        <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`btn !min-h-0 !min-w-0 !rounded-lg !px-4 !py-2 text-sm ${
                view === v ? "bg-white shadow" : "text-neutral-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-secondary !min-w-0 !px-4" onClick={() => shift(-1)}>←</button>
          <button className="btn-secondary !min-w-0 !px-3 text-sm" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button className="btn-secondary !min-w-0 !px-4" onClick={() => shift(1)}>→</button>
        </div>
      </header>

      {/* Unscheduled tray */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          Ready to schedule — drag onto a day
        </p>
        {tray.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Nothing waiting. Generate variants from a script in the{" "}
            <Link href="/inbox" className="underline">Inbox</Link>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tray.map((v) => (
              <div
                key={v.id}
                onPointerDown={startDrag(v.id)}
                className={`btn !min-w-0 cursor-grab touch-none select-none !rounded-xl !px-3 !py-2 text-sm ${
                  PLATFORM_STYLE[v.platform] ?? "bg-neutral-100"
                } ${draggingVariant === v.id ? "opacity-50 ring-2 ring-neutral-900" : ""}`}
              >
                <span className="mr-1 font-bold">{PLATFORM_SHORT[v.platform]}</span>
                {(v.hook ?? v.body).slice(0, 40)}…
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-lg font-semibold">{monthLabel}</p>

      {/* Grid */}
      <div className={view === "month" ? "grid grid-cols-7 gap-1" : "grid grid-cols-1 gap-2 sm:grid-cols-7"}>
        {view === "month" &&
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1 py-1 text-center text-xs font-medium text-neutral-400">
              {d}
            </div>
          ))}
        {days.map((d) => {
          const key = dayKey(d);
          const inMonth = view === "week" || d.getMonth() === anchor.getMonth();
          const daySlots = slotsByDay[key] ?? [];
          return (
            <div
              key={key}
              data-day={key}
              className={`min-h-[84px] rounded-xl border p-1.5 ${
                dragOverDay === key
                  ? "border-neutral-900 bg-neutral-100"
                  : key === todayKey
                    ? "border-neutral-400 bg-white"
                    : "border-neutral-200 bg-white"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <p className="mb-1 text-xs font-medium text-neutral-400">
                {view === "week"
                  ? d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
                  : d.getDate()}
              </p>
              <div className="space-y-1">
                {daySlots.map((s) => {
                  const v = variantById[s.variant_id];
                  if (!v) return null;
                  return (
                    <button
                      key={s.id}
                      onPointerDown={s.done ? undefined : startDrag(v.id)}
                      onClick={() => {
                        if (!dragMoved.current) setSheet({ slot: s, variant: v });
                      }}
                      className={`block w-full touch-none truncate rounded-lg px-2 py-1.5 text-left text-xs ${
                        PLATFORM_STYLE[v.platform] ?? "bg-neutral-100"
                      } ${s.done ? "line-through opacity-50" : ""}`}
                    >
                      <span className="font-bold">{PLATFORM_SHORT[v.platform]}</span>{" "}
                      {(v.hook ?? v.body).slice(0, 30)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom sheet */}
      {sheet && (
        <SlotSheet
          slot={sheet.slot}
          variant={sheet.variant}
          onClose={() => setSheet(null)}
          onUnschedule={() => unschedule(sheet.slot)}
          onMarkPosted={(url) => markPosted(sheet.slot, sheet.variant, url)}
        />
      )}
    </div>
  );
}

function SlotSheet({
  slot,
  variant,
  onClose,
  onUnschedule,
  onMarkPosted,
}: {
  slot: Slot;
  variant: Variant;
  onClose: () => void;
  onUnschedule: () => void;
  onMarkPosted: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(variant.posted_url ?? "");

  async function copy() {
    await navigator.clipboard.writeText(variant.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">
            {variant.platform} · {new Date(slot.slot_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            {slot.done && " · posted ✓"}
          </p>
          <button className="btn-secondary !min-h-0 !py-2 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm">
          {variant.body}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary !min-h-0 !py-2 text-sm" onClick={copy}>
            {copied ? "Copied ✓" : "Copy text"}
          </button>
          <Link href={`/idea/${variant.idea_id}`} className="btn-secondary !min-h-0 !py-2 text-sm">
            Open idea
          </Link>
          {!slot.done && (
            <button className="btn-secondary !min-h-0 !py-2 text-sm !text-red-600" onClick={onUnschedule}>
              Unschedule
            </button>
          )}
        </div>
        {!slot.done && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-neutral-50 p-3 sm:flex-row">
            <input
              className="input flex-1 !min-h-0 !py-2 text-sm"
              placeholder="Live post URL (optional)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="btn-primary !min-h-0 !py-2 text-sm" onClick={() => onMarkPosted(url)}>
              Mark posted
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
