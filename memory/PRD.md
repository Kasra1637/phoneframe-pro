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

## Update (2026-06-30, session 2) — new hand stock photo
- Replaced hand photo with Unsplash `photo-1691256676376-357c3aa66c89` (Caucasian woman's arm/wrist/hand
  holding a black modern phone, same vertical angle, seamless white studio backdrop).
- Backdrop keyed out completely via the flood-fill matte (no phone-body protection needed — the display is
  enclosed by the black frame); subject bounding box is computed during keying and used to frame the shot
  (uniform scale, bottom-anchored, horizontally centered on the subject → no stretching, no side clipping).
- New calibration: DEFAULT_SCREEN {x:0.3275, y:0.0900, w:0.3608, h:0.7708}, screen corner radius 0.032,
  notch pill {x:0.4208, y:0.0892, w:0.1933, h:0.0317} redrawn over the footage for realism.
- Verified by testing agent iteration_2: 100% frontend pass (upload, keying, environments, sliders + reset,
  floating view, MP4 export, no console errors).

## Update (2026-06-30, session 3) — hand zoom / pan
- Fixed right-edge clipping: default framing now fits the whole keyed subject (baseFit = min(cw*0.98/bw, ch*1.0/bh)).
- Added user-controllable hand transform (only affects arm/hand/phone, never the environment):
  drag the preview to move, scroll to zoom, plus "Hand size & position" sliders (zoom 0.4–3x, H/V position)
  and a "Reset hand framing" button. Floating-mode drag/wheel behaviour unchanged.
- Handheld motion amplitude slightly increased (drift + breathing + micro-tremor) and remains on by default.
- Testing agent iteration_3: 100% pass; only a cosmetic note that default zoom leaves some background margin.

## Update (2026-06-30, session 4)
- Fixed the leftover white backdrop pocket between thumb and phone: after the border flood fill the matte now
  sweeps enclosed backdrop-coloured islands and removes any component < 2% of the image (the phone display is
  ~27%, so it is preserved). No other pixels touched.
- Added 3 simple, non-distracting environments: Ocean, Green Bokeh, Soft Loft (6 total).
- Testing agent iteration_4: 100% pass. Known cosmetic note: React's passive wheel listener logs a
  preventDefault warning on canvas scroll-zoom (P2: attach a non-passive wheel listener via useEffect).

## Update (2026-06-30, session 5) — TikTok hook + end card
- New `src/overlays.ts`:
  - `drawHookOverlay`: punch-in (easeOutBack) uppercase hook text on dark pills with accent underline,
    visible from frame 0, default copy "I built this so I'd stop journaling in Notes app", duration 0.8-4s.
  - `drawEndCard`: lead-gen CTA (headline + handle chip + pumping arrow) in the last 1-5s, laid out inside
    TikTok's safe area only (side 9%, right icon rail 22%, bottom caption strip 24%). No LinkedIn variant.
- Overlays render in both Hand Holding and Floating views, driven by `video.currentTime` so they bake into the
  MP4 export; windows auto-clamp to 45% of duration on short clips so hook and CTA never overlap.
- Sidebar: "Hook text (first seconds)" and "End card CTA (TikTok)" sections (toggles, copy inputs, duration
  sliders, 4 accent swatches). Anton display font loaded in index.html.
- Testing agent iteration_5: 100% pass (12/12 checks incl. safe-area pixel sampling, punch-in animation,
  all controls, accent swatches, floating regression, short-clip guard).

## Backlog (updated)
- P1: split App.tsx (~1400 lines) into modules; separate hook vs CTA accent colours.
- P2: auto-captions (Whisper), variant batch export, saveable presets, environment-matched screen glow.

## Update (2026-06-30, session 6)
- Environments: removed Ocean, Park and Green Bokeh; added "Bright Bedroom" and "Sunlit Bedroom".
  Final list (5): Living Room, Bedroom, Bright Bedroom, Sunlit Bedroom, Soft Loft.
- Testing agent iteration_6: 100% pass (5 distinct environments, thumbnails load, composite + all controls intact).
