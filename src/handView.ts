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
  "https://images.pexels.com/photos/2207799/pexels-photo-2207799.jpeg?auto=compress&cs=tinysrgb&h=1200&w=800";

export interface ScreenOverride {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_SCREEN: ScreenOverride = {
  x: 0.32,
  y: 0.13,
  w: 0.36,
  h: 0.50,
};

const SCREEN_RADIUS_NORM = 0.008;

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

let processedHandCache: {
  src: HTMLImageElement;
  canvas: HTMLCanvasElement;
  screenKey: string;
} | null = null;

function getProcessedHand(
  img: HTMLImageElement,
  screen: ScreenOverride,
): HTMLCanvasElement | null {
  const sk = `${screen.x}_${screen.y}_${screen.w}_${screen.h}`;
  if (processedHandCache?.src === img && processedHandCache.screenKey === sk) {
    return processedHandCache.canvas;
  }

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w === 0 || h === 0) return null;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const octx = c.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;

  octx.drawImage(img, 0, 0);
  const imageData = octx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Screen rect in pixel coords — make fully transparent so video shows through
  const sL = Math.floor(screen.x * w);
  const sT = Math.floor(screen.y * h);
  const sR = Math.ceil((screen.x + screen.w) * w);
  const sB = Math.ceil((screen.y + screen.h) * h);

  // First pass: classify each pixel
  const alphaMap = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alphaMap[i] = 1.0;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = py * w + px;
      const i = idx * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];

      // Inside phone screen: make fully transparent
      if (px >= sL && px <= sR && py >= sT && py <= sB) {
        alphaMap[idx] = 0;
        continue;
      }

      // Outside screen: remove only white/neutral-gray background pixels.
      // Skin tones have high chroma (R much larger than B) so they're protected.
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      const chroma = mx - mn;
      const luma = r * 0.299 + g * 0.587 + b * 0.114;

      // Pure white/near-white with very low chroma → background
      if (luma > 230 && chroma < 18) {
        alphaMap[idx] = 0;
      } else if (luma > 210 && chroma < 25) {
        // Transition zone — feather based on how white/neutral it is
        const lumaFade = (luma - 210) / 20;
        const chromaFade = 1 - chroma / 25;
        alphaMap[idx] = 1 - lumaFade * chromaFade;
      } else if (luma > 195 && chroma < 15) {
        // Light gray with very low chroma — also likely background shadow edge
        const t = (luma - 195) / 15 * (1 - chroma / 15);
        alphaMap[idx] = 1 - t * 0.7;
      }
    }
  }

  // Alpha erosion: expand transparent areas by 1px to clean hard edges
  const eroded = new Float32Array(alphaMap);
  for (let py = 1; py < h - 1; py++) {
    for (let px = 1; px < w - 1; px++) {
      const idx = py * w + px;
      if (alphaMap[idx] > 0.5) {
        // If any neighbor is fully transparent, soften this pixel
        let hasTransparentNeighbor = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            if (alphaMap[(py + dy) * w + (px + dx)] < 0.05) {
              hasTransparentNeighbor = true;
            }
          }
        }
        if (hasTransparentNeighbor) {
          eroded[idx] = Math.min(eroded[idx], 0.4);
        }
      }
    }
  }

  // Blur alpha for smooth edges (two-pass 3x3 box blur)
  let current = eroded;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(w * h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = py + dy, nx = px + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              sum += current[ny * w + nx];
              count++;
            }
          }
        }
        next[py * w + px] = sum / count;
      }
    }
    current = next;
  }

  // Apply final alpha — use minimum of original classification and blurred
  // to avoid expanding opaque areas into transparent regions
  for (let i = 0; i < w * h; i++) {
    const finalAlpha = Math.min(eroded[i], current[i]);
    d[i * 4 + 3] = Math.round(finalAlpha * 255);
  }

  octx.putImageData(imageData, 0, 0);
  processedHandCache = { src: img, canvas: c, screenKey: sk };
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
    Math.sin(time * 0.7) * cw * 0.003 + Math.sin(time * 1.9) * cw * 0.001;
  const swayY =
    Math.sin(time * 0.9) * ch * 0.004 + Math.sin(time * 2.3) * ch * 0.001;
  const swayRot =
    Math.sin(time * 0.5) * 0.004 + Math.sin(time * 1.4) * 0.002;

  ctx.clearRect(0, 0, cw, ch);

  // --- 1. Environment background (full, slightly dimmed for depth) ---
  if (bgImg) {
    const bgScale = Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight);
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    ctx.save();
    ctx.filter = "brightness(0.8) saturate(0.9)";
    ctx.drawImage(bgImg, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
    ctx.filter = "none";
    ctx.restore();
  } else {
    ctx.fillStyle = "#1a1612";
    ctx.fillRect(0, 0, cw, ch);
  }

  if (!handImg) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading\u2026", cw / 2, ch / 2);
    return;
  }

  const processed = getProcessedHand(handImg, SCREEN);
  if (!processed) return;

  // Scale hand image to fill canvas
  const imgAspect = processed.width / processed.height;
  const drawH = ch * 1.02;
  const drawW = drawH * imgAspect;
  const handX = (cw - drawW) / 2;
  const handY = (ch - drawH) / 2;

  // Screen rect in canvas coordinates
  const sx = handX + SCREEN.x * drawW;
  const sy = handY + SCREEN.y * drawH;
  const sw = SCREEN.w * drawW;
  const sh = SCREEN.h * drawH;
  const sr = SCREEN_RADIUS_NORM * drawW;

  // Apply sway
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Video behind hand, clipped to phone screen ---
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

  // --- 3. Processed hand on top (white bg removed, screen transparent) ---
  ctx.drawImage(processed, handX, handY, drawW, drawH);

  ctx.restore(); // sway
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
