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

// Clean hand-only photo: woman's hand holding phone with blank screen, white bg
// Pexels 6203792 by Hanna Pad — 2919x4378, just hand/wrist/phone, no body
const HAND_IMAGE_URL =
  "https://images.pexels.com/photos/6203792/pexels-photo-6203792.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800";

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

const DEFAULT_SCREEN = {
  x: 0.28,
  y: 0.08,
  w: 0.46,
  h: 0.52,
};

const SCREEN_RADIUS = 0.03;

export interface ScreenOverride {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Offscreen canvas for background-removed hand
let processedCache: { src: HTMLImageElement; canvas: HTMLCanvasElement } | null =
  null;

function getProcessedHand(img: HTMLImageElement): HTMLCanvasElement | null {
  if (processedCache && processedCache.src === img) return processedCache.canvas;

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

  // Remove white / near-white background
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);

    if (luma > 230 && sat < 30) {
      d[i + 3] = 0;
    } else if (luma > 200 && sat < 40) {
      const t = (luma - 200) / 30;
      d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - t));
    }
  }

  // Feather all four edges for a natural blend
  const fadeEdge = (
    startFn: (i: number) => number,
    endFn: (i: number) => number,
    iterOuter: number,
    iterInner: number,
    idxFn: (outer: number, inner: number) => number,
  ) => {
    for (let outer = 0; outer < iterOuter; outer++) {
      const s = startFn(outer);
      const e = endFn(outer);
      for (let inner = s; inner < e; inner++) {
        const t = (inner - s) / (e - s);
        const alpha = t * t;
        const idx = idxFn(outer, inner) * 4;
        d[idx + 3] = Math.round(d[idx + 3] * alpha);
      }
    }
  };

  const edgePct = 0.08;
  // Top
  const topEnd = Math.floor(h * edgePct);
  for (let y = 0; y < topEnd; y++) {
    const a = (y / topEnd) ** 2;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * a);
    }
  }
  // Bottom
  const botStart = Math.floor(h * (1 - edgePct));
  for (let y = botStart; y < h; y++) {
    const a = ((h - y) / (h - botStart)) ** 2;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * a);
    }
  }
  // Left
  const leftEnd = Math.floor(w * edgePct);
  for (let x = 0; x < leftEnd; x++) {
    const a = (x / leftEnd) ** 2;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * a);
    }
  }
  // Right
  const rightStart = Math.floor(w * (1 - edgePct));
  for (let x = rightStart; x < w; x++) {
    const a = ((w - x) / (w - rightStart)) ** 2;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      d[idx + 3] = Math.round(d[idx + 3] * a);
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
  screenOverride?: ScreenOverride,
) {
  const SCREEN = screenOverride ?? DEFAULT_SCREEN;
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[0];
  const bgImg = loadImage(env.url);
  const handImg = loadImage(HAND_IMAGE_URL);

  const swayX =
    Math.sin(time * 0.7) * cw * 0.004 + Math.sin(time * 1.9) * cw * 0.002;
  const swayY =
    Math.sin(time * 0.9) * ch * 0.005 + Math.sin(time * 2.3) * ch * 0.0015;
  const swayRot =
    Math.sin(time * 0.5) * 0.006 + Math.sin(time * 1.4) * 0.003;

  // --- 1. Environment background ---
  ctx.save();
  if (bgImg) {
    const bgScale =
      Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight) * 1.15;
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    ctx.filter = "blur(18px) brightness(0.55) saturate(0.85)";
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

  // Warm overlay
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
    ctx.fillText("Loading hand mockup\u2026", cw / 2, ch / 2);
    return;
  }

  const processed = getProcessedHand(handImg);
  if (!processed) return;

  // --- Scale hand image to fill canvas height ---
  const imgAspect = processed.width / processed.height;
  const drawH = ch * 1.05;
  const drawW = drawH * imgAspect;
  const handX = (cw - drawW) / 2;
  const handY = (ch - drawH) / 2 + ch * 0.02;

  // Phone screen rect in canvas space
  const sx = handX + SCREEN.x * drawW;
  const sy = handY + SCREEN.y * drawH;
  const sw = SCREEN.w * drawW;
  const sh = SCREEN.h * drawH;
  const sr = SCREEN_RADIUS * drawW;

  // --- Sway transform ---
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Draw video into phone screen ---
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
    ctx.drawImage(video, sx + (sw - dw) / 2 + ox, sy + (sh - dh) / 2 + oy, dw, dh);
    ctx.restore();
  }

  // --- 3. Hand image (bg removed) on top ---
  ctx.drawImage(processed, handX, handY, drawW, drawH);

  // --- Glass reflection ---
  ctx.save();
  roundedRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  const sheen = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();

  ctx.restore(); // sway

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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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
