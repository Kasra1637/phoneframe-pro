export type EnvironmentId =
  | "living_room"
  | "bedroom"
  | "park"
  | "ocean"
  | "park_bokeh"
  | "loft";

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
  {
    id: "ocean",
    label: "Ocean",
    url: "https://images.unsplash.com/photo-1616159988985-750036b28b40?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800&h=1200&fit=crop",
  },
  {
    id: "park_bokeh",
    label: "Green Bokeh",
    url: "https://images.unsplash.com/photo-1654638748957-20048f8426ac?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800&h=1200&fit=crop",
  },
  {
    id: "loft",
    label: "Soft Loft",
    url: "https://images.unsplash.com/photo-1767720580810-58be50f89bf8?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=800&h=1200&fit=crop",
  },
];

// Woman's arm / wrist / hand holding a modern black phone, shot on a seamless white
// studio backdrop so the backdrop can be keyed out cleanly.
const HAND_IMAGE_URL =
  "https://images.unsplash.com/photo-1691256676376-357c3aa66c89?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=1200";

export interface ScreenOverride {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Measured from the photo: the phone's real display area (normalized to image size).
export const DEFAULT_SCREEN: ScreenOverride = {
  x: 0.3275,
  y: 0.09,
  w: 0.3608,
  h: 0.7708,
};

// Display corner radius and the notch cut-out, both measured from the same photo.
const SCREEN_RADIUS_NORM = 0.032;
const NOTCH = { x: 0.4208, y: 0.0892, w: 0.1933, h: 0.0317 };

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

interface KeyedHand {
  canvas: HTMLCanvasElement;
  // Bounding box of the remaining subject (arm + hand + phone), in pixels.
  bx: number;
  by: number;
  bw: number;
  bh: number;
}

let keyedHandCache: { src: HTMLImageElement; result: KeyedHand } | null = null;

/**
 * Removes only the seamless studio backdrop with a border flood fill using a tight local
 * tolerance, so skin, phone body and display pixels stay exactly as shot (no distortion).
 */
function getKeyedHand(img: HTMLImageElement): KeyedHand | null {
  if (keyedHandCache?.src === img) return keyedHandCache.result;

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

  const luma = new Float32Array(n);
  const candidate = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    luma[i] = l;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    candidate[i] = l > 170 && chroma < 25 ? 1 : 0;
  }

  const filled = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const seed = (idx: number) => {
    if (candidate[idx] && !filled[idx]) {
      filled[idx] = 1;
      stack[sp++] = idx;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const y = (idx / w) | 0;
    const x = idx - y * w;
    const l = luma[idx];
    const step = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = ny * w + nx;
      if (!candidate[ni] || filled[ni]) return;
      if (Math.abs(luma[ni] - l) > 5) return;
      filled[ni] = 1;
      stack[sp++] = ni;
    };
    step(x + 1, y);
    step(x - 1, y);
    step(x, y + 1);
    step(x, y - 1);
  }

  // Close pinholes (specular highlights on skin/nails caught by the fill).
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

