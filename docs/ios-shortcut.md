# iOS Shortcut — capture links from the share sheet

Build once (~3 minutes), then any YouTube / Instagram / Twitter link can be sent
to your Idea Inbox straight from the iPad/iPhone share sheet.

## What you need

1. Your deployed app URL, e.g. `https://creator-cms-phi.vercel.app`
2. Your **capture token**: open the app → Settings → Capture token → Generate →
   Copy. (Rotating the token later invalidates the old one — update the
   Shortcut if you rotate.)

## Build the Shortcut

1. Open the **Shortcuts** app → **+** to create a new Shortcut.
2. Tap the name at the top → rename it to **"Capture Idea"**.
3. Tap the **ⓘ** (info) panel → enable **Show in Share Sheet**.
   Under "Share Sheet Types" keep **URLs** (and **Safari web pages**).
4. Add these actions in order:

   **Action 1 — Receive input**
   The first block reads "Receive **Any** input from **Share Sheet**".
   Set it to receive **URLs / Safari web pages**.
   Set "If there's no input" to **Ask For** → **URLs** (lets you also run it manually).

   **Action 2 — Get URLs from Input**
   Search for "Get URLs from Input" and add it. Input: **Shortcut Input**.

   **Action 3 — Get Contents of URL** (this makes the API call)
   Search for "Get Contents of URL" and add it. Then expand **Show More** and configure:
   - URL: `https://YOUR-APP-URL/api/capture/link`
   - Method: **POST**
   - Headers: add one header —
     - Key: `Authorization`
     - Value: `Bearer YOUR_CAPTURE_TOKEN` (the word "Bearer", a space, then the token)
   - Request Body: **JSON**, add one field —
     - Key: `url` · Type: Text · Value: select the **URLs** variable from Action 2

   **Action 4 — Show Notification** (optional but nice)
   Search for "Show Notification". Title: `Idea captured ✓`.
   Body: select the **Contents of URL** variable to see the server response.

5. Done. Tap the share icon on any YouTube video / post → scroll the share
   sheet → **Capture Idea**.

## Testing it

Share any YouTube link. Within ~10 seconds the idea appears in your Inbox with
an AI title, summary, pillar tag, and brand suggestion (AI tagging needs your
OpenAI key set in Settings — without it the raw link is still saved, never lost).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Notification shows `Missing capture token` | The Authorization header is missing the `Bearer ` prefix or the token. |
| Notification shows `Invalid capture token` | Token was rotated — copy the current one from Settings. |
| Idea appears but untagged, notes say "AI enrichment failed" | Add/check your OpenAI key in Settings. The capture itself is never lost. |
| Nothing happens | Ensure "Show in Share Sheet" is on and the Shortcut receives URLs. |
