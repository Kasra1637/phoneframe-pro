import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MockReel — Phone Mockup Video Generator" },
      {
        name: "description",
        content:
          "Drop a screen recording into a clean phone mockup and export transparent videos sized for TikTok, LinkedIn, and more.",
      },
      { property: "og:title", content: "MockReel — Phone Mockup Video Generator" },
      {
        property: "og:description",
        content:
          "Drop a screen recording into a clean phone mockup and export transparent videos sized for TikTok, LinkedIn, and more.",
      },
    ],
  }),
  component: Index,
});

type DeviceId = "iphone" | "pixel";
type PresetId = "tiktok" | "linkedin_square" | "linkedin_landscape" | "story" | "youtube" | "source";

const DEVICES: { id: DeviceId; label: string; bezel: string; screenInset: number; radius: number }[] = [
  { id: "iphone", label: "iPhone (Black)", bezel: "#0a0a0a", screenInset: 18, radius: 110 },
  { id: "pixel", label: "Google Pixel (Graphite)", bezel: "#1c1c1e", screenInset: 14, radius: 70 },
];

const PRESETS: { id: PresetId; label: string; w: number; h: number; note: string }[] = [
  { id: "tiktok", label: "TikTok / Reels / Shorts", w: 1080, h: 1920, note: "9:16" },
  { id: "story", label: "Instagram Story", w: 1080, h: 1920, note: "9:16" },
  { id: "linkedin_square", label: "LinkedIn Square", w: 1200, h: 1200, note: "1:1" },
  { id: "linkedin_landscape", label: "LinkedIn Landscape", w: 1920, h: 1080, note: "16:9" },
  { id: "youtube", label: "YouTube 1080p", w: 1920, h: 1080, note: "16:9" },
  { id: "source", label: "Tight crop (phone only)", w: 0, h: 0, note: "auto" },
];