  // Enclosed backdrop pockets (e.g. the gap between thumb and phone) can't be reached
  // from the border, so sweep them separately: any small backdrop-coloured island that
  // is not the phone display gets removed too. The display is huge, so it stays intact.
  const visited = new Uint8Array(n);
  const island = new Int32Array(n);
  const minKeep = n * 0.02;
  for (let start = 0; start < n; start++) {
    if (!candidate[start] || filled[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    island[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const idx = island[head++];
      const y = (idx / w) | 0;
      const x = idx - y * w;
      const walk = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const ni = ny * w + nx;
        if (!candidate[ni] || filled[ni] || visited[ni]) return;
        visited[ni] = 1;
        island[tail++] = ni;
      };
      walk(x + 1, y);
      walk(x - 1, y);
      walk(x, y + 1);
      walk(x, y - 1);
    }
    if (tail < minKeep) {
      for (let i = 0; i < tail; i++) filled[island[i]] = 1;
    }
  }

  // Feather the matte by 1px so edges don't alias against the environment.
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

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = Math.min(1, alpha[i]);
      d[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  octx.putImageData(imageData, 0, 0);
  const result: KeyedHand = {
    canvas: c,
    bx: minX,
    by: minY,
    bw: Math.max(1, maxX - minX),
    bh: Math.max(1, maxY - minY),
  };
  keyedHandCache = { src: img, result };
  return result;
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
  handZoom = 1,
  handPanX = 0,
  handPanY = 0,
) {
  const SCREEN = screenOverride ?? DEFAULT_SCREEN;
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[0];
  const bgImg = loadImage(env.url);
  const handImg = loadImage(HAND_IMAGE_URL);

  ctx.clearRect(0, 0, cw, ch);

  // --- 1. Environment background, native aspect, softly blurred for depth ---
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

  // Uniform scale (never stretched): frame the whole keyed subject, then apply the
  // user's zoom / pan so nothing gets clipped unintentionally.
  const baseFit = Math.min((cw * 0.98) / hand.bw, (ch * 1.0) / hand.bh);
  const fit = baseFit * handZoom;
  const drawW = hand.canvas.width * fit;
  const drawH = hand.canvas.height * fit;
  const handX = cw / 2 - (hand.bx + hand.bw / 2) * fit + handPanX * cw;
  const handY = ch - (hand.by + hand.bh) * fit + handPanY * ch;

  // --- Natural handheld motion: slow drift + breathing + micro tremor ---
  const driftX =
    Math.sin(time * 0.53) * 1 + Math.sin(time * 0.31 + 1.3) * 0.55 +
    Math.sin(time * 3.1) * 0.14 + Math.sin(time * 5.7 + 0.7) * 0.07;
  const driftY =
    Math.sin(time * 0.47 + 0.6) * 1 + Math.sin(time * 0.24 + 2.1) * 0.6 +
    Math.sin(time * 2.7 + 1.1) * 0.14 + Math.sin(time * 6.3) * 0.07;
  const rot =
    Math.sin(time * 0.41) * 0.007 + Math.sin(time * 0.27 + 2.0) * 0.0038 +
    Math.sin(time * 4.3 + 0.4) * 0.0006;
  const breathe = 1 + Math.sin(time * 0.37) * 0.005;

  ctx.save();
  ctx.translate(cw / 2 + driftX * cw * 0.008, ch / 2 + driftY * ch * 0.006);
  ctx.rotate(rot);
  ctx.scale(breathe, breathe);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. The stock photo itself (only the backdrop keyed away) ---
  ctx.drawImage(hand.canvas, handX, handY, drawW, drawH);

  // --- 3. Uploaded video, clipped to the phone's real display area ---
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
    let dw: number;
    let dh: number;
    if (videoFit === "fill") {
      dw = sw;
      dh = sh;
    } else {
      const base = videoFit === "contain"
        ? Math.min(sw / vw, sh / vh)
        : Math.max(sw / vw, sh / vh);
      const s = base * videoScale;
      dw = vw * s;
      dh = vh * s;
    }
    const ox = (videoOffsetX / 100) * Math.max(0, (dw - sw) / 2);
    const oy = (videoOffsetY / 100) * Math.max(0, (dh - sh) / 2);
    ctx.drawImage(video, sx + (sw - dw) / 2 + ox, sy + (sh - dh) / 2 + oy, dw, dh);

    // Keep the phone's notch reading on top of the footage.
    const nx = handX + NOTCH.x * drawW;
    const ny = handY + NOTCH.y * drawH;
    const nw = NOTCH.w * drawW;
    const nh = NOTCH.h * drawH;
    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    ctx.moveTo(nx, ny - nh);
    ctx.lineTo(nx + nw, ny - nh);
    ctx.lineTo(nx + nw, ny + nh - nh / 2);
    ctx.quadraticCurveTo(nx + nw, ny + nh, nx + nw - nh / 2, ny + nh);
    ctx.lineTo(nx + nh / 2, ny + nh);
    ctx.quadraticCurveTo(nx, ny + nh, nx, ny + nh - nh / 2);
    ctx.closePath();
    ctx.fill();

    // Very light glass sheen so screen colors stay true.
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
