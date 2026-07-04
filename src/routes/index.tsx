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

type DeviceId =
  | "s24"
  | "s24_ultra"
  | "note20"
  | "zflip"
  | "lg_v60"
  | "lg_velvet"
  | "lg_g8";

type DeviceSpec = {
  id: DeviceId;
  label: string;
  body: string; // bezel/frame color
  rail: string; // side metal rail color
  aspect: number; // width / height of phone body
  radiusRatio: number; // corner radius as fraction of width
  bezelRatio: number; // screen inset as fraction of width
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
  const [device, setDevice] = useState<DeviceId>("s24");
  const [preset, setPreset] = useState<PresetId>("tiktok");
  const [bg, setBg] = useState<BgId>("transparent");
  const [customColor, setCustomColor] = useState("#0b0b0f");
  const [scale, setScale] = useState(0.82);
  const [videoFit, setVideoFit] = useState<"cover" | "contain" | "fill">("cover");
  const [videoScale, setVideoScale] = useState(1);
  const [videoOffsetX, setVideoOffsetX] = useState(0);
  const [videoOffsetY, setVideoOffsetY] = useState(0);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

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

    // Phone uses its own realistic body aspect, not the video's aspect.
    // Base height in pixels; width derived from device aspect.
    const phoneH = 1800;
    const phoneW = phoneH * dev.aspect;


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
      drawPhone(ctx, x, y, drawW, drawH, dev, video, videoFit, videoScale, videoOffsetX, videoOffsetY);
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
    setResult(null);

    try {
      // Pick best codec: opaque exports prefer mp4 (TikTok/LinkedIn-ready); transparent needs webm vp9 alpha
      const transparent = bg === "transparent";
      const candidates = transparent
        ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        : [
            "video/mp4;codecs=avc1.42E01F",
            "video/mp4;codecs=h264",
            "video/mp4",
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8",
            "video/webm",
          ];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error("Your browser does not support video recording.");
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

      const stream = canvas.captureStream(30);

      // Mix the uploaded video's audio into the recording via WebAudio
      try {
        if (!audioCtxRef.current) {
          const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
          audioCtxRef.current = new Ctx();
        }
        const ac = audioCtxRef.current!;
        if (ac.state === "suspended") await ac.resume();
        if (!audioSrcRef.current) {
          // createMediaElementSource can only be called once per element
          audioSrcRef.current = ac.createMediaElementSource(video);
        }
        if (!audioDestRef.current) {
          audioDestRef.current = ac.createMediaStreamDestination();
          audioSrcRef.current.connect(audioDestRef.current);
          // Also route to speakers so the user can hear during export
          audioSrcRef.current.connect(ac.destination);
        }
        for (const track of audioDestRef.current.stream.getAudioTracks()) {
          stream.addTrack(track);
        }
      } catch (audioErr) {
        // Audio capture is best-effort; continue with video-only if it fails
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

      video.currentTime = 0;
      video.muted = false;
      video.volume = 1;
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
      const name = `mockreel-${device}-${pre.id}-${canvas.width}x${canvas.height}.${ext}`;
      setResult({ url, name, size: blob.size, mime });
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
              <label htmlFor="device-select" className="text-xs uppercase tracking-widest text-white/50">
                2. Device frame
              </label>
              <select
                id="device-select"
                value={device}
                onChange={(e) => setDevice(e.target.value as DeviceId)}
                className="mt-3 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/60"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='white' d='M6 8L0 0h12z'/></svg>\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: "32px",
                }}
              >
                {DEVICES.map((d) => (
                  <option key={d.id} value={d.id} className="bg-[#1a1a22] text-white">
                    {d.label}
                  </option>
                ))}
              </select>
            </section>

            <section>
              <label htmlFor="preset-select" className="text-xs uppercase tracking-widest text-white/50">
                3. Platform preset
              </label>
              <select
                id="preset-select"
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetId)}
                className="mt-3 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition hover:border-white/30 focus:border-white/60"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='white' d='M6 8L0 0h12z'/></svg>\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: "32px",
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1a22] text-white">
                    {p.label} — {p.id === "source" ? "auto" : `${p.w}×${p.h}`}
                  </option>
                ))}
              </select>
            </section>


            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">4. Background</label>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBg(b.id)}
                    title={b.label}
                    className={`group relative aspect-square overflow-hidden rounded-lg border transition ${
                      bg === b.id ? "border-white ring-2 ring-white" : "border-white/15 hover:border-white/40"
                    }`}
                    style={
                      b.preview === "transparent"
                        ? {
                            backgroundImage:
                              "linear-gradient(45deg,#666 25%,transparent 25%),linear-gradient(-45deg,#666 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#666 75%),linear-gradient(-45deg,transparent 75%,#666 75%)",
                            backgroundSize: "10px 10px",
                            backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
                            backgroundColor: "#222",
                          }
                        : b.preview === "custom"
                          ? { background: customColor }
                          : { background: b.preview }
                    }
                  />
                ))}
              </div>
              {bg === "custom" && (
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="mt-2 h-9 w-full cursor-pointer rounded-lg bg-transparent"
                />
              )}
            </section>

            <section>
              <label className="text-xs uppercase tracking-widest text-white/50">
                5. Phone size ({Math.round(scale * 100)}%)
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
              {recording
                ? `Recording… ${Math.round(progress * 100)}%`
                : bg === "transparent"
                  ? "Export transparent WebM"
                  : "Export MP4 (ready to post)"}
            </button>
            {error && <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
            <p className="text-[11px] leading-relaxed text-white/40">
              {bg === "transparent"
                ? "Transparent WebM (VP9 alpha). Great for layering — note that TikTok and LinkedIn flatten alpha to black on upload. Pick a background to get a post-ready MP4 instead."
                : "Recorded as MP4 (H.264) when your browser supports it, otherwise WebM. Upload directly to TikTok, LinkedIn, Reels, etc."}
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

            {result && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-white/50">Your export — preview & download</div>
                  <div className="text-xs text-white/40">
                    {result.mime.includes("mp4") ? "MP4" : "WebM"} • {(result.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <video
                  key={result.url}
                  src={result.url}
                  controls
                  loop
                  muted
                  playsInline
                  preload="auto"
                  autoPlay
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    try { el.currentTime = 0.001; } catch {}
                  }}
                  onLoadedData={(e) => {
                    const el = e.currentTarget;
                    try { el.currentTime = 0.001; } catch {}
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black"
                />
                <a
                  href={result.url}
                  download={result.name}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
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

function drawPhone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dev: DeviceSpec,
  video: HTMLVideoElement,
) {
  const radius = w * dev.radiusRatio;
  const bezel = w * dev.bezelRatio;

  ctx.save();

  // Soft drop shadow under phone
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.04;
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // Outer rail (metal frame) — slight gradient for realism
  const railGrad = ctx.createLinearGradient(x, y, x + w, y);
  railGrad.addColorStop(0, shade(dev.rail, -25));
  railGrad.addColorStop(0.15, dev.rail);
  railGrad.addColorStop(0.5, shade(dev.rail, 20));
  railGrad.addColorStop(0.85, dev.rail);
  railGrad.addColorStop(1, shade(dev.rail, -25));
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = railGrad;
  ctx.fill();

  // Inner body (slightly inset, darker)
  const bx = x + w * 0.012;
  const by = y + w * 0.012;
  const bw = w - w * 0.024;
  const bh = h - w * 0.024;
  const br = Math.max(0, radius - w * 0.012);
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.fillStyle = dev.body;
  ctx.fill();

  // Subtle highlight on top edge
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, br);
  ctx.clip();
  const hi = ctx.createLinearGradient(0, by, 0, by + bh * 0.25);
  hi.addColorStop(0, "rgba(255,255,255,0.10)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(bx, by, bw, bh * 0.25);
  ctx.restore();

  // Side buttons (right: power; left: volume up/down)
  ctx.fillStyle = shade(dev.rail, -10);
  // Power
  ctx.fillRect(x + w - w * 0.008, y + h * 0.18, w * 0.012, h * 0.06);
  // Volume up
  ctx.fillRect(x - w * 0.004, y + h * 0.16, w * 0.012, h * 0.05);
  // Volume down
  ctx.fillRect(x - w * 0.004, y + h * 0.235, w * 0.012, w * 0.06);

  // Screen area
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

  // Video fills the screen (cover)
  if (video.readyState >= 2) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const s = Math.max(sw / vw, sh / vh);
    const dw = vw * s;
    const dh = vh * s;
    ctx.drawImage(video, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
  }

  // Camera cutout, drawn inside the clipped screen
  ctx.fillStyle = "#000";
  if (dev.camera === "punch-center") {
    const r = sw * 0.022;
    ctx.beginPath();
    ctx.arc(sx + sw / 2, sy + r * 1.7, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (dev.camera === "punch-left") {
    const r = sw * 0.022;
    ctx.beginPath();
    ctx.arc(sx + sw * 0.12, sy + r * 1.7, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (dev.camera === "punch-corner") {
    const r = sw * 0.024;
    ctx.beginPath();
    ctx.arc(sx + sw - r * 2.2, sy + r * 1.7, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (dev.camera === "notch-drop") {
    const r = sw * 0.028;
    roundRect(ctx, sx + sw / 2 - r, sy, r * 2, r * 1.6, r);
    ctx.fill();
  } else if (dev.camera === "notch-wide") {
    const nw = sw * 0.34;
    const nh = sh * 0.028;
    roundRect(ctx, sx + (sw - nw) / 2, sy, nw, nh, nh * 0.6);
    ctx.fill();
  }

  ctx.restore();

  // Glass reflection sheen across screen edge
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

function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bg: BgId,
  custom: string,
) {
  if (bg === "transparent") return;
  let fill: string | CanvasGradient = custom;
  if (bg === "white") fill = "#ffffff";
  else if (bg === "black") fill = "#000000";
  else if (bg === "sunset") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#ff6a3d");
    g.addColorStop(1, "#f9c846");
    fill = g;
  } else if (bg === "ocean") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0ea5e9");
    g.addColorStop(1, "#1e3a8a");
    fill = g;
  } else if (bg === "violet") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#7c3aed");
    g.addColorStop(1, "#ec4899");
    fill = g;
  } else if (bg === "custom") {
    fill = custom;
  }
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
}
