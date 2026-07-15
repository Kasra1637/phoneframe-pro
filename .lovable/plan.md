# Plan: Movable hand+phone layer over environment backgrounds

## Goal
Turn the hand+phone into a single composited layer the user can drag and zoom, while the environment behind it stays fixed. Replace the busy coffee shop scene with a quieter one that has no people.

## Approach

Today the hand photo is a single flat image drawn cover-fit; the phone is painted on top of the blank phone region inside it. That means moving the "hand" also moves the environment. To fix this, we split the composition into two layers:

1. Environment layer — a fixed photo of a room/outdoor scene, no hand, no phone. Drawn cover-fit, no shake.
2. Hand+phone layer — a transparent-background PNG of just the hand holding a blank phone. Drawn on top, with translation + scale controlled by the user, plus the existing subtle handheld shake. The phone mockup is drawn over the blank phone rect of this layer, so it scales and moves with the hand.

## Assets

Generate via imagegen:
- `hand-only.png` — transparent background, same hand+blank-phone pose used today, so the phone rect stays calibrated.
- `env-park.jpg` — sunny park, no people, no hand.
- `env-livingroom.jpg` — cozy living room, no people, no hand.
- `env-desk.jpg` — new calmer scene replacing the coffee shop: a clean wooden desk with a plant and soft window light, no people, minimal props.

Delete `hand-hold-cafe.jpg`. Keep `hand-hold-park.jpg` / `hand-hold-livingroom.jpg` only long enough to switch imports, then delete.

## UI changes (`src/routes/index.tsx`)

- Background options for hand scenes become: "Hand — Park", "Hand — Living room", "Hand — Desk". Solid/gradient options unchanged.
- When any `hand_*` background is active, show two new sliders in the controls panel:
  - Hand position — one control for X, one for Y (percent of canvas, default 0).
  - Hand zoom — 0.5x to 1.5x, default 1.0.
- Also enable click-and-drag on the preview canvas to reposition the hand layer directly (updates the same X/Y state). Wheel/pinch on the canvas adjusts zoom when a hand background is active.
- Reset button to snap hand back to default position/zoom.

## Render loop

When `bg` starts with `hand_`:
1. Draw the selected environment image cover-fit to the canvas (no shake, no transform).
2. Compute the hand layer's base rect (cover-fit of the hand PNG, matching the current calibration).
3. Apply user translate (handOffsetX, handOffsetY) and scale (handZoom) around the hand layer's center, plus the existing subtle shake transform.
4. Draw the hand PNG.
5. Draw the phone mockup over `HAND_PHONE_RECT` inside the transformed hand rect, so the video/phone tracks the hand exactly.

Export path uses the same draw function, so recordings capture the moved/zoomed composition.

## State additions

- `handOffsetX`, `handOffsetY` (numbers, -1..1 fraction of canvas)
- `handZoom` (number, 0.5..1.5)
- Pointer handlers on the preview canvas for drag; wheel handler for zoom.

## Out of scope

- No changes to phone device list, presets, export formats, or audio pipeline.
- Non-hand backgrounds behave exactly as they do today.
