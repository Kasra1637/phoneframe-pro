# MockReel — PRD / Working Notes

## Problem statement (latest session, 2026-06)
User reported the "Hand Holding" view was distorted: hand/environment/colors distorted, plus an extra
synthetic phone frame drawn on top of the real phone in the stock photo. Requirement: insert the uploaded
video directly into the phone screen already present in the stock photo, zero distortion, keep the
Environment selector working, keep Screen-position fine-tune sliders, and make the hand motion feel natural.

## Stack
Vite + React 19 + TS + Tailwind 4, Cloudflare Workers (wrangler) target. No backend. Dev server: `npx vite` on :3000.

## Implemented (2026-06-30)
- Rewrote `src/handView.ts`:
  - Backdrop removal via border flood fill with tight local luma tolerance (±5) + chroma gate, plus a
    rounded-rect phone-body protection mask so the white phone front panel is never keyed out. Small-hole
    closing + 1px feather. Cached once per image.
  - Draw order: environment (cover fit, native aspect, slight blur/dim) → untouched keyed photo → uploaded
    video clipped to the photo's real screen rect. No synthetic phone frame in hand mode.
  - `DEFAULT_SCREEN` = {x:0.3625, y:0.2390, w:0.3538, h:0.4667}, measured from the stock photo's black screen.
  - Natural handheld motion: slow drift + breathing scale + micro-tremor applied to photo and video together
    (group transform ⇒ no relative distortion).
- `src/App.tsx`: screen sliders default to DEFAULT_SCREEN, step 0.001, added "Reset to photo screen" + test ids.
- `vite.config.ts`: added `server: { host, port: 3000, allowedHosts: true }` so the preview URL loads.

## Verified
Testing agent iteration_1: 100% frontend pass — upload, hand view compositing, environment switching,
screen sliders + reset, floating view, MP4 export/download, zero console errors.

## Backlog
- P1: Multiple hand/environment stock photos to choose from.
- P2: Split App.tsx (1200 lines) into modules; move keying to a Web Worker.
- P2: Optional device reflection/shadow matched to selected environment.