type BgId = "transparent" | "white" | "black" | "sunset" | "ocean" | "violet" | "custom";
const BACKGROUNDS: { id: BgId; label: string; preview: string }[] = [
  { id: "transparent", label: "Transparent (WebM)", preview: "transparent" },
  { id: "white", label: "White", preview: "#ffffff" },
  { id: "black", label: "Black", preview: "#000000" },
  { id: "sunset", label: "Sunset", preview: "linear-gradient(135deg,#ff6a3d,#f9c846)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#0ea5e9,#1e3a8a)" },
  { id: "violet", label: "Violet", preview: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  { id: "custom", label: "Custom color", preview: "custom" },
];

function Index() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ w: number; h: number; d: number } | null>(null);
  const [device, setDevice] = useState<DeviceId>("iphone");
  const [preset, setPreset] = useState<PresetId>("tiktok");
  const [bg, setBg] = useState<BgId>("transparent");
  const [customColor, setCustomColor] = useState("#0b0b0f");
  const [scale, setScale] = useState(0.82);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    setResult(null);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  // Probe metadata
  useEffect(() => {
    if (!videoUrl) return;
    const v = document.createElement("video");
    v.src = videoUrl;
    v.muted = true;
    v.onloadedmetadata = () => {
      setVideoMeta({ w: v.videoWidth, h: v.videoHeight, d: v.duration });
    };
  }, [videoUrl]);

  // Preview loop
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !videoMeta) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dev = DEVICES.find((d) => d.id === device)!;
    const pre = PRESETS.find((p) => p.id === preset)!;

    // Phone aspect: derive from video (assume portrait screen recording = phone aspect)
    const screenAspect = videoMeta.w / videoMeta.h;
    // Phone outer = screen + bezel
    const bezel = dev.screenInset;
    const phoneScreenW = videoMeta.w;
    const phoneScreenH = videoMeta.h;
    const phoneW = phoneScreenW + bezel * 2 * (phoneScreenW / 400);
    const phoneH = phoneScreenH + bezel * 2 * (phoneScreenH / 400);

    let cw = pre.w;
    let ch = pre.h;
    if (pre.id === "source") {
      cw = Math.round(phoneW);
      ch = Math.round(phoneH);
    }
    canvas.width = cw;
    canvas.height = ch;

    const draw = () => {
      ctx.clearRect(0, 0, cw, ch);
      paintBackground(ctx, cw, ch, bg, customColor);
      // fit phone into canvas with user scale
      const fit = Math.min(cw / phoneW, ch / phoneH) * scale;
      const drawW = phoneW * fit;
      const drawH = phoneH * fit;
      const x = (cw - drawW) / 2;
      const y = (ch - drawH) / 2;
      drawPhone(ctx, x, y, drawW, drawH, dev, video);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [device, preset, scale, videoMeta, bg, customColor]);

  const exportVideo = async () => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !videoMeta) return;

    setError(null);
    setRecording(true);
    setProgress(0);

    try {
      // Find supported transparent webm codec
      const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error("Your browser does not support WebM recording.");

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

      const done = new Promise<Blob>((res) => {
        recorder.onstop = () => res(new Blob(chunks, { type: mime }));
      });

      video.currentTime = 0;
      video.muted = true;
      await video.play();
      recorder.start();

      const duration = videoMeta.d;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          const elapsed = (performance.now() - start) / 1000;
          setProgress(Math.min(1, elapsed / duration));
          if (video.ended || elapsed >= duration) {
            resolve();
          } else {
            requestAnimationFrame(tick);
          }
        };
        tick();
      });

      recorder.stop();
      video.pause();
      const blob = await done;
      const url = URL.createObjectURL(blob);
      const pre = PRESETS.find((p) => p.id === preset)!;
      const name = `mockreel-${device}-${pre.id}-${canvas.width}x${canvas.height}.webm`;
      setDownloads((d) => [{ url, name, size: blob.size }, ...d]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRecording(false);
      setProgress(0);
    }
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
      <div className="relative mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-white/50">MockReel</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
            Drop a screen recording. Get a transparent phone mockup video.
          </h1>
          <p className="mt-3 max-w-2xl text-white/60">
            Upload your phone screen recording, choose a device frame, pick a platform preset, and export a transparent
            WebM ready for TikTok, LinkedIn, Reels, and more.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Controls */}
          <aside className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">1. Upload recording</label>
              <label
                className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center transition hover:border-white/40 hover:bg-white/[0.05]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
              >
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="text-sm text-white/80">{videoUrl ? "Replace video" : "Click or drop a video"}</div>
                <div className="mt-1 text-xs text-white/40">MP4, MOV, WebM — portrait recommended</div>
              </label>
              {videoMeta && (
                <div className="mt-2 text-xs text-white/50">
                  {videoMeta.w}×{videoMeta.h} • {videoMeta.d.toFixed(1)}s
                </div>
              )}
            </section>

            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">2. Device frame</label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEVICES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDevice(d.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      device === d.id
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">3. Platform preset</label>
              <div className="mt-3 grid gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      preset === p.id
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.02] text-white/80 hover:border-white/30"
                    }`}
                  >
                    <span>{p.label}</span>
                    <span className={preset === p.id ? "text-black/60" : "text-white/40"}>
                      {p.id === "source" ? "auto" : `${p.w}×${p.h}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">
                4. Phone size ({Math.round(scale * 100)}%)
              </label>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="mt-3 w-full accent-white"
              />
            </section>

            <button
              disabled={!videoUrl || recording}
              onClick={exportVideo}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-40"
            >
              {recording ? `Recording… ${Math.round(progress * 100)}%` : "Export transparent WebM"}
            </button>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
            <p className="text-[11px] leading-relaxed text-white/40">
              Output is WebM with an alpha channel (VP9/VP8). TikTok and LinkedIn don't preserve transparency on upload —
              the alpha is for compositing in CapCut, Premiere, After Effects, etc. before posting.
            </p>
          </aside>

          {/* Preview */}
          <main className="rounded-3xl border border-white/10 bg-[length:20px_20px] p-6"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #1a1a22 25%, transparent 25%), linear-gradient(-45deg, #1a1a22 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a22 75%), linear-gradient(-45deg, transparent 75%, #1a1a22 75%)",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
              backgroundColor: "#101018",
            }}
          >
            <div className="mb-3 flex items-center justify-between text-xs text-white/50">
              <span>Live preview (checkerboard = transparent)</span>
              <span>
                {PRESETS.find((p) => p.id === preset)?.label}
                {previewCanvasRef.current
                  ? ` • ${previewCanvasRef.current.width}×${previewCanvasRef.current.height}`
                  : ""}
              </span>
            </div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl">
              {videoUrl ? (
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-full max-w-full"
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <div className="text-white/40">Upload a video to preview the mockup</div>
              )}
            </div>

            <video
              ref={videoRef}
              src={videoUrl ?? undefined}
              className="hidden"
              playsInline
              muted
              loop
              autoPlay
              crossOrigin="anonymous"
            />

            {downloads.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="text-xs uppercase tracking-widest text-white/50">Exports</div>
                {downloads.map((d) => (
                  <a
                    key={d.url}
                    href={d.url}
                    download={d.name}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/90 transition hover:border-white/30"
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="ml-3 text-xs text-white/50">{(d.size / 1024 / 1024).toFixed(2)} MB ↓</span>
                  </a>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function drawPhone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dev: { id: DeviceId; bezel: string; radius: number },
  video: HTMLVideoElement,
) {
  const radius = Math.min(w, h) * (dev.id === "iphone" ? 0.11 : 0.075);
  const bezel = Math.min(w, h) * 0.035;

  ctx.save();
  // outer body
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = dev.bezel;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = Math.min(w, h) * 0.04;
  ctx.shadowOffsetY = Math.min(w, h) * 0.01;
  ctx.fill();
  ctx.shadowColor = "transparent";

  // subtle metallic edge
  ctx.lineWidth = Math.max(1, bezel * 0.15);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();

  // screen area
  const sx = x + bezel;
  const sy = y + bezel;
  const sw = w - bezel * 2;
  const sh = h - bezel * 2;
  const sr = Math.max(0, radius - bezel * 0.9);
  ctx.save();
  roundRect(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);

  // draw video to fill screen (cover)
  if (video.readyState >= 2) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(sw / vw, sh / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
  }
  ctx.restore();

  // device chrome on top of screen
  if (dev.id === "iphone") {
    // Dynamic Island
    const islandW = sw * 0.32;
    const islandH = sh * 0.035;
    const ix = sx + (sw - islandW) / 2;
    const iy = sy + sh * 0.018;
    roundRect(ctx, ix, iy, islandW, islandH, islandH / 2);
    ctx.fillStyle = "#000";
    ctx.fill();
  } else {
    // Pixel: punch-hole camera centered top
    const r = sh * 0.012;
    ctx.beginPath();
    ctx.arc(sx + sw / 2, sy + sh * 0.025, r, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
  }

  ctx.restore();
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
