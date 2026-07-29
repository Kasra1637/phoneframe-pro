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

// Pexels 2207799 by Gije Cho — light-skinned hand holding a smartphone
// with blank screen against a white background, hand from bottom-right.
const HAND_IMAGE_URL =
  "https://images.pexels.com/photos/2207799/pexels-photo-2207799.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800";

export interface ScreenOverride {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Phone screen region (normalized 0..1) for 2207799.
// The phone is held from the right side; screen is roughly centered
// horizontally and takes up most of the upper portion of the image.
const DEFAULT_SCREEN: ScreenOverride = {
  x: 0.22,
  y: 0.06,
  w: 0.42,
  h: 0.58,
};

const SCREEN_RADIUS_NORM = 0.03;

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

// Cache keyed by image + screen region so sliders invalidate properly
let processedCache: {
  src: HTMLImageElement;
  key: string;
  canvas: HTMLCanvasElement;
} | null = null;

function screenKey(s: ScreenOverride): string {
  return `${s.x.toFixed(3)}_${s.y.toFixed(3)}_${s.w.toFixed(3)}_${s.h.toFixed(3)}`;
}

function getProcessedHand(
  img: HTMLImageElement,
  screen: ScreenOverride,
): HTMLCanvasElement | null {
  const sk = screenKey(screen);
  if (processedCache && processedCache.src === img && processedCache.key === sk) {
    return processedCache.canvas;
  }

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const octx = c.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;

  octx.drawImage(img, 0, 0);

  const id = octx.getImageData(0, 0, w, h);
  const d = id.data;

  // Screen bounding box in pixels
  const scrL = Math.floor(screen.x * w);
  const scrT = Math.floor(screen.y * h);
  const scrR = Math.ceil((screen.x + screen.w) * w);
  const scrB = Math.ceil((screen.y + screen.h) * h);

  // Shrink screen rect slightly so we don't eat into the bezel
  const insetX = Math.round((scrR - scrL) * 0.04);
  const insetY = Math.round((scrB - scrT) * 0.02);
  const iL = scrL + insetX;
  const iR = scrR - insetX;
  const iT = scrT + insetY;
  const iB = scrB - insetY;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);

      const inScreen = px >= iL && px <= iR && py >= iT && py <= iB;

      if (inScreen) {
        // Punch out the screen area — remove white/light pixels
        if (luma > 120 && sat < 70) {
          d[i + 3] = 0;
        } else if (luma > 80) {
          const t = Math.min(1, Math.max(0, (luma - 80) / 40));
          d[i + 3] = Math.round(d[i + 3] * (1 - t));
        }
      } else {
        // Outside screen: remove white/light-gray background
        // Use gentler thresholds to preserve skin tones
        if (luma > 235 && sat < 25) {
          d[i + 3] = 0;
        } else if (luma > 210 && sat < 35) {
          const t = (luma - 210) / 25;
          d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - t));
        }
      }
    }
  }

  // Gentle edge feathering — only on outer edges, not aggressive
  const ePct = 0.04;
  const topEnd = Math.floor(h * ePct);
  for (let y = 0; y < topEnd; y++) {
    const a = y / topEnd;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  const botStart = Math.floor(h * (1 - ePct));
  for (let y = botStart; y < h; y++) {
    const a = (h - y) / (h - botStart);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  const leftEnd = Math.floor(w * ePct);
  for (let x = 0; x < leftEnd; x++) {
    const a = x / leftEnd;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  const rightStart = Math.floor(w * (1 - ePct));
  for (let x = rightStart; x < w; x++) {
    const a = (w - x) / (w - rightStart);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }

  octx.putImageData(id, 0, 0);
  processedCache = { src: img, key: sk, canvas: c };
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
  screenOverride?: ScreenOverride,
) {
  const SCREEN = screenOverride ?? DEFAULT_SCREEN;
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[0];
  const bgImg = loadImage(env.url);
  const handImg = loadImage(HAND_IMAGE_URL);

  // Subtle sway
  const swayX =
    Math.sin(time * 0.7) * cw * 0.003 + Math.sin(time * 1.9) * cw * 0.001;
  const swayY =
    Math.sin(time * 0.9) * ch * 0.004 + Math.sin(time * 2.3) * ch * 0.001;
  const swayRot =
    Math.sin(time * 0.5) * 0.004 + Math.sin(time * 1.4) * 0.002;

  // --- 1. Environment background (clear, not heavily blurred) ---
  ctx.save();
  if (bgImg) {
    const bgScale =
      Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight) * 1.08;
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    // Light blur for depth-of-field feel, not a smudgy mess
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

  // Very subtle warm overlay (barely visible)
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!handImg) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading hand mockup\u2026", cw / 2, ch / 2);
    return;
  }

  const processed = getProcessedHand(handImg, SCREEN);
  if (!processed) return;

  // Scale hand to fill canvas height
  const imgAspect = processed.width / processed.height;
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

  // --- Apply sway transform ---
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Draw video into phone screen (BEHIND the hand layer) ---
  if (video.readyState >= 2) {
    ctx.save();
    roundedRect(ctx, sx, sy, sw, sh, sr);
    ctx.clip();

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

  // --- 3. Hand image ON TOP (bg + screen punched out, video shows through) ---
  ctx.drawImage(processed, handX, handY, drawW, drawH);

  // --- Glass reflection on screen ---
  ctx.save();
  roundedRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  const sheen = ctx.createLinearGradient(
    sx, sy,
    sx + sw * 0.6, sy + sh * 0.6,
  );
  sheen.addColorStop(0, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.015)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();

  ctx.restore(); // sway

  // --- 4. Subtle vignette ---
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
