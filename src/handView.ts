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

const HAND_IMAGE_URL =
  "https://images.pexels.com/photos/6203551/pexels-photo-6203551.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800";

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

// Source crop region in the original image (normalized 0..1).
// Crops to just the hand/wrist/phone area, excluding shoulder and body.
const SRC_CROP = {
  x: 0.18,
  y: 0.0,
  w: 0.82,
  h: 0.58,
};

// Screen region relative to the CROPPED image (normalized 0..1).
// Recalculated after crop so video composites into the phone screen.
const SCREEN_REGION = {
  x: 0.20,
  y: 0.22,
  w: 0.50,
  h: 0.58,
  radius: 0.025,
};

// Offscreen canvas cache for background-removed hand image
let processedCache: { src: HTMLImageElement; canvas: HTMLCanvasElement } | null = null;

function getProcessedHand(img: HTMLImageElement): HTMLCanvasElement | null {
  if (processedCache && processedCache.src === img) return processedCache.canvas;

  const sw = Math.round(img.naturalWidth * SRC_CROP.w);
  const sh = Math.round(img.naturalHeight * SRC_CROP.h);
  const sx = Math.round(img.naturalWidth * SRC_CROP.x);
  const sy = Math.round(img.naturalHeight * SRC_CROP.y);

  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  const octx = c.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;

  octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // Remove white/bright background pixels
  const id = octx.getImageData(0, 0, sw, sh);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness > 215 && saturation < 35) {
      d[i + 3] = 0;
    } else if (brightness > 185 && saturation < 45) {
      const t = (brightness - 185) / 30;
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }

  // Feather bottom edge so it fades out naturally
  const fadeStart = sh * 0.75;
  const fadeEnd = sh;
  for (let y = Math.floor(fadeStart); y < fadeEnd; y++) {
    const t = (y - fadeStart) / (fadeEnd - fadeStart);
    const alpha = 1 - t * t;
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * alpha);
    }
  }

  // Feather left edge
  const fadeLeftEnd = sw * 0.12;
  for (let x = 0; x < fadeLeftEnd; x++) {
    const t = x / fadeLeftEnd;
    const alpha = t * t;
    for (let y = 0; y < sh; y++) {
      const idx = (y * sw + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * alpha);
    }
  }

  octx.putImageData(id, 0, 0);

  processedCache = { src: img, canvas: c };
  return c;
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
) {
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[0];
  const bgImg = loadImage(env.url);
  const handImg = loadImage(HAND_IMAGE_URL);

  const swayX = Math.sin(time * 0.7) * cw * 0.004 + Math.sin(time * 1.9) * cw * 0.002;
  const swayY = Math.sin(time * 0.9) * ch * 0.005 + Math.sin(time * 2.3) * ch * 0.0015;
  const swayRot = Math.sin(time * 0.5) * 0.006 + Math.sin(time * 1.4) * 0.003;

  // --- 1. Draw environment background (blurred) ---
  ctx.save();
  if (bgImg) {
    const bgScale = Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight) * 1.15;
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    const bx = (cw - bw) / 2;
    const by = (ch - bh) / 2;
    ctx.filter = "blur(18px) brightness(0.55) saturate(0.85)";
    ctx.drawImage(bgImg, bx, by, bw, bh);
    ctx.filter = "none";
  } else {
    const fallback = ctx.createRadialGradient(cw * 0.5, ch * 0.4, 0, cw * 0.5, ch * 0.5, cw * 0.7);
    fallback.addColorStop(0, "#1a1612");
    fallback.addColorStop(1, "#0c0a08");
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!handImg) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading hand mockup...", cw / 2, ch / 2);
    return;
  }

  const processed = getProcessedHand(handImg);
  if (!processed) return;

  // Scale cropped hand image to fit the canvas
  const cropAspect = processed.width / processed.height;
  const targetH = ch * 1.1;
  const targetW = targetH * cropAspect;
  const handX = (cw - targetW) / 2 + cw * 0.05;
  const handY = ch - targetH + ch * 0.08;

  // Screen rect in canvas coordinates (relative to cropped image)
  const screenX = handX + SCREEN_REGION.x * targetW;
  const screenY = handY + SCREEN_REGION.y * targetH;
  const screenW = SCREEN_REGION.w * targetW;
  const screenH = SCREEN_REGION.h * targetH;
  const screenR = SCREEN_REGION.radius * targetW;

  // --- Apply sway ---
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Draw video in phone screen area ---
  if (video.readyState >= 2) {
    ctx.save();
    roundedRect(ctx, screenX, screenY, screenW, screenH, screenR);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(screenX, screenY, screenW, screenH);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let baseScale: number;
    if (videoFit === "contain") baseScale = Math.min(screenW / vw, screenH / vh);
    else if (videoFit === "fill") baseScale = 1;
    else baseScale = Math.max(screenW / vw, screenH / vh);
    const s = baseScale * videoScale;
    const dw = videoFit === "fill" ? screenW : vw * s;
    const dh = videoFit === "fill" ? screenH : vh * s;
    const maxOffX = Math.max(0, (dw - screenW) / 2);
    const maxOffY = Math.max(0, (dh - screenH) / 2);
    const offX = (videoOffsetX / 100) * maxOffX;
    const offY = (videoOffsetY / 100) * maxOffY;
    const dx = screenX + (screenW - dw) / 2 + offX;
    const dy = screenY + (screenH - dh) / 2 + offY;
    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.restore();
  }

  // --- 3. Draw processed hand (white bg removed, cropped) on top ---
  ctx.drawImage(processed, handX, handY, targetW, targetH);

  // --- Glass reflection ---
  ctx.save();
  roundedRect(ctx, screenX, screenY, screenW, screenH, screenR);
  ctx.clip();
  const sheen = ctx.createLinearGradient(screenX, screenY, screenX + screenW * 0.6, screenY + screenH * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(screenX, screenY, screenW, screenH);
  ctx.restore();

  ctx.restore();

  // --- 4. Vignette ---
  ctx.save();
  const vig = ctx.createRadialGradient(
    cw / 2, ch / 2, Math.min(cw, ch) * 0.3,
    cw / 2, ch / 2, Math.max(cw, ch) * 0.7,
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0)");
  vig.addColorStop(0.85, "rgba(0,0,0,0.3)");
  vig.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
