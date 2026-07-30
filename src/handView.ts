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

// Measured directly from the stock photo's black screen area (normalized).
export const DEFAULT_SCREEN: ScreenOverride = {
  x: 0.3625,
  y: 0.239,
  w: 0.3538,
  h: 0.4667,
};

const SCREEN_RADIUS_NORM = 0.006;

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

let keyedHandCache: { src: HTMLImageElement; canvas: HTMLCanvasElement } | null = null;

/**
 * Removes only the seamless studio backdrop using a border flood fill with a tight
 * local tolerance. Hand, phone body and screen pixels are never touched, so the
 * photo itself stays completely undistorted.
 */
function getKeyedHand(img: HTMLImageElement): HTMLCanvasElement | null {
  if (keyedHandCache?.src === img) return keyedHandCache.canvas;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const octx = c.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;
  octx.drawImage(img, 0, 0);

  const imageData = octx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const n = w * h;

  // Phone body silhouette (normalized, measured from the photo) is never keyed out —
  // its white front panel would otherwise be mistaken for the studio backdrop.
  const bodyL = 0.335 * w, bodyR = 0.755 * w;
  const bodyT = 0.1594 * h, bodyB = 0.7835 * h;
  const bodyR2 = 0.055 * w;
  const insideBody = (x: number, y: number) => {
    if (x < bodyL || x > bodyR || y < bodyT || y > bodyB) return false;
    const cx = x < bodyL + bodyR2 ? bodyL + bodyR2 : x > bodyR - bodyR2 ? bodyR - bodyR2 : x;
    const cy = y < bodyT + bodyR2 ? bodyT + bodyR2 : y > bodyB - bodyR2 ? bodyB - bodyR2 : y;
    if (cx === x || cy === y) return true;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= bodyR2 * bodyR2;
  };

  const luma = new Float32Array(n);
  const candidate = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      luma[i] = l;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      candidate[i] = l > 170 && chroma < 20 && !insideBody(x, y) ? 1 : 0;
    }
  }

  const filled = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (idx: number) => {
    if (candidate[idx] && !filled[idx]) {
      filled[idx] = 1;
      stack[sp++] = idx;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const y = (idx / w) | 0;
    const x = idx - y * w;
    const l = luma[idx];
    const tryNeighbor = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = ny * w + nx;
      if (!candidate[ni] || filled[ni]) return;
      if (Math.abs(luma[ni] - l) > 5) return;
      filled[ni] = 1;
      stack[sp++] = ni;
    };
    tryNeighbor(x + 1, y);
    tryNeighbor(x - 1, y);
    tryNeighbor(x, y + 1);
    tryNeighbor(x, y - 1);
  }

  // Close tiny holes (specular highlights on skin/nails caught by the fill).
  for (let pass = 0; pass < 2; pass++) {
    const snapshot = filled.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (!snapshot[idx]) continue;
        let open = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            if (!snapshot[(y + dy) * w + (x + dx)]) open++;
          }
        }
        if (open >= 6) filled[idx] = 0;
      }
    }
  }

  // 1px feather so edges don't alias against the environment.
  let alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = filled[i] ? 0 : 1;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            sum += alpha[ny * w + nx];
            count++;
          }
        }
        next[y * w + x] = sum / count;
      }
    }
    alpha = next;
  }

  for (let i = 0; i < n; i++) d[i * 4 + 3] = Math.round(Math.min(1, alpha[i]) * 255);

  octx.putImageData(imageData, 0, 0);
  keyedHandCache = { src: img, canvas: c };
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

  ctx.clearRect(0, 0, cw, ch);

  // --- 1. Environment background, drawn once at native aspect (no stretching) ---
  if (bgImg) {
    const bgScale = Math.max(cw / bgImg.naturalWidth, ch / bgImg.naturalHeight);
    const bw = bgImg.naturalWidth * bgScale;
    const bh = bgImg.naturalHeight * bgScale;
    ctx.save();
    ctx.filter = "brightness(0.86) blur(6px)";
    ctx.drawImage(bgImg, (cw - bw) / 2, (ch - bh) / 2, bw, bh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#15130f";
    ctx.fillRect(0, 0, cw, ch);
  }

  if (!handImg) {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading\u2026", cw / 2, ch / 2);
    return;
  }

  const hand = getKeyedHand(handImg);
  if (!hand) return;

  // Uniform cover fit — aspect ratio preserved, never stretched.
  const handAspect = hand.width / hand.height;
  const fit = Math.max(cw / hand.width, ch / hand.height);
  const drawH = hand.height * fit;
  const drawW = drawH * handAspect;
  const handX = (cw - drawW) / 2;
  const handY = (ch - drawH) / 2;

  // --- Natural handheld motion: slow drift + breathing + micro tremor ---
  const driftX =
    Math.sin(time * 0.53) * 1 + Math.sin(time * 0.31 + 1.3) * 0.55 +
    Math.sin(time * 3.1) * 0.10 + Math.sin(time * 5.7 + 0.7) * 0.05;
  const driftY =
    Math.sin(time * 0.47 + 0.6) * 1 + Math.sin(time * 0.24 + 2.1) * 0.6 +
    Math.sin(time * 2.7 + 1.1) * 0.10 + Math.sin(time * 6.3) * 0.05;
  const rot =
    Math.sin(time * 0.41) * 0.0055 + Math.sin(time * 0.27 + 2.0) * 0.003 +
    Math.sin(time * 4.3 + 0.4) * 0.0004;
  const breathe = 1 + Math.sin(time * 0.37) * 0.004;

  const offX = driftX * cw * 0.006;
  const offY = driftY * ch * 0.005;

  ctx.save();
  ctx.translate(cw / 2 + offX, ch / 2 + offY);
  ctx.rotate(rot);
  ctx.scale(breathe, breathe);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Untouched stock photo (only backdrop keyed out) ---
  ctx.drawImage(hand, handX, handY, drawW, drawH);

  // --- 3. Uploaded video, clipped to the photo's real screen area ---
  const sx = handX + SCREEN.x * drawW;
  const sy = handY + SCREEN.y * drawH;
  const sw = SCREEN.w * drawW;
  const sh = SCREEN.h * drawH;
  const sr = SCREEN_RADIUS_NORM * drawW;

  if (video.readyState >= 2 && video.videoWidth > 0) {
    ctx.save();
    roundedRect(ctx, sx, sy, sw, sh, sr);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(sx, sy, sw, sh);

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let base: number;
    if (videoFit === "contain") base = Math.min(sw / vw, sh / vh);
    else base = Math.max(sw / vw, sh / vh);

    let dw: number;
    let dh: number;
    if (videoFit === "fill") {
      // Only "fill" intentionally stretches; keep it exact to the screen box.
      dw = sw;
      dh = sh;
    } else {
      const s = base * videoScale;
      dw = vw * s;
      dh = vh * s;
    }
    const maxOx = Math.max(0, (dw - sw) / 2);
    const maxOy = Math.max(0, (dh - sh) / 2);
    const ox = (videoOffsetX / 100) * maxOx;
    const oy = (videoOffsetY / 100) * maxOy;
    ctx.drawImage(video, sx + (sw - dw) / 2 + ox, sy + (sh - dh) / 2 + oy, dw, dh);

    // Soft screen glass sheen, kept very light so colors stay true.
    const sheen = ctx.createLinearGradient(sx, sy, sx + sw * 0.7, sy + sh * 0.7);
    sheen.addColorStop(0, "rgba(255,255,255,0.05)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
  }

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
