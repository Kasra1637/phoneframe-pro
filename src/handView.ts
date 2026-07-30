export type EnvironmentId = "living_room" | "bedroom" | "park";

export interface EnvironmentOption {
  id: EnvironmentId;
  label: string;
  url: string;
}

export const ENVIRONMENTS: EnvironmentOption[] = [
  {
    id: "living_room",
    label: "Living Room",
    url: "https://images.pexels.com/photos/19473771/pexels-photo-19473771.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800",
  },
  {
    id: "bedroom",
    label: "Bedroom",
    url: "https://images.pexels.com/photos/5948744/pexels-photo-5948744.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800",
  },
  {
    id: "park",
    label: "Park",
    url: "https://images.pexels.com/photos/13074577/pexels-photo-13074577.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800",
  },
];

// Pexels 2207799 by Gije Cho — light-skinned hand holding smartphone,
// blank screen, white background, hand from bottom-right.
const HAND_IMAGE_URL =
  "https://images.pexels.com/photos/2207799/pexels-photo-2207799.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800";

export interface ScreenOverride {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Phone screen region (normalized 0..1) for photo 2207799.
// This is an older iPhone with bezels and a home button.
// The screen sits inside the phone body, offset by bezels on all sides.
const DEFAULT_SCREEN: ScreenOverride = {
  x: 0.30,
  y: 0.12,
  w: 0.40,
  h: 0.52,
};

const SCREEN_RADIUS_NORM = 0.012;

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (!cached) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    imageCache.set(url, img);
  }
  return null;
}

export function preloadHandViewImages() {
  loadImage(HAND_IMAGE_URL);
  for (const env of ENVIRONMENTS) loadImage(env.url);
}

export function drawHandView(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  video: HTMLVideoElement,
  envId: EnvironmentId,
  time: number,
  videoFit: "cover" | "contain" | "fill",
  videoScale: number,
  videoOffsetX: number,
  videoOffsetY: number,
  screenOverride?: ScreenOverride,
) {
  const SCREEN = screenOverride ?? DEFAULT_SCREEN;
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[0];
  const bgImg = loadImage(env.url);
  const handImg = loadImage(HAND_IMAGE_URL);

  // Subtle sway animation
  const swayX =
    Math.sin(time * 0.7) * cw * 0.003 + Math.sin(time * 1.9) * cw * 0.001;
  const swayY =
    Math.sin(time * 0.9) * ch * 0.004 + Math.sin(time * 2.3) * ch * 0.001;
  const swayRot =
    Math.sin(time * 0.5) * 0.004 + Math.sin(time * 1.4) * 0.002;

  // --- 1. Environment background ---
  ctx.save();
  if (bgImg) {
    const bgScale =
      Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight) * 1.08;
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    ctx.filter = "blur(4px) brightness(0.75) saturate(0.95)";
    ctx.drawImage(bgImg, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
    ctx.filter = "none";
  } else {
    const g = ctx.createRadialGradient(
      cw * 0.5, ch * 0.4, 0,
      cw * 0.5, ch * 0.5, cw * 0.7,
    );
    g.addColorStop(0, "#1a1612");
    g.addColorStop(1, "#0c0a08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.restore();

  if (!handImg) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading hand mockup\u2026", cw / 2, ch / 2);
    return;
  }

  // Scale hand image to fill the canvas
  const imgAspect = handImg.naturalWidth / handImg.naturalHeight;
  const drawH = ch * 1.02;
  const drawW = drawH * imgAspect;
  const handX = (cw - drawW) / 2;
  const handY = (ch - drawH) / 2;

  // Phone screen rect in canvas coordinates
  const sx = handX + SCREEN.x * drawW;
  const sy = handY + SCREEN.y * drawH;
  const sw = SCREEN.w * drawW;
  const sh = SCREEN.h * drawH;
  const sr = SCREEN_RADIUS_NORM * drawW;

  // --- Apply sway ---
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Draw the hand photo directly (NO pixel manipulation) ---
  // Use a radial gradient mask to fade the photo's white edges
  // into the dark environment background.
  ctx.save();

  // Create an offscreen canvas to apply the edge fade
  const offscreen = document.createElement("canvas");
  offscreen.width = cw;
  offscreen.height = ch;
  const offCtx = offscreen.getContext("2d");
  if (offCtx) {
    // Draw hand onto offscreen
    offCtx.drawImage(handImg, handX, handY, drawW, drawH);

    // Apply a radial gradient mask to fade edges
    offCtx.globalCompositeOperation = "destination-in";
    const mask = offCtx.createRadialGradient(
      cw / 2, ch * 0.45, Math.min(cw, ch) * 0.2,
      cw / 2, ch * 0.45, Math.min(cw, ch) * 0.55,
    );
    mask.addColorStop(0, "rgba(0,0,0,1)");
    mask.addColorStop(0.7, "rgba(0,0,0,1)");
    mask.addColorStop(0.9, "rgba(0,0,0,0.5)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    offCtx.fillStyle = mask;
    offCtx.fillRect(0, 0, cw, ch);

    // Draw the masked hand onto main canvas
    ctx.drawImage(offscreen, 0, 0);
  } else {
    // Fallback: draw directly without mask
    ctx.drawImage(handImg, handX, handY, drawW, drawH);
  }
  ctx.restore();

  // --- 3. Draw video ON TOP, clipped to the phone screen area ---
  if (video.readyState >= 2) {
    ctx.save();
    roundedRect(ctx, sx, sy, sw, sh, sr);
    ctx.clip();

    // Black fill behind video
    ctx.fillStyle = "#000";
    ctx.fillRect(sx, sy, sw, sh);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let base: number;
    if (videoFit === "contain") base = Math.min(sw / vw, sh / vh);
    else if (videoFit === "fill") base = 1;
    else base = Math.max(sw / vw, sh / vh);
    const s = base * videoScale;
    const dw = videoFit === "fill" ? sw : vw * s;
    const dh = videoFit === "fill" ? sh : vh * s;
    const maxOx = Math.max(0, (dw - sw) / 2);
    const maxOy = Math.max(0, (dh - sh) / 2);
    const ox = (videoOffsetX / 100) * maxOx;
    const oy = (videoOffsetY / 100) * maxOy;
    ctx.drawImage(
      video,
      sx + (sw - dw) / 2 + ox,
      sy + (sh - dh) / 2 + oy,
      dw,
      dh,
    );
    ctx.restore();
  }

  // --- Glass reflection on screen ---
  ctx.save();
  roundedRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  const sheen = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.015)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();

  ctx.restore(); // sway

  // --- 4. Vignette ---
  ctx.save();
  const vig = ctx.createRadialGradient(
    cw / 2, ch / 2, Math.min(cw, ch) * 0.35,
    cw / 2, ch / 2, Math.max(cw, ch) * 0.7,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.7, "rgba(0,0,0,0)");
  vig.addColorStop(0.9, "rgba(0,0,0,0.15)");
  vig.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
