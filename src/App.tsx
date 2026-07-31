import { useEffect, useRef, useState } from "react";
import { drawHandView, preloadHandViewImages, ENVIRONMENTS, DEFAULT_SCREEN, type EnvironmentId } from "./handView";
import { drawHookOverlay, drawEndCard, getHookBounds, getEndCardBounds, HOOK_FONT } from "./overlays";

export default Index;


type DeviceId = "s24" | "s24_ultra" | "note20" | "zflip" | "lg_v60" | "lg_velvet" | "lg_g8";

type DeviceSpec = {
  id: DeviceId;
  label: string;
  body: string;
  rail: string;
  aspect: number;
  radiusRatio: number;
  bezelRatio: number;
  camera: "punch-center" | "punch-left" | "notch-wide" | "notch-drop" | "punch-corner";
};

const DEVICES: DeviceSpec[] = [
  { id: "s24",       label: "Samsung Galaxy S24",       body: "#0d0d10", rail: "#3a3a3f", aspect: 0.462, radiusRatio: 0.085, bezelRatio: 0.022, camera: "punch-center" },
  { id: "s24_ultra", label: "Samsung Galaxy S24 Ultra", body: "#15161a", rail: "#46474c", aspect: 0.470, radiusRatio: 0.055, bezelRatio: 0.020, camera: "punch-center" },
  { id: "note20",    label: "Samsung Galaxy Note 20",   body: "#111114", rail: "#2f3035", aspect: 0.455, radiusRatio: 0.060, bezelRatio: 0.024, camera: "punch-center" },
  { id: "zflip",     label: "Samsung Galaxy Z Flip5",   body: "#1a1a1f", rail: "#3d3d44", aspect: 0.438, radiusRatio: 0.110, bezelRatio: 0.026, camera: "punch-center" },
  { id: "lg_v60",    label: "LG V60 ThinQ",             body: "#0b0c10", rail: "#34353a", aspect: 0.460, radiusRatio: 0.070, bezelRatio: 0.030, camera: "notch-drop" },
  { id: "lg_velvet", label: "LG Velvet",                body: "#101218", rail: "#3a3c44", aspect: 0.448, radiusRatio: 0.090, bezelRatio: 0.028, camera: "notch-drop" },
  { id: "lg_g8",     label: "LG G8 ThinQ",              body: "#0e0e12", rail: "#33343a", aspect: 0.472, radiusRatio: 0.075, bezelRatio: 0.034, camera: "notch-wide" },
];


type PresetId = "tiktok" | "linkedin_square" | "linkedin_landscape" | "story" | "youtube" | "source";

const PRESETS: { id: PresetId; label: string; w: number; h: number; note: string }[] = [
  { id: "tiktok", label: "TikTok / Reels / Shorts", w: 1080, h: 1920, note: "9:16" },
  { id: "story", label: "Instagram Story", w: 1080, h: 1920, note: "9:16" },
  { id: "linkedin_square", label: "LinkedIn Square", w: 1200, h: 1200, note: "1:1" },
  { id: "linkedin_landscape", label: "LinkedIn Landscape", w: 1920, h: 1080, note: "16:9" },
  { id: "youtube", label: "YouTube 1080p", w: 1920, h: 1080, note: "16:9" },
  { id: "source", label: "Tight crop (phone only)", w: 0, h: 0, note: "auto" },
];

// A single "lock zoom from this timestamp onward" snapshot. Multiple keyframes can
// exist across the same video, letting the user zoom in/out repeatedly over time.
type ZoomKeyframe = {
  id: string;
  time: number;
  scale: number;
  offX: number;
  offY: number;
  handZoom: number;
  handPanX: number;
  handPanY: number;
};

type ViewMode = "floating" | "hand";
type BgId = "transparent" | "lavender" | "sage" | "cloud" | "mist" | "pink" | "purple" | "blue";
type AnimId = "float" | "pulse" | "rays" | "aurora" | "orbit" | "breathe";

const BACKGROUNDS: { id: BgId; label: string; preview: string }[] = [
  { id: "transparent", label: "Transparent (WebM)", preview: "transparent" },
  { id: "lavender", label: "Lavender", preview: "linear-gradient(135deg,#0c0814,#14101e)" },
  { id: "sage", label: "Sage", preview: "linear-gradient(135deg,#080e0a,#0e1810)" },
  { id: "cloud", label: "Cloud", preview: "linear-gradient(135deg,#080a10,#0e1218)" },
  { id: "mist", label: "Mist", preview: "linear-gradient(135deg,#08090e,#0e1016)" },
  { id: "pink", label: "Pink", preview: "linear-gradient(135deg,#14080e,#1e0e16)" },
  { id: "purple", label: "Purple", preview: "linear-gradient(135deg,#0e0814,#180e20)" },
  { id: "blue", label: "Blue", preview: "linear-gradient(135deg,#06081a,#0a1028)" },
];

const ANIMATIONS: { id: AnimId; label: string }[] = [
  { id: "float", label: "Gentle Float" },
  { id: "pulse", label: "Breathing Pulse" },
  { id: "rays", label: "Light Rays" },
  { id: "aurora", label: "Aurora Waves" },
  { id: "orbit", label: "Orbiting Ring" },
  { id: "breathe", label: "Deep Breathe" },
];

const COLOR_PALETTES: Record<string, { bg1: string; bg2: string; glow: string; accent: string }> = {
  lavender: { bg1: "#0c0814", bg2: "#14101e", glow: "rgba(150, 100, 220, 0.25)", accent: "rgba(120, 80, 200, 0.12)" },
  sage:     { bg1: "#080e0a", bg2: "#0e1810", glow: "rgba(80, 180, 120, 0.22)", accent: "rgba(60, 160, 100, 0.10)" },
  cloud:    { bg1: "#080a10", bg2: "#0e1218", glow: "rgba(100, 150, 220, 0.22)", accent: "rgba(80, 130, 200, 0.10)" },
  mist:     { bg1: "#08090e", bg2: "#0e1016", glow: "rgba(80, 140, 200, 0.22)", accent: "rgba(60, 120, 180, 0.10)" },
  pink:     { bg1: "#14080e", bg2: "#1e0e16", glow: "rgba(240, 80, 160, 0.25)", accent: "rgba(220, 60, 140, 0.12)" },
  purple:   { bg1: "#0e0814", bg2: "#180e20", glow: "rgba(160, 60, 240, 0.25)", accent: "rgba(140, 40, 220, 0.12)" },
  blue:     { bg1: "#06081a", bg2: "#0a1028", glow: "rgba(60, 120, 255, 0.25)", accent: "rgba(40, 100, 240, 0.12)" },
};


