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

// Screen region in the hand photo (6203551) — normalized coordinates [0..1]
// The phone screen sits roughly in this bounding box within the image.
// These are calibrated for this specific photo: woman holding phone with black screen.
const SCREEN_REGION = {
  x: 0.30,
  y: 0.12,
  w: 0.42,
  h: 0.50,
  radius: 0.02,
};

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

  // --- Sway animation: subtle micro-movement ---
  const swayX = Math.sin(time * 0.7) * cw * 0.004 + Math.sin(time * 1.9) * cw * 0.002;
  const swayY = Math.sin(time * 0.9) * ch * 0.005 + Math.sin(time * 2.3) * ch * 0.0015;
  const swayRot = Math.sin(time * 0.5) * 0.006 + Math.sin(time * 1.4) * 0.003;

  // --- 1. Draw blurred environment background ---
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

  // --- Warm overlay to unify the background ---
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#1a1008";
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (!handImg) {
    // Hand image still loading — show placeholder text
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(cw * 0.025)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loading hand mockup...", cw / 2, ch / 2);
    return;
  }

  // --- Calculate hand image draw dimensions ---
  // Scale hand image to fill the canvas height with some margin
  const handAspect = handImg.naturalWidth / handImg.naturalHeight;
  const targetH = ch * 1.05;
  const targetW = targetH * handAspect;
  const handX = (cw - targetW) / 2;
  const handY = (ch - targetH) / 2 + ch * 0.05; // slight downward offset for first-person feel

  // Screen rect in canvas coordinates
  const screenX = handX + SCREEN_REGION.x * targetW;
  const screenY = handY + SCREEN_REGION.y * targetH;
  const screenW = SCREEN_REGION.w * targetW;
  const screenH = SCREEN_REGION.h * targetH;
  const screenR = SCREEN_REGION.radius * targetW;

  // --- Apply sway transform to everything (hand + screen + video) ---
  ctx.save();
  ctx.translate(cw / 2 + swayX, ch / 2 + swayY);
  ctx.rotate(swayRot);
  ctx.translate(-cw / 2, -ch / 2);

  // --- 2. Draw video in screen area (below hand) ---
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

  // --- 3. Draw hand image on top ---
  ctx.drawImage(handImg, handX, handY, targetW, targetH);

  // --- Glass reflection on screen ---
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

  ctx.restore(); // end sway transform

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
