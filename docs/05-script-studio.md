# 05 — Script Studio

The heart of the app. Turns an idea into a video/post script with the owner's
storytelling structure: **Hook → Story (in parts) → End (cliffhanger/close)**.

## Layout (iPad, single screen)
```
┌────────────────────────────────────────────────┐
│ Idea context bar: title • summary • [▶ audio]  │
│ (collapsible; transcript in a slide-over)      │
├────────────────────────────────────────────────┤
│ HOOK        [textarea]        [✨ suggest 5]    │
├────────────────────────────────────────────────┤
│ STORY                                          │
│  ┌ Part 1 ──────────────┬ visual ref ┐         │
│  │ [textarea]           │ [note|img|draw]      │
│  └──────────────────────┴────────────┘         │
│  ┌ Part 2 ... ┐   [+ add part] [split part]    │
├────────────────────────────────────────────────┤
│ END / CLIFFHANGER  [textarea]  [✨ suggest]     │
├────────────────────────────────────────────────┤
│ [Generate platform variants ▸]                 │
└────────────────────────────────────────────────┘
```

## Story parts
- Add, delete, reorder (drag handle, touch-friendly), and **split**: place cursor
  in a part, tap "split here" → text after cursor becomes a new part below.
- Each part = one beat of the story. Position renumbered on change.

## Visual references (per part)
The owner sees a "shot" in his head for each beat. Three ways to pin it:
1. **Note** — typed description ("screen recording of the dashboard here").
2. **Image** — paste (Cmd/long-press-paste) or pick from Photos → uploaded to
   `visuals/{user_id}/{part_id}.png`, shown as a thumbnail on the part.
3. **Drawing** — minimal canvas modal (Apple Pencil friendly): black pen, eraser,
   undo, clear. Export PNG → same storage path. Use a tiny canvas lib or raw
   `<canvas>` with pointer events; no heavy drawing framework.
A part can have kind switched; replacing overwrites the previous visual.

## AI assists (writing = Anthropic provider)
- **Suggest 5 hooks** — from idea summary + transcript + chosen brand persona.
- **Draft story parts** — from transcript, propose a 3–6 part beat structure the
  user then edits. Never auto-overwrite user-written parts; insert as suggestions.
- **Suggest ending/cliffhanger** — given hook + parts.
- **Generate platform variants** — compile hook+parts+end and rewrite per platform
  in the correct persona voice (brand_guidelines from profile). Creates `variants`
  rows (draft) for Instagram / Twitter / LinkedIn as selected.

All prompts must include the user's brand_guidelines JSON so voice is user-tunable
without code changes.

## Autosave
Debounced autosave (800ms) on every field. Visible "saved" tick. A script is never
lost to navigation — this app's whole promise is "nothing gets lost."
