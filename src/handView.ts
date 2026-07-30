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

let processedCache: {
  src: HTMLImageElement;
  key: string;
  canvas: HTMLCanvasElement;
} | null = null;

function screenKey(s: ScreenOverride): string {
  return `${s.x.toFixed(3)}_${s.y.toFixed(3)}_${s.w.toFixed(3)}_${s.h.toFixed(3)}`;
}

function removeWhiteBackground(
  img: HTMLImageElement,
  screen: ScreenOverride,
): HTMLCanvasElement | null {
  const sk = screenKey(screen);
  if (processedCache && processedCache.src === img && processedCache.key === sk)
    return processedCache.canvas;

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

  // Screen bounding box in pixels (inset slightly to avoid bezel)
  const scrL = Math.floor((screen.x + screen.w * 0.03) * w);
  const scrT = Math.floor((screen.y + screen.h * 0.02) * h);
  const scrR = Math.ceil((screen.x + screen.w * 0.97) * w);
  const scrB = Math.ceil((screen.y + screen.h * 0.98) * h);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = (py * w + px) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      const chroma = mx - mn;

      const inScreen = px >= scrL && px <= scrR && py >= scrT && py <= scrB;

      if (inScreen) {
        // Inside the phone screen: remove everything (white screen area)
        // so the video behind shows through. Keep only very dark pixels
        // (e.g. UI elements already on the screen in the photo).
        if (mn > 100) {
          const t = Math.min(1, (mn - 100) / 60);
          d[i + 3] = Math.round(d[i + 3] * (1 - t));
        }
      } else {
        // Outside screen: remove only white/near-white neutral pixels.
        // Skin has high chroma (R >> B), so chroma check protects it.
        if (mn > 225 && chroma < 20) {
          d[i + 3] = 0;
        } else if (mn > 195 && chroma < 30) {
          const t = Math.min(1, (mn - 195) / 30 * (1 - chroma / 30));
          d[i + 3] = Math.round(d[i + 3] * (1 - t));
        }
      }
    }
  }

  // Alpha blur pass (3x3 box) to smooth harsh edges
  const alpha = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) alpha[j] = d[j * 4 + 3];
  const blurred = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = py + dy, nx = px + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            sum += alpha[ny * w + nx];
            count++;
          }
        }
      }
      blurred[py * w + px] = sum / count;
    }
  }
  // Second pass for smoother result
  const blurred2 = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = py + dy, nx = px + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            sum += blurred[ny * w + nx];
            count++;
          }
        }
      }
      blurred2[py * w + px] = sum / count;
    }
  }
  for (let j = 0; j < w * h; j++) {
    d[j * 4 + 3] = Math.round(Math.min(alpha[j], blurred2[j]));
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

  const swayX =
    Math.sin(time * 0.7) * cw * 0.003 + Math.sin(time * 1.9) * cw * 0.001;
  const swayY =
    Math.sin(time * 0.9) * ch * 0.004 + Math.sin(time * 2.3) * ch * 0.001;
  const swayRot =
    Math.sin(time * 0.5) * 0.004 + Math.sin(time * 1.4) * 0.002;

  // --- 1. Environment background (clean, lightly blurred for depth) ---
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

  const processed = removeWhiteBackground(handImg, SCREEN);
  if (!processed) return;

  const imgAspect = processed.width / processed.height;
  const drawH = ch * 1.02;
  const drawW = drawH * imgAspect;
  const handX = (cw - drawW) / 2;
  const handY = (ch - drawH) / 2;

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

  // --- 2. Draw video BEHIND the hand, clipped to phone screen ---
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

  // --- 3. Hand on top (background fully removed, screen transparent) ---
  ctx.drawImage(processed, handX, handY, drawW, drawH);

  // --- Glass reflection ---
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

  // --- Vignette ---
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