// --- Collapsible Section Component ---
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06] pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <span className="text-[11px] uppercase tracking-widest text-white/50 font-medium">{title}</span>
        <svg
          className={`h-3.5 w-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pt-1 pb-1">{children}</div>}
    </div>
  );
}


function Index() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ w: number; h: number; d: number } | null>(null);
  const [device, setDevice] = useState<DeviceId>("s24");
  const [frameColor, setFrameColor] = useState<"black" | "white">("black");
  const [preset, setPreset] = useState<PresetId>("tiktok");
  const [bg, setBg] = useState<BgId>("lavender");
  const [anim, setAnim] = useState<AnimId>("float");
  const [scale, setScale] = useState(0.82);
  const [mockupStretchY, setMockupStretchY] = useState(1);
  const [videoFit, setVideoFit] = useState<"cover" | "contain" | "fill">("cover");
  const [videoScale, setVideoScale] = useState(1);
  const [videoOffsetX, setVideoOffsetX] = useState(0);
  const [videoOffsetY, setVideoOffsetY] = useState(0);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"auto" | "mp4" | "webm">("auto");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("floating");
  const [envBg, setEnvBg] = useState<EnvironmentId>("living_room");
  const [screenX, setScreenX] = useState(DEFAULT_SCREEN.x);
  const [screenY, setScreenY] = useState(DEFAULT_SCREEN.y);
  const [screenW, setScreenW] = useState(DEFAULT_SCREEN.w);
  const [screenH, setScreenH] = useState(DEFAULT_SCREEN.h);
  const [handZoom, setHandZoom] = useState(1);
  const [handPanX, setHandPanX] = useState(0);
  const [handPanY, setHandPanY] = useState(0);
  const [hookEnabled, setHookEnabled] = useState(true);
  const [hookText, setHookText] = useState("I built this so I'd stop journaling in Notes app");
  const [hookDuration, setHookDuration] = useState(1.8);
  const [hookOffsetX, setHookOffsetX] = useState(0);
  const [hookOffsetY, setHookOffsetY] = useState(0);
  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [ctaHeadline, setCtaHeadline] = useState("Try it free — link in bio");
  const [ctaHandle, setCtaHandle] = useState("@yourhandle");
  const [ctaDuration, setCtaDuration] = useState(2);
  const [ctaOffsetX, setCtaOffsetX] = useState(0);
  const [ctaOffsetY, setCtaOffsetY] = useState(0);
  const [overlayAccent, setOverlayAccent] = useState("#c8ff2e");

  // Video player state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Zoom keyframes: an ordered list of "lock zoom from this timestamp onward" snapshots.
  // Before the first keyframe, playback uses the normal/default framing. From each
  // keyframe's timestamp onward, its captured zoom applies until the next keyframe
  // takes over (or to the end of the video for the last one). This lets zoom be
  // locked in and out multiple times across the same video.
  const [zoomKeyframes, setZoomKeyframes] = useState<ZoomKeyframe[]>([]);

  // Ref for zoom keyframes so the RAF draw loop always reads the latest, time-sorted list
  const zoomKeyframesRef = useRef<ZoomKeyframe[]>([]);
  const liveZoomRef = useRef({
    scale: 1, offX: 0, offY: 0,
    handZoom: 1, handPanX: 0, handPanY: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeUpdateRef = useRef<number>(0);
  const audioSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const isExportingRef = useRef(false);

  useEffect(() => { preloadHandViewImages(); }, []);

  // Make sure the display font is ready before it is painted onto the canvas.
  useEffect(() => {
    document.fonts?.load(`700 100px ${HOOK_FONT}`).catch(() => {});
  }, []);

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  // Probe metadata and ensure preview video starts playing
  useEffect(() => {
    if (!videoUrl) return;
    const v = document.createElement("video");
    v.src = videoUrl;
    v.muted = true;
    v.onloadedmetadata = () => {
      setVideoMeta({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
    };
    const refVideo = videoRef.current;
    if (refVideo) {
      refVideo.src = videoUrl;
      refVideo.muted = true;
      refVideo.loop = true;
      refVideo.playsInline = true;
      refVideo.load();
      refVideo.play().catch(() => {});
      setIsPlaying(true);
      setCurrentTime(0);
    }
  }, [videoUrl]);

  // Track current time from the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
    };
    video.addEventListener("timeupdate", onTime);
    // RAF-driven updates for sub-frame seek bar precision
    let raf = 0;
    let lastReported = 0;
    const tick = () => {
      if (!isSeeking && video && !video.paused) {
        const t = video.currentTime;
        // Only set state when the value visually changes (tenths of a second)
        if (Math.abs(t - lastReported) >= 0.05) {
          lastReported = t;
          setCurrentTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      cancelAnimationFrame(raf);
    };
  }, [isSeeking]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  // Keep refs in sync with state so the RAF draw loop reads the latest values.
  // Keyframes are kept sorted by time so the draw loop can find the active one cheaply.
  useEffect(() => {
    zoomKeyframesRef.current = [...zoomKeyframes].sort((a, b) => a.time - b.time);
  }, [zoomKeyframes]);

  useEffect(() => {
    liveZoomRef.current = {
      scale: videoScale, offX: videoOffsetX, offY: videoOffsetY,
      handZoom, handPanX, handPanY,
    };
  }, [videoScale, videoOffsetX, videoOffsetY, handZoom, handPanX, handPanY]);

  // Capture the current slider settings as a new zoom keyframe at the current playhead
  // time. If a keyframe already exists very close to this timestamp, it is updated
  // in place instead of creating a duplicate.
  const captureZoomLock = () => {
    const video = videoRef.current;
    const t = video ? video.currentTime : 0;
    const snapshot = {
      time: t,
      scale: videoScale,
      offX: videoOffsetX,
      offY: videoOffsetY,
      handZoom,
      handPanX,
      handPanY,
    };
    setZoomKeyframes((prev) => {
      const existingIdx = prev.findIndex((k) => Math.abs(k.time - t) < 0.05);
      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], ...snapshot };
        return next;
      }
      return [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...snapshot }];
    });
  };

  const removeZoomKeyframe = (id: string) => {
    setZoomKeyframes((prev) => prev.filter((k) => k.id !== id));
  };

  const clearZoomKeyframes = () => setZoomKeyframes([]);

  const getEffectiveZoomRef = useRef((videoTime: number) => ({
    vScale: 1, vOffX: 0, vOffY: 0, hZoom: 1, hPanX: 0, hPanY: 0,
  }));
  getEffectiveZoomRef.current = (videoTime: number) => {
    const keyframes = zoomKeyframesRef.current;
    const live = liveZoomRef.current;
    if (keyframes.length === 0) {
      return {
        vScale: live.scale,
        vOffX: live.offX,
        vOffY: live.offY,
        hZoom: live.handZoom,
        hPanX: live.handPanX,
        hPanY: live.handPanY,
      };
    }
    // Find the last keyframe whose timestamp is <= the current video time. Since the
    // list is kept sorted, this is the keyframe that is "active" right now.
    let active: ZoomKeyframe | null = null;
    let nextKf: ZoomKeyframe | null = null;
    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].time <= videoTime) {
        active = keyframes[i];
      } else {
        if (active !== null && nextKf === null) nextKf = keyframes[i];
        break;
      }
    }
    // Before the first keyframe's time, always show the normal/default framing (no zoom).
    if (!active) {
      return { vScale: 1, vOffX: 0, vOffY: 0, hZoom: 1, hPanX: 0, hPanY: 0 };
    }
    // If we are past the LAST keyframe (no next keyframe exists), show the live slider
    // values so the user can preview the zoom they're about to lock next. This makes
    // the sliders responsive in the "editing zone" past the last locked point.
    // During export, however, the last keyframe stays locked for the rest of the video.
    if (!nextKf && active === keyframes[keyframes.length - 1] && !isExportingRef.current) {
      return {
        vScale: live.scale,
        vOffX: live.offX,
        vOffY: live.offY,
        hZoom: live.handZoom,
        hPanX: live.handPanX,
        hPanY: live.handPanY,
      };
    }
    // Between two keyframes, use the active keyframe's captured values rigidly
    // (this is the locked behavior that gets baked into the export).
    return {
      vScale: active.scale,
      vOffX: active.offX,
      vOffY: active.offY,
      hZoom: active.handZoom,
      hPanX: active.handPanX,
      hPanY: active.handPanY,
    };
  };


  // Preview loop
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !videoMeta) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dev = DEVICES.find((d) => d.id === device)!;
    const pre = PRESETS.find((p) => p.id === preset)!;

    const basePhoneH = 1800;
    const phoneW = basePhoneH * dev.aspect;
    const phoneH = basePhoneH * mockupStretchY;

    let cw = pre.w;
    let ch = pre.h;
    if (pre.id === "source") {
      cw = Math.round(phoneW);
      ch = Math.round(phoneH);
    }
    canvas.width = cw;
    canvas.height = ch;

    const drawOverlays = () => {
      const vt = video.currentTime || 0;
      const dur = videoMeta.d || 0;
      // On very short clips, shrink the windows so hook and end card never collide.
      const hookWindow = dur > 0 ? Math.min(hookDuration, dur * 0.45) : hookDuration;
      const ctaWindow = dur > 0 ? Math.min(ctaDuration, dur * 0.45) : ctaDuration;
      if (hookEnabled) {
        drawHookOverlay(ctx, cw, ch, vt, { text: hookText, duration: hookWindow, accent: overlayAccent, offsetX: hookOffsetX, offsetY: hookOffsetY });
      }
      if (ctaEnabled && dur > 0) {
        drawEndCard(ctx, cw, ch, dur - vt, {
          headline: ctaHeadline,
          handle: ctaHandle,
          duration: ctaWindow,
          accent: overlayAccent,
          offsetX: ctaOffsetX,
          offsetY: ctaOffsetY,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, cw, ch);

      const vt = video.currentTime || 0;
      const ez = getEffectiveZoomRef.current(vt);

      // --- Hand-holding-phone view ---
      if (viewMode === "hand" && video) {
        const t = performance.now() / 1000;
        drawHandView(ctx, cw, ch, video, envBg, t, videoFit, ez.vScale, ez.vOffX, ez.vOffY, { x: screenX, y: screenY, w: screenW, h: screenH }, ez.hZoom, ez.hPanX, ez.hPanY);
        drawOverlays();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const isFloat = bg !== "transparent";

      if (isFloat) {
        // === 3D FLOATING PHONE with selectable animation ===
        const t = performance.now() / 1000;
        const palette = COLOR_PALETTES[bg] || COLOR_PALETTES.lavender;

        // Deep dark gradient background
        const bgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.4, 0, cw * 0.5, ch * 0.5, cw * 0.7);
        bgGrad.addColorStop(0, palette.bg2);
        bgGrad.addColorStop(1, palette.bg1);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, cw, ch);

        // Phone dimensions
        const fit = Math.min(cw / phoneW, ch / phoneH) * scale * 0.85;
        const drawW = phoneW * fit;
        const drawH = phoneH * fit;
        const cx2 = cw / 2;
        const cy2 = ch / 2;

        // Float animation: gentle bob + subtle tilt
        const bobY = Math.sin(t * 1.2) * (ch * 0.012) + Math.sin(t * 2.8) * (ch * 0.004);
        const bobX = Math.sin(t * 0.8) * (cw * 0.003);
        const tiltX = Math.sin(t * 0.7) * 0.03;
        const tiltY = Math.sin(t * 1.1) * 0.02;
        const tiltZ = Math.sin(t * 0.5) * 0.008;
        const glowX = cx2 + bobX * 1.2;
        const glowY = cy2 + bobY * 0.8;
        const glowR = Math.max(drawW, drawH) * 0.85;

        // === ANIMATION: Gentle Float — large visible glow ===
        if (anim === "float") {
          ctx.save();
          const glowAlpha = 0.30 + Math.sin(t * 0.4) * 0.10;
          ctx.globalAlpha = glowAlpha;
          const glowGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR * 1.1);
          glowGrad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          glowGrad.addColorStop(0.3, palette.glow.replace(/[\d.]+\)$/, "0.7)"));
          glowGrad.addColorStop(0.6, palette.glow);
          glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = glowGrad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // === ANIMATION: Breathing Pulse — dramatic expanding/contracting ===
        if (anim === "pulse") {
          const pulsePhase = Math.sin(t * 0.5);
          const pulseR = glowR * (0.7 + pulsePhase * 0.3);
          const pulseAlpha = 0.25 + pulsePhase * 0.12;

          ctx.save();
          ctx.globalAlpha = pulseAlpha;
          const pulseGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, pulseR);
          pulseGrad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          pulseGrad.addColorStop(0.35, palette.glow.replace(/[\d.]+\)$/, "0.6)"));
          pulseGrad.addColorStop(0.7, palette.accent.replace(/[\d.]+\)$/, "0.3)"));
          pulseGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = pulseGrad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Outer ring pulse
          ctx.save();
          ctx.globalAlpha = 0.08 + pulsePhase * 0.04;
          ctx.beginPath();
          ctx.arc(glowX, glowY, pulseR * 1.1, 0, Math.PI * 2);
          ctx.lineWidth = drawW * 0.02;
          ctx.strokeStyle = palette.glow.replace(/[\d.]+\)$/, "0.5)");
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // === ANIMATION: Orbiting Ring — glowing ring orbits behind the phone ===
        if (anim === "orbit") {
          const orbitAngle = t * 0.6;
          const orbitR = glowR * 0.65;

          // Draw the orbit path (faint ring)
          ctx.save();
          ctx.globalAlpha = 0.08;
          ctx.beginPath();
          ctx.ellipse(cx2, cy2, orbitR, orbitR * 0.35, 0.2, 0, Math.PI * 2);
          ctx.lineWidth = drawW * 0.015;
          ctx.strokeStyle = palette.glow.replace(/[\d.]+\)$/, "0.6)");
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.restore();

          // Orbiting bright dot
          const dotX = cx2 + Math.cos(orbitAngle) * orbitR;
          const dotY = cy2 + Math.sin(orbitAngle) * orbitR * 0.35;
          const dotR = drawW * 0.06;

          ctx.save();
          ctx.globalAlpha = 0.4;
          const dotGrad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotR * 3);
          dotGrad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          dotGrad.addColorStop(0.3, palette.glow.replace(/[\d.]+\)$/, "0.5)"));
          dotGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = dotGrad;
          ctx.fillRect(dotX - dotR * 3, dotY - dotR * 3, dotR * 6, dotR * 6);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Second dot (opposite side, dimmer)
          const dot2X = cx2 + Math.cos(orbitAngle + Math.PI) * orbitR;
          const dot2Y = cy2 + Math.sin(orbitAngle + Math.PI) * orbitR * 0.35;
          ctx.save();
          ctx.globalAlpha = 0.2;
          const dot2Grad = ctx.createRadialGradient(dot2X, dot2Y, 0, dot2X, dot2Y, dotR * 2);
          dot2Grad.addColorStop(0, palette.accent.replace(/[\d.]+\)$/, "1)"));
          dot2Grad.addColorStop(0.4, palette.accent.replace(/[\d.]+\)$/, "0.4)"));
          dot2Grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = dot2Grad;
          ctx.fillRect(dot2X - dotR * 2, dot2Y - dotR * 2, dotR * 4, dotR * 4);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Center ambient glow
          ctx.save();
          ctx.globalAlpha = 0.12;
          const centerGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR * 0.5);
          centerGlow.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = centerGlow;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // === ANIMATION: Deep Breathe — large slow-expanding concentric rings ===
        if (anim === "breathe") {
          const breathPhase = t * 0.3;

          for (let i = 0; i < 3; i++) {
            const ringPhase = (breathPhase + i * 0.33) % 1;
            const ringR = glowR * (0.3 + ringPhase * 0.9);
            const ringAlpha = 0.2 * (1 - ringPhase);

            ctx.save();
            ctx.globalAlpha = ringAlpha;
            ctx.beginPath();
            ctx.arc(glowX, glowY, ringR, 0, Math.PI * 2);
            ctx.lineWidth = drawW * (0.04 - ringPhase * 0.03);
            ctx.strokeStyle = palette.glow.replace(/[\d.]+\)$/, "1)");
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
          }

          // Center glow
          ctx.save();
          const bAlpha = 0.18 + Math.sin(t * 0.5) * 0.08;
          ctx.globalAlpha = bAlpha;
          const bGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR * 0.5);
          bGrad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          bGrad.addColorStop(0.5, palette.glow.replace(/[\d.]+\)$/, "0.4)"));
          bGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = bGrad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // === ANIMATION: Light Rays ===
        if (anim === "rays") {
          // Glow base
          ctx.save();
          ctx.globalAlpha = 0.12;
          const rGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
          rGlow.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          rGlow.addColorStop(0.4, palette.glow);
          rGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = rGlow;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Rotating rays
          ctx.save();
          ctx.globalAlpha = 0.07;
          const rayCount = 8;
          const rayBaseAngle = t * 0.15;
          for (let i = 0; i < rayCount; i++) {
            const angle = rayBaseAngle + (i / rayCount) * Math.PI * 2;
            const rayLen = Math.max(cw, ch) * 0.8;
            const rayWidth = 0.08 + Math.sin(t * 0.3 + i * 1.7) * 0.03;
            ctx.beginPath();
            ctx.moveTo(glowX, glowY);
            ctx.lineTo(glowX + Math.cos(angle - rayWidth) * rayLen, glowY + Math.sin(angle - rayWidth) * rayLen);
            ctx.lineTo(glowX + Math.cos(angle + rayWidth) * rayLen, glowY + Math.sin(angle + rayWidth) * rayLen);
            ctx.closePath();
            const rayGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, rayLen);
            rayGrad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
            rayGrad.addColorStop(0.4, palette.glow);
            rayGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = rayGrad;
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // === ANIMATION: Aurora Waves ===
        if (anim === "aurora") {
          // Wave 1 — flows from top-left
          ctx.save();
          ctx.globalAlpha = 0.14;
          const w1Y = ch * 0.35 + Math.sin(t * 0.4) * ch * 0.08;
          const w1Grad = ctx.createRadialGradient(cw * 0.3 + Math.sin(t * 0.3) * cw * 0.1, w1Y, 0, cw * 0.3, w1Y, cw * 0.5);
          w1Grad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          w1Grad.addColorStop(0.4, palette.glow);
          w1Grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = w1Grad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Wave 2 — flows from top-right
          ctx.save();
          ctx.globalAlpha = 0.10;
          const w2Y = ch * 0.5 + Math.sin(t * 0.35 + 1.5) * ch * 0.06;
          const w2Grad = ctx.createRadialGradient(cw * 0.7 + Math.sin(t * 0.25 + 2) * cw * 0.08, w2Y, 0, cw * 0.7, w2Y, cw * 0.45);
          w2Grad.addColorStop(0, palette.accent.replace(/[\d.]+\)$/, "1)"));
          w2Grad.addColorStop(0.4, palette.accent);
          w2Grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = w2Grad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Wave 3 — center pulse synced to bob
          ctx.save();
          const w3Alpha = 0.10 + Math.sin(t * 0.5) * 0.04;
          ctx.globalAlpha = w3Alpha;
          const w3Grad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, drawH * 0.7);
          w3Grad.addColorStop(0, palette.glow.replace(/[\d.]+\)$/, "1)"));
          w3Grad.addColorStop(0.5, palette.glow);
          w3Grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = w3Grad;
          ctx.fillRect(0, 0, cw, ch);
          ctx.globalAlpha = 1;
          ctx.restore();

          // Horizontal streaks
          ctx.save();
          ctx.globalAlpha = 0.04;
          for (let i = 0; i < 4; i++) {
            const sY = ch * (0.25 + i * 0.18) + Math.sin(t * 0.2 + i * 0.8) * ch * 0.03;
            const sGrad = ctx.createLinearGradient(0, sY - ch * 0.015, 0, sY + ch * 0.015);
            sGrad.addColorStop(0, "rgba(0,0,0,0)");
            sGrad.addColorStop(0.5, palette.glow.replace(/[\d.]+\)$/, "0.8)"));
            sGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = sGrad;
            ctx.fillRect(0, sY - ch * 0.015, cw, ch * 0.03);
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // Draw shadow (ellipse below the phone, offset and blurred)
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        const shadowY = cy2 + drawH * 0.52 + bobY * 0.3;
        const shadowW = drawW * 0.7 * (1 - Math.abs(tiltX) * 2);
        const shadowH = drawH * 0.06;
        ctx.ellipse(cx2 + bobX, shadowY, shadowW, shadowH, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#000";
        ctx.filter = `blur(${Math.round(drawW * 0.08)}px)`;
        ctx.fill();
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.restore();

        // Apply 3D perspective transform via canvas transforms
        // Since canvas doesn't have real 3D, we simulate with skew + scale
        ctx.save();
        ctx.translate(cx2 + bobX, cy2 + bobY);
        ctx.rotate(tiltZ);

        // Simulate perspective tilt by applying slight vertical scale variation
        // and horizontal skew based on the tilt angles
        const perspScale = 1 - Math.abs(tiltX) * 0.5;
        ctx.scale(1, perspScale);
        ctx.transform(1, tiltX * 0.8, tiltY * 0.6, 1, 0, 0);

        ctx.translate(-drawW / 2, -drawH / 2);
        drawPhone(ctx, 0, 0, drawW, drawH, dev, video, videoFit, ez.vScale, ez.vOffX, ez.vOffY, frameColor);
        ctx.restore();

        // Vignette overlay (draws eye to center)
        ctx.save();
        const vignette = ctx.createRadialGradient(
          cx2, cy2, Math.min(cw, ch) * 0.3,
          cx2, cy2, Math.max(cw, ch) * 0.7
        );
        vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
        vignette.addColorStop(0.6, "rgba(0, 0, 0, 0)");
        vignette.addColorStop(0.85, "rgba(0, 0, 0, 0.25)");
        vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, cw, ch);
        ctx.restore();

      } else {
        // Transparent background — just draw the phone centered (no fill)
        const fit = Math.min(cw / phoneW, ch / phoneH) * scale;
        const drawW = phoneW * fit;
        const drawH = phoneH * fit;
        const x = (cw - drawW) / 2;
        const y = (ch - drawH) / 2;
        drawPhone(ctx, x, y, drawW, drawH, dev, video, videoFit, ez.vScale, ez.vOffX, ez.vOffY, frameColor);
      }
      drawOverlays();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [device, preset, scale, mockupStretchY, videoMeta, bg, anim, videoFit, videoScale, videoOffsetX, videoOffsetY, frameColor, viewMode, envBg, screenX, screenY, screenW, screenH, handZoom, handPanX, handPanY, hookEnabled, hookText, hookDuration, hookOffsetX, hookOffsetY, ctaEnabled, ctaHeadline, ctaHandle, ctaDuration, ctaOffsetX, ctaOffsetY, overlayAccent, zoomKeyframes]);


  const exportVideo = async () => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !videoMeta) return;

    setError(null);
    setRecording(true);
    setProgress(0);
    setResult(null);
    isExportingRef.current = true;

    try {
      const transparent = viewMode !== "hand" && bg === "transparent";
      const mp4Candidates = [
        'video/mp4;codecs="avc1.42E01F,mp4a.40.2"',
        'video/mp4;codecs="avc1.640028,mp4a.40.2"',
        'video/mp4;codecs="h264,aac"',
        "video/mp4",
      ];
      const webmCandidates = [
        'video/webm;codecs="vp9,opus"',
        'video/webm;codecs="vp8,opus"',
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const preferMp4 = !transparent && exportFormat !== "webm";
      const candidates = transparent
        ? webmCandidates
        : preferMp4
          ? [...mp4Candidates, ...webmCandidates]
          : [...webmCandidates, ...mp4Candidates];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error("Your browser does not support video recording.");
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

      const stream = canvas.captureStream(30);
      video.loop = false;
      video.muted = false;
      video.volume = 1;
      let audioTrackAdded = false;


      try {
        const capturableVideo = video as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const sourceStream = (capturableVideo.captureStream ?? capturableVideo.mozCaptureStream)?.call(video);
        const audioTracks = sourceStream?.getAudioTracks() ?? [];
        for (const track of audioTracks) {
          stream.addTrack(track);
          audioTrackAdded = true;
        }
      } catch (captureErr) {
        console.warn("Native audio capture failed:", captureErr);
      }

      try {
        if (!audioTrackAdded && !audioCtxRef.current) {
          const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
          audioCtxRef.current = new Ctx();
        }
        if (!audioTrackAdded && audioCtxRef.current) {
          const ac = audioCtxRef.current;
          if (ac.state === "suspended") await ac.resume();
          if (!audioSrcRef.current) {
            audioSrcRef.current = ac.createMediaElementSource(video);
          }
          if (!audioDestRef.current) {
            audioDestRef.current = ac.createMediaStreamDestination();
            audioSrcRef.current.connect(audioDestRef.current);
            audioSrcRef.current.connect(ac.destination);
          }
          for (const track of audioDestRef.current.stream.getAudioTracks()) {
            stream.addTrack(track);
            audioTrackAdded = true;
          }
        }
      } catch (audioErr) {
        console.warn("Audio capture failed:", audioErr);
      }


      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 192_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: mime }));
      });

      await seekVideo(video, 0);
      await video.play();
      recorder.start();

      const duration = videoMeta.d;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const elapsed = (performance.now() - start) / 1000;
          setProgress(Math.min(1, elapsed / duration));
          if (video.ended || elapsed >= duration) resolve();
          else requestAnimationFrame(tick);
        };
        tick();
      });

      recorder.stop();
      video.pause();
      video.loop = true;
      video.muted = true;
      const blob = await done;
      const url = URL.createObjectURL(blob);
      const pre = PRESETS.find((p) => p.id === preset)!;
      const name = `mockreel-${device}-${pre.id}-${canvas.width}x${canvas.height}.${ext}`;
      setResult({ url, name, size: blob.size, mime });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      isExportingRef.current = false;
      if (video) { video.loop = true; video.muted = true; }
      setRecording(false);
      setProgress(0);
    }
  };


  const selectStyle = {
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='white' d='M6 8L0 0h12z'/></svg>\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "32px",
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, #2a1b4a 0%, transparent 60%), radial-gradient(50% 40% at 100% 20%, #0c3a4a 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">MockReel</div>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 transition hover:border-white/40 hover:bg-white/[0.08]"
          >
            {sidebarOpen ? "Hide controls" : "Show controls"}
          </button>
        </header>

        <div className={`grid gap-5 ${sidebarOpen ? "lg:grid-cols-[320px_1fr]" : "lg:grid-cols-1"}`}>


          {/* Controls Sidebar */}
          {sidebarOpen && (
          <aside className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur scrollbar-thin">

            {/* Upload — always open */}
            <Section title="Upload recording" defaultOpen={true}>
              <label
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-3 py-5 text-center transition hover:border-white/40 hover:bg-white/[0.05]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              >
                <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <div className="text-sm text-white/80">{videoUrl ? "Replace video" : "Click or drop a video"}</div>
                <div className="mt-1 text-[11px] text-white/40">MP4, MOV, WebM — portrait recommended</div>
              </label>
              {videoMeta && (
                <div className="mt-1.5 text-[11px] text-white/50">{videoMeta.w}x{videoMeta.h} &bull; {videoMeta.d.toFixed(1)}s</div>
              )}
            </Section>

            {/* View Style */}
            <Section title="View style" defaultOpen={true}>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setViewMode("floating")}
                  className={`rounded-lg border px-3 py-2.5 text-[11px] font-medium transition ${
                    viewMode === "floating" ? "border-white bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white/80"
                  }`}
                >
                  Floating Phone
                </button>
                <button
                  onClick={() => setViewMode("hand")}
                  className={`rounded-lg border px-3 py-2.5 text-[11px] font-medium transition ${
                    viewMode === "hand" ? "border-white bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white/80"
                  }`}
                >
                  Hand Holding
                </button>
              </div>
            </Section>

            {/* Environment (hand view only) */}
            {viewMode === "hand" && (
              <Section title="Environment" defaultOpen={true}>
                <div className="grid grid-cols-3 gap-1.5">
                  {ENVIRONMENTS.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEnvBg(e.id)}
                      className={`overflow-hidden rounded-lg border text-[11px] transition ${
                        envBg === e.id ? "border-white ring-1 ring-white" : "border-white/15 hover:border-white/40"
                      }`}
                    >
                      <img src={e.url} alt={e.label} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                      <div className="px-1 py-1 text-center text-white/70">{e.label}</div>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Hand size & position (hand view only) */}
            {viewMode === "hand" && (
              <Section title="Hand size & position" defaultOpen={true}>
                <div className="space-y-2" data-testid="hand-transform-controls">
                  <div className="text-[10px] text-white/40">Drag the preview to move &bull; scroll to zoom</div>
                  <div>
                    <label className="text-[10px] text-white/40">Zoom: {handZoom.toFixed(2)}x</label>
                    <input
                      type="range"
                      data-testid="hand-zoom-slider"
                      min={0.4}
                      max={3}
                      step={0.01}
                      value={handZoom}
                      onChange={(e) => setHandZoom(Number(e.target.value))}
                      className="h-1 w-full cursor-pointer accent-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40">H position: {Math.round(handPanX * 100)}%</label>
                    <input
                      type="range"
                      data-testid="hand-panx-slider"
                      min={-1}
                      max={1}
                      step={0.005}
                      value={handPanX}
                      onChange={(e) => setHandPanX(Number(e.target.value))}
                      className="h-1 w-full cursor-pointer accent-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40">V position: {Math.round(handPanY * 100)}%</label>
                    <input
                      type="range"
                      data-testid="hand-pany-slider"
                      min={-1}
                      max={1}
                      step={0.005}
                      value={handPanY}
                      onChange={(e) => setHandPanY(Number(e.target.value))}
                      className="h-1 w-full cursor-pointer accent-white"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="hand-transform-reset-btn"
                    onClick={() => { setHandZoom(1); setHandPanX(0); setHandPanY(0); }}
                    className="text-[10px] text-white/50 hover:text-white"
                  >
                    Reset hand framing
                  </button>
                </div>
              </Section>
            )}

            {/* Screen position (hand view only) */}
            {viewMode === "hand" && (
              <Section title="Screen position">
                <div className="space-y-2" data-testid="screen-position-controls">
                  {([
                    ["Left", screenX, setScreenX],
                    ["Top", screenY, setScreenY],
                    ["Width", screenW, setScreenW],
                    ["Height", screenH, setScreenH],
                  ] as const).map(([label, val, setter]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-11 shrink-0 text-[11px] text-white/50">{label}</span>
                      <input
                        type="range"
                        data-testid={`screen-${label.toLowerCase()}-slider`}
                        min={0}
                        max={1}
                        step={0.001}
                        value={val}
                        onChange={(e) => (setter as (v: number) => void)(parseFloat(e.target.value))}
                        className="h-1 flex-1 cursor-pointer accent-white"
                      />
                      <span className="w-8 text-right text-[10px] tabular-nums text-white/40">{(val * 100).toFixed(1)}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    data-testid="screen-reset-btn"
                    onClick={() => {
                      setScreenX(DEFAULT_SCREEN.x);
                      setScreenY(DEFAULT_SCREEN.y);
                      setScreenW(DEFAULT_SCREEN.w);
                      setScreenH(DEFAULT_SCREEN.h);
                    }}
                    className="text-[10px] text-white/50 hover:text-white"
                  >
                    Reset to photo screen
                  </button>
                </div>
              </Section>
            )}

            {/* Device Frame (floating only) */}
            {viewMode === "floating" && (
            <Section title="Device frame">
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value as DeviceId)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/60"
                style={selectStyle}
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#1a1a22] text-white">{d.label}</option>
                ))}
              </select>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-white/50">Frame color:</span>
                <button
                  type="button"
                  onClick={() => setFrameColor("black")}
                  className={`h-6 w-6 rounded-full border-2 bg-[#0d0d10] transition ${frameColor === "black" ? "border-white ring-1 ring-white" : "border-white/20 hover:border-white/50"}`}
                  title="Black"
                />
                <button
                  type="button"
                  onClick={() => setFrameColor("white")}
                  className={`h-6 w-6 rounded-full border-2 bg-[#f0f0f2] transition ${frameColor === "white" ? "border-white ring-1 ring-white" : "border-white/20 hover:border-white/50"}`}
                  title="White"
                />
              </div>
            </Section>
            )}


            {/* Platform Preset */}
            <Section title="Platform preset">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetId)}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/60"
                style={selectStyle}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1a22] text-white">
                    {p.label} — {p.id === "source" ? "auto" : `${p.w}x${p.h}`}
                  </option>
                ))}
              </select>
            </Section>

            {/* Background — floating only */}
            {viewMode === "floating" && (
            <Section title="Background" defaultOpen={true}>
              <div className="grid grid-cols-5 gap-1.5">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBg(b.id)}
                    title={b.label}
                    className={`aspect-square overflow-hidden rounded-md border transition ${
                      bg === b.id ? "border-white ring-1 ring-white" : "border-white/15 hover:border-white/40"
                    }`}
                    style={
                      b.preview === "transparent"
                        ? { backgroundImage: "linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0,0 4px,4px -4px,-4px 0", backgroundColor: "#222" }
                        : { background: b.preview }
                    }
                  />
                ))}
              </div>
            </Section>
            )}

            {/* Animation style — floating only */}
            {viewMode === "floating" && (
            <Section title="Animation" defaultOpen={true}>
              <div className="grid grid-cols-2 gap-1.5">
                {ANIMATIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAnim(a.id)}
                    className={`rounded-lg border px-3 py-2 text-[11px] transition ${
                      anim === a.id ? "border-white bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30 hover:text-white/80"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>
            )}

            {/* Phone Size */}
            <Section title={`Phone size (${Math.round(scale * 100)}%)`}>
              <input type="range" min={0.3} max={1} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-white" />
            </Section>

            {/* Mockup Height */}
            <Section title={`Mockup height (${Math.round(mockupStretchY * 100)}%)`}>
              <div className="flex items-center gap-2">
                <input type="range" min={0.5} max={2} step={0.01} value={mockupStretchY} onChange={(e) => setMockupStretchY(Number(e.target.value))} className="flex-1 accent-white" />
                <button type="button" onClick={() => setMockupStretchY(1)} className="text-[10px] text-white/50 hover:text-white">Reset</button>
              </div>
            </Section>


            {/* Video Crop */}
            {videoUrl && (
            <Section title="Video crop">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <select value={videoFit} onChange={(e) => setVideoFit(e.target.value as "cover" | "contain" | "fill")} className="appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white outline-none" style={selectStyle}>
                    <option value="cover" className="bg-[#1a1a22]">Cover</option>
                    <option value="contain" className="bg-[#1a1a22]">Contain</option>
                    <option value="fill" className="bg-[#1a1a22]">Fill</option>
                  </select>
                  <button type="button" onClick={() => { setVideoFit("cover"); setVideoScale(1); setVideoOffsetX(0); setVideoOffsetY(0); }} className="text-[10px] text-white/50 hover:text-white">Reset</button>
                </div>
                <div>
                  <label className="text-[10px] text-white/40">Zoom: {videoScale.toFixed(2)}x</label>
                  <input type="range" min={0.5} max={3} step={0.01} value={videoScale} onChange={(e) => setVideoScale(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40">H offset: {videoOffsetX}%</label>
                  <input type="range" min={-100} max={100} step={1} value={videoOffsetX} onChange={(e) => setVideoOffsetX(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40">V offset: {videoOffsetY}%</label>
                  <input type="range" min={-100} max={100} step={1} value={videoOffsetY} onChange={(e) => setVideoOffsetY(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
              </div>
            </Section>
            )}

            {/* TikTok hook overlay */}
            <Section title="Hook text (first seconds)" defaultOpen={true}>
              <div className="space-y-2" data-testid="hook-controls">
                <label className="flex items-center gap-2 text-[11px] text-white/60">
                  <input
                    type="checkbox"
                    data-testid="hook-toggle"
                    checked={hookEnabled}
                    onChange={(e) => setHookEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 accent-white"
                  />
                  Show punch-in hook on frame 1
                </label>
                <textarea
                  data-testid="hook-text-input"
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  rows={3}
                  placeholder="I built this so I'd stop journaling in Notes app"
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] leading-snug text-white outline-none transition hover:border-white/30 focus:border-white/60"
                />
                <div>
                  <label className="text-[10px] text-white/40">On screen: {hookDuration.toFixed(1)}s</label>
                  <input
                    type="range"
                    data-testid="hook-duration-slider"
                    min={0.8}
                    max={4}
                    step={0.1}
                    value={hookDuration}
                    onChange={(e) => setHookDuration(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer accent-white"
                  />
                </div>
                {(hookOffsetX !== 0 || hookOffsetY !== 0) && (
                  <button
                    onClick={() => { setHookOffsetX(0); setHookOffsetY(0); }}
                    className="text-[10px] text-white/40 underline hover:text-white/70 transition"
                  >
                    Reset position
                  </button>
                )}
                <p className="text-[10px] text-white/30 italic">Drag the hook text on the preview to reposition</p>
              </div>
            </Section>

            {/* TikTok end card CTA */}
            <Section title="End card CTA (TikTok)" defaultOpen={true}>
              <div className="space-y-2" data-testid="cta-controls">
                <label className="flex items-center gap-2 text-[11px] text-white/60">
                  <input
                    type="checkbox"
                    data-testid="cta-toggle"
                    checked={ctaEnabled}
                    onChange={(e) => setCtaEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 accent-white"
                  />
                  Show lead-gen end card
                </label>
                <input
                  data-testid="cta-headline-input"
                  value={ctaHeadline}
                  onChange={(e) => setCtaHeadline(e.target.value)}
                  placeholder="Try it free — link in bio"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white outline-none transition hover:border-white/30 focus:border-white/60"
                />
                <input
                  data-testid="cta-handle-input"
                  value={ctaHandle}
                  onChange={(e) => setCtaHandle(e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white outline-none transition hover:border-white/30 focus:border-white/60"
                />
                <div>
                  <label className="text-[10px] text-white/40">Last {ctaDuration.toFixed(1)}s of the video</label>
                  <input
                    type="range"
                    data-testid="cta-duration-slider"
                    min={1}
                    max={5}
                    step={0.1}
                    value={ctaDuration}
                    onChange={(e) => setCtaDuration(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer accent-white"
                  />
                </div>
                {(ctaOffsetX !== 0 || ctaOffsetY !== 0) && (
                  <button
                    onClick={() => { setCtaOffsetX(0); setCtaOffsetY(0); }}
                    className="text-[10px] text-white/40 underline hover:text-white/70 transition"
                  >
                    Reset position
                  </button>
                )}
                <p className="text-[10px] text-white/30 italic">Drag the end card on the preview to reposition</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40">Accent</span>
                  {["#c8ff2e", "#ff4d8d", "#4dd8ff", "#ffffff"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      data-testid={`overlay-accent-${c.replace("#", "")}`}
                      onClick={() => setOverlayAccent(c)}
                      style={{ background: c }}
                      className={`h-5 w-5 rounded-full border-2 transition ${overlayAccent === c ? "border-white ring-1 ring-white" : "border-white/20 hover:border-white/50"}`}
                    />
                  ))}
                </div>
                <div className="text-[10px] leading-snug text-white/35">
                  Laid out inside TikTok's safe area — clear of the right icon rail and bottom caption strip.
                </div>
              </div>
            </Section>

            {/* Export Format */}
            <Section title="Export format">
              <select
                value={bg === "transparent" ? "webm" : exportFormat}
                disabled={bg === "transparent"}
                onChange={(e) => setExportFormat(e.target.value as "auto" | "mp4" | "webm")}
                className="w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/60 disabled:opacity-50"
                style={selectStyle}
              >
                <option value="auto" className="bg-[#1a1a22] text-white">Auto (MP4)</option>
                <option value="mp4" className="bg-[#1a1a22] text-white">MP4</option>
                <option value="webm" className="bg-[#1a1a22] text-white">WebM</option>
              </select>
            </Section>


            {/* Export Button */}
            <div className="pt-3">
              <button
                disabled={!videoUrl || recording}
                onClick={exportVideo}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
              >
                {recording
                  ? `Recording... ${Math.round(progress * 100)}%`
                  : bg === "transparent"
                    ? "Export transparent WebM"
                    : "Export MP4"}
              </button>
              {error && <div className="mt-2 rounded-lg bg-red-500/10 p-2 text-[11px] text-red-300">{error}</div>}
            </div>

          </aside>
          )}


          {/* Preview */}
          <main className="rounded-2xl border border-white/10 bg-[length:20px_20px] p-4"
            style={{
              backgroundImage: "linear-gradient(45deg, #1a1a22 25%, transparent 25%), linear-gradient(-45deg, #1a1a22 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a22 75%), linear-gradient(-45deg, transparent 75%, #1a1a22 75%)",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
              backgroundColor: "#101018",
            }}
          >
            <div className="mb-2 flex items-center justify-between text-[11px] text-white/50">
              <span>Live preview</span>
              <span>{PRESETS.find((p) => p.id === preset)?.label}</span>
            </div>
            <div className="flex w-full items-center justify-center overflow-hidden rounded-xl" style={{ height: "min(72vh, 660px)" }}>
              {videoUrl ? (
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-full max-w-full cursor-grab active:cursor-grabbing touch-none"
                  style={{ objectFit: "contain" }}
                  onPointerDown={(e) => {
                    const el = e.currentTarget;
                    el.setPointerCapture(e.pointerId);
                    const rect = el.getBoundingClientRect();
                    const startX = e.clientX;
                    const startY = e.clientY;

                    // Convert pointer position to canvas coords
                    const canvasW = el.width;
                    const canvasH = el.height;
                    const scaleX = canvasW / rect.width;
                    const scaleY = canvasH / rect.height;
                    const cx = (e.clientX - rect.left) * scaleX;
                    const cy = (e.clientY - rect.top) * scaleY;

                    // Hit-test overlays
                    const video = videoRef.current;
                    const vt = video ? video.currentTime : 0;
                    const dur = videoMeta?.d ?? 0;
                    const hookWindow = hookDuration + 0.28;
                    const ctaWindow = ctaDuration + 0.4;
                    const hookVisible = hookEnabled && vt <= hookWindow;
                    const ctaVisible = ctaEnabled && dur > 0 && (dur - vt) <= ctaWindow && (dur - vt) >= 0;

                    let dragTarget: "hook" | "cta" | "video" = "video";
                    if (hookVisible) {
                      const hb = getHookBounds(canvasW, canvasH, hookText, hookOffsetX, hookOffsetY);
                      if (hb && cx >= hb.x && cx <= hb.x + hb.w && cy >= hb.y && cy <= hb.y + hb.h) {
                        dragTarget = "hook";
                      }
                    }
                    if (ctaVisible && dragTarget === "video") {
                      const cb = getEndCardBounds(canvasW, canvasH, ctaHeadline, ctaHandle, ctaOffsetX, ctaOffsetY);
                      if (cb && cx >= cb.x && cx <= cb.x + cb.w && cy >= cb.y && cy <= cb.y + cb.h) {
                        dragTarget = "cta";
                      }
                    }

                    const startHookX = hookOffsetX;
                    const startHookY = hookOffsetY;
                    const startCtaX = ctaOffsetX;
                    const startCtaY = ctaOffsetY;
                    const isHand = viewMode === "hand";
                    const startOffX = isHand ? handPanX : videoOffsetX;
                    const startOffY = isHand ? handPanY : videoOffsetY;

                    const move = (ev: PointerEvent) => {
                      const dx = (ev.clientX - startX) / rect.width;
                      const dy = (ev.clientY - startY) / rect.height;
                      if (dragTarget === "hook") {
                        setHookOffsetX(startHookX + dx);
                        setHookOffsetY(startHookY + dy);
                      } else if (dragTarget === "cta") {
                        setCtaOffsetX(startCtaX + dx);
                        setCtaOffsetY(startCtaY + dy);
                      } else if (isHand) {
                        setHandPanX(startOffX + dx);
                        setHandPanY(startOffY + dy);
                      } else {
                        setVideoOffsetX(Math.max(-100, Math.min(100, Math.round(startOffX + dx * 200))));
                        setVideoOffsetY(Math.max(-100, Math.min(100, Math.round(startOffY + dy * 200))));
                      }
                    };
                    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    if (viewMode === "hand") {
                      setHandZoom((z) => Math.max(0.4, Math.min(3, +(z - e.deltaY * 0.0015).toFixed(3))));
                    } else {
                      setVideoScale((s) => Math.max(0.5, Math.min(3, +(s - e.deltaY * 0.002).toFixed(2))));
                    }
                  }}
                />
              ) : (
                <div className="text-white/40 text-sm">Upload a video to preview</div>
              )}
            </div>

            {/* Video Player Controls */}
            {videoUrl && videoMeta && (
              <div className="w-full mt-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur p-4 space-y-4">
                {/* Seek bar (top, full width, bigger hit area) */}
                <div className="relative group pt-1">
                  <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-white/80 to-white/60 transition-[width] duration-[50ms]"
                      style={{ width: `${videoMeta.d > 0 ? (currentTime / videoMeta.d) * 100 : 0}%` }}
                    />
                  </div>
                  {/* Playhead thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md shadow-black/30 border-2 border-white/90 transition-[left] duration-[50ms] pointer-events-none"
                    style={{ left: `calc(${videoMeta.d > 0 ? (currentTime / videoMeta.d) * 100 : 0}% - 7px)`, top: '9px' }}
                  />
                  {/* Zoom keyframe markers */}
                  {videoMeta.d > 0 && zoomKeyframes.map((kf) => (
                    <div
                      key={kf.id}
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm rotate-45 bg-amber-400 border border-amber-500 shadow shadow-amber-400/30"
                      style={{ left: `calc(${(kf.time / videoMeta.d) * 100}% - 6px)`, top: '9px' }}
                      title={`Zoom locked at ${formatTime(kf.time)}`}
                    />
                  ))}
                  <input
                    type="range"
                    min={0}
                    max={videoMeta.d || 1}
                    step={0.001}
                    value={currentTime}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onPointerDown={() => setIsSeeking(true)}
                    onPointerUp={() => setIsSeeking(false)}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  />
                </div>

                {/* Play/Pause + Time + Duration */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayPause}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all shadow-sm"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                        <rect x="3" y="2" width="4" height="12" rx="1" />
                        <rect x="9" y="2" width="4" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                        <path d="M4 2v12l10-6L4 2z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-mono text-white/90 tabular-nums tracking-tight">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-[11px] text-white/40">/</span>
                    <span className="text-[11px] font-mono text-white/40 tabular-nums">
                      {formatTime(videoMeta.d)}
                    </span>
                  </div>
                  {/* Frame skip buttons */}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => handleSeek(Math.max(0, currentTime - 1 / 30))}
                      className="w-7 h-7 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition text-white/50 hover:text-white/80"
                      title="Back 1 frame"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M6 1L2 5l4 4V1z"/></svg>
                    </button>
                    <button
                      onClick={() => handleSeek(Math.min(videoMeta.d, currentTime + 1 / 30))}
                      className="w-7 h-7 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition text-white/50 hover:text-white/80"
                      title="Forward 1 frame"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M4 1l4 4-4 4V1z"/></svg>
                    </button>
                    <button
                      onClick={() => handleSeek(Math.max(0, currentTime - 1))}
                      className="w-7 h-7 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition text-white/50 hover:text-white/80 text-[10px] font-medium"
                      title="Back 1 second"
                    >
                      -1s
                    </button>
                    <button
                      onClick={() => handleSeek(Math.min(videoMeta.d, currentTime + 1))}
                      className="w-7 h-7 rounded-md bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center transition text-white/50 hover:text-white/80 text-[10px] font-medium"
                      title="Forward 1 second"
                    >
                      +1s
                    </button>
                  </div>
                </div>

                {/* Zoom Lock Section — supports multiple keyframes across the video */}
                <div className="pt-3 border-t border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[12px] text-white/80 font-medium leading-tight">Zoom Lock</span>
                        {zoomKeyframes.length > 0 && (
                          <span className="text-[10px] text-white/40 leading-tight">
                            {zoomKeyframes.length} {zoomKeyframes.length === 1 ? "keyframe" : "keyframes"} set
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={captureZoomLock}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 active:scale-95 transition-all font-medium shadow-sm"
                      >
                        + Lock at {formatTime(currentTime)}
                      </button>
                      {zoomKeyframes.length > 0 && (
                        <button
                          onClick={clearZoomKeyframes}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-white/40 hover:bg-red-500/20 hover:text-red-300 transition-all"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  {zoomKeyframes.length > 0 && (
                    <div className="space-y-1.5">
                      {/* Default zone indicator */}
                      <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.04]">
                        <div className="w-2 h-2 rounded-full bg-white/30 flex-shrink-0" />
                        <span className="text-[11px] text-white/40 flex-1">Default zoom (0:00.0 → {formatTime([...zoomKeyframes].sort((a, b) => a.time - b.time)[0].time)})</span>
                      </div>
                      {[...zoomKeyframes].sort((a, b) => a.time - b.time).map((kf, idx, sorted) => {
                        const nextTime = sorted[idx + 1]?.time ?? videoMeta.d;
                        return (
                          <div key={kf.id} className="flex items-center gap-2 rounded-lg bg-amber-500/[0.06] px-3 py-2 border border-amber-500/[0.12] group">
                            <div className="w-2 h-2 rounded-sm rotate-45 bg-amber-400 flex-shrink-0" />
                            <button
                              onClick={() => handleSeek(kf.time)}
                              className="text-[11px] text-white/70 hover:text-white transition tabular-nums flex-1 text-left font-mono"
                              title="Jump to this keyframe"
                            >
                              {formatTime(kf.time)} → {formatTime(nextTime)} &bull; {kf.scale.toFixed(2)}x
                            </button>
                            <button
                              onClick={() => removeZoomKeyframe(kf.id)}
                              className="text-[10px] text-white/30 hover:text-red-400 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                              title="Remove this keyframe"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-white/25 pt-1">
                        Seek → adjust zoom → click Lock to add a keyframe. Each keyframe applies until the next one.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <video ref={videoRef} className="hidden" playsInline muted loop autoPlay />


            {result && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>Export ready</span>
                  <span>{result.mime.includes("mp4") ? "MP4" : "WebM"} &bull; {(result.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <video key={result.url} src={result.url} controls loop playsInline preload="auto" className="w-full rounded-lg border border-white/10 bg-black" />
                <a href={result.url} download={result.name} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90">
                  <span className="truncate">Download {result.name}</span>
                  <span className="ml-3 text-xs">↓</span>
                </a>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}


function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
    if (Math.abs(video.currentTime - time) < 0.02) requestAnimationFrame(done);
  });
}

function drawPhone(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  dev: DeviceSpec,
  video: HTMLVideoElement,
  videoFit: "cover" | "contain" | "fill",
  videoScale: number,
  videoOffsetX: number,
  videoOffsetY: number,
  frameColor: "black" | "white" = "black",
) {
  const radius = w * dev.radiusRatio;
  const bezel = w * dev.bezelRatio;

  // Override body and rail colors when white frame is selected
  const bodyColor = frameColor === "white" ? "#f0f0f2" : dev.body;
  const railColor = frameColor === "white" ? "#d8d8dc" : dev.rail;

  ctx.save();

  // Shadow
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.shadowColor = frameColor === "white" ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.55)";
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.04;
  ctx.fillStyle = frameColor === "white" ? "#e0e0e4" : "#000";
  ctx.fill();
  ctx.restore();


  // Outer rail
  const railGrad = ctx.createLinearGradient(x, y, x + w, y);
  railGrad.addColorStop(0, shade(railColor, -25));
  railGrad.addColorStop(0.15, railColor);
  railGrad.addColorStop(0.5, shade(railColor, 20));
  railGrad.addColorStop(0.85, railColor);
  railGrad.addColorStop(1, shade(railColor, -25));
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = railGrad;
  ctx.fill();

  // Inner body
  const bx = x + w * 0.012;
  const by = y + w * 0.012;
  const bw = w - w * 0.024;
  const bh = h - w * 0.024;
  const br = Math.max(0, radius - w * 0.012);
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.fillStyle = bodyColor;
  ctx.fill();

  // Highlight
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.clip();
  const hi = ctx.createLinearGradient(0, by, 0, by + bh * 0.25);
  hi.addColorStop(0, "rgba(255,255,255,0.10)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(bx, by, bw, bh * 0.25);
  ctx.restore();

  // Buttons
  ctx.fillStyle = shade(railColor, -10);
  ctx.fillRect(x + w - w * 0.008, y + h * 0.18, w * 0.012, h * 0.06);
  ctx.fillRect(x - w * 0.004, y + h * 0.16, w * 0.012, h * 0.05);
  ctx.fillRect(x - w * 0.004, y + h * 0.235, w * 0.012, w * 0.06);


  // Screen
  const sx = bx + bezel;
  const sy = by + bezel;
  const sw = bw - bezel * 2;
  const sh = bh - bezel * 2;
  const sr = Math.max(0, br - bezel * 0.85);
  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);

  if (video.readyState >= 2) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let baseScale: number;
    if (videoFit === "contain") baseScale = Math.min(sw / vw, sh / vh);
    else baseScale = Math.max(sw / vw, sh / vh);
    const s = baseScale * videoScale;
    const dw = vw * s;
    const dh = vh * s;
    const maxOffX = Math.max(0, (dw - sw) / 2);
    const maxOffY = Math.max(0, (dh - sh) / 2);
    const offX = (videoOffsetX / 100) * maxOffX;
    const offY = (videoOffsetY / 100) * maxOffY;
    const dx = sx + (sw - dw) / 2 + offX;
    const dy = sy + (sh - dh) / 2 + offY;
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  // Camera cutout
  ctx.fillStyle = "#000";
  if (dev.camera === "punch-center") {
    const r = sw * 0.022;
    ctx.beginPath(); ctx.arc(sx + sw / 2, sy + r * 1.7, r, 0, Math.PI * 2); ctx.fill();
  } else if (dev.camera === "punch-left") {
    const r = sw * 0.022;
    ctx.beginPath(); ctx.arc(sx + sw * 0.12, sy + r * 1.7, r, 0, Math.PI * 2); ctx.fill();
  } else if (dev.camera === "notch-drop") {
    const r = sw * 0.028;
    roundRect(ctx, sx + sw / 2 - r, sy, r * 2, r * 1.6, r); ctx.fill();
  } else if (dev.camera === "notch-wide") {
    const nw = sw * 0.34; const nh = sh * 0.028;
    roundRect(ctx, sx + (sw - nw) / 2, sy, nw, nh, nh * 0.6); ctx.fill();
  }
  ctx.restore();

  // Glass sheen
  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  const sheen = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(0.4, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(sx, sy, sw, sh);
  ctx.restore();

  ctx.restore();
}


function shade(hex: string, percent: number) {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

