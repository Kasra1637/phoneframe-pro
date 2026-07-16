import { useEffect, useRef, useState } from "react";
import handHoldDeskImg from "@/assets/hand-hold-desk.jpg";
import handHoldParkImg from "@/assets/hand-hold-park.jpg";
import handHoldLivingImg from "@/assets/hand-hold-livingroom.jpg";

// Phone rect within each hand-hold reference photo (fractions of image w/h).
const HAND_IMG_ASPECT = 1024 / 1600;
const HAND_BG_SRC: Record<string, string> = {
  hand_park: handHoldParkImg,
  hand_living: handHoldLivingImg,
  hand_desk: handHoldDeskImg,
};

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

type BgId = "transparent" | "white" | "black" | "sunset" | "ocean" | "violet" | "custom" | "hand_park" | "hand_living" | "hand_desk";
const BACKGROUNDS: { id: BgId; label: string; preview: string }[] = [
  { id: "transparent", label: "Transparent (WebM)", preview: "transparent" },
  { id: "white", label: "White", preview: "#ffffff" },
  { id: "black", label: "Black", preview: "#000000" },
  { id: "sunset", label: "Sunset", preview: "linear-gradient(135deg,#ff6a3d,#f9c846)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#0ea5e9,#1e3a8a)" },
  { id: "violet", label: "Violet", preview: "linear-gradient(135deg,#7c3aed,#ec4899)" },
  { id: "hand_park", label: "Hand — Sunny park", preview: `url(${handHoldParkImg})` },
  { id: "hand_living", label: "Hand — Living room", preview: `url(${handHoldLivingImg})` },
  { id: "hand_desk", label: "Hand — Desk", preview: `url(${handHoldDeskImg})` },
  { id: "custom", label: "Custom color", preview: "custom" },
];


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
  const [preset, setPreset] = useState<PresetId>("tiktok");
  const [bg, setBg] = useState<BgId>("white");
  const [customColor, setCustomColor] = useState("#0b0b0f");
  const [scale, setScale] = useState(0.82);
  const [mockupStretchY, setMockupStretchY] = useState(1);
  const [videoFit, setVideoFit] = useState<"cover" | "contain" | "fill">("cover");
  const [videoScale, setVideoScale] = useState(1);
  const [videoOffsetX, setVideoOffsetX] = useState(0);
  const [videoOffsetY, setVideoOffsetY] = useState(0);
  const [handOffsetX, setHandOffsetX] = useState(0);
  const [handOffsetY, setHandOffsetY] = useState(0);
  const [handZoom, setHandZoom] = useState(1);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; size: number; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"auto" | "mp4" | "webm">("auto");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSrcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const handImgRefs = useRef<Record<string, HTMLImageElement>>({});


  useEffect(() => {
    Object.entries(HAND_BG_SRC).forEach(([key, src]) => {
      if (handImgRefs.current[key]) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => { handImgRefs.current[key] = img; };
    });
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
    // Also ensure the ref video element starts playing once source is set
    const refVideo = videoRef.current;
    if (refVideo) {
      refVideo.src = videoUrl;
      refVideo.muted = true;
      refVideo.loop = true;
      refVideo.playsInline = true;
      refVideo.load();
      refVideo.play().catch(() => {});
    }
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

    const draw = () => {
      ctx.clearRect(0, 0, cw, ch);

      const handImgActive = bg.startsWith("hand_") ? handImgRefs.current[bg] : null;
      if (handImgActive) {
        const handImg = handImgActive;

        // Subtle handheld shake
        const t = performance.now() / 1000;
        const shakeAmt = Math.min(cw, ch) * 0.003;
        const sx = Math.sin(t * 2.1) * shakeAmt + Math.sin(t * 5.7) * shakeAmt * 0.3;
        const sy = Math.cos(t * 1.7) * shakeAmt + Math.cos(t * 6.3) * shakeAmt * 0.3;
        const sr = Math.sin(t * 1.1) * 0.003;

        ctx.save();
        ctx.translate(cw / 2 + sx, ch / 2 + sy);
        ctx.rotate(sr);
        ctx.translate(-cw / 2, -ch / 2);

        // --- Compositing: real hand + app device frame ---
        // Strategy: Draw the hand image, then PAINT OVER the photo's phone
        // area completely, then draw the app's device frame on top.
        // Finally, re-draw ONLY the finger edges on top of the device.

        // Step 1: Fill background
        ctx.fillStyle = "#f5f0eb";
        ctx.fillRect(0, 0, cw, ch);

        // Step 2: Compute hand image placement (cover the canvas)
        const canvasAspect = cw / ch;
        let hw: number, hh: number;
        if (canvasAspect > HAND_IMG_ASPECT) {
          hw = cw;
          hh = cw / HAND_IMG_ASPECT;
        } else {
          hh = ch;
          hw = ch * HAND_IMG_ASPECT;
        }
        hw *= handZoom;
        hh *= handZoom;
        const hx = (cw - hw) / 2 + handOffsetX * cw;
        const hy = (ch - hh) / 2 + handOffsetY * ch;

        // Step 3: Calculate device frame position
        const phoneFit = Math.min(cw / phoneW, ch / phoneH) * scale * 0.75;
        const drawW = phoneW * phoneFit;
        const drawH = phoneH * phoneFit;
        const phoneX = (cw - drawW) / 2;
        const phoneY = (ch - drawH) / 2;

        // Step 4: Draw the full hand image
        ctx.drawImage(handImg, hx, hy, hw, hh);

        // Step 5: COVER the photo's phone screen area completely.
        // The photo's phone occupies a region in the center of the image.
        // We paint over it with the background scene (sampled from the
        // edges of the image) using a solid fill that matches the 
        // surrounding scene. This erases the photo's phone entirely.
        // We use a slightly oversized rectangle to ensure full coverage.
        const coverPad = drawW * 0.08; // extra padding to cover photo phone edges
        const coverX = phoneX - coverPad;
        const coverY = phoneY - coverPad;
        const coverW = drawW + coverPad * 2;
        const coverH = drawH + coverPad * 2;
        const coverR = drawW * dev.radiusRatio + coverPad;

        // Sample the average background color from the hand image edges
        // and use it to paint over the phone area seamlessly.
        // For simplicity, use the neutral background fill.
        ctx.save();
        roundRect(ctx, coverX, coverY, coverW, coverH, coverR);
        ctx.clip();
        // Re-fill with background color to erase the photo's phone
        ctx.fillStyle = "#f5f0eb";
        ctx.fillRect(coverX, coverY, coverW, coverH);
        ctx.restore();

        // Step 6: Draw the app's proper device frame (with bezels, rail,
        // camera cutout, buttons, glass sheen) with the video inside.
        drawPhone(ctx, phoneX, phoneY, drawW, drawH, dev, video, videoFit, videoScale, videoOffsetX, videoOffsetY);

        // Step 7: Re-draw the hand's fingers ON TOP of the device frame.
        // ONLY draw in narrow strips along the edges where real fingers
        // would overlap. Do NOT re-expose the photo's phone screen.
        ctx.save();
        ctx.beginPath();

        // Thumb — narrow strip along the left bezel only
        ctx.rect(phoneX - drawW * 0.04, phoneY + drawH * 0.50, drawW * 0.08, drawH * 0.45);

        // Fingers — narrow strip along the right edge only
        ctx.rect(phoneX + drawW * 0.96, phoneY + drawH * 0.18, drawW * 0.12, drawH * 0.65);

        // Bottom palm/wrist below the phone
        ctx.rect(phoneX - drawW * 0.15, phoneY + drawH * 0.94, drawW * 1.3, ch - (phoneY + drawH * 0.94));

        ctx.clip();
        ctx.drawImage(handImg, hx, hy, hw, hh);
        ctx.restore();

        ctx.restore();

      } else {
        paintBackground(ctx, cw, ch, bg, customColor);
        const fit = Math.min(cw / phoneW, ch / phoneH) * scale;
        const drawW = phoneW * fit;
        const drawH = phoneH * fit;
        const x = (cw - drawW) / 2;
        const y = (ch - drawH) / 2;
        drawPhone(ctx, x, y, drawW, drawH, dev, video, videoFit, videoScale, videoOffsetX, videoOffsetY);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [device, preset, scale, mockupStretchY, videoMeta, bg, customColor, videoFit, videoScale, videoOffsetX, videoOffsetY, handOffsetX, handOffsetY, handZoom]);


  const exportVideo = async () => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || !videoMeta) return;

    setError(null);
    setRecording(true);
    setProgress(0);
    setResult(null);

    try {
      const transparent = bg === "transparent";
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

            {/* Device Frame */}
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
            </Section>


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

            {/* Background — open by default */}
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
                        : b.preview === "custom"
                          ? { background: customColor }
                          : b.id.startsWith("hand_")
                            ? { backgroundImage: b.preview, backgroundSize: "cover", backgroundPosition: "center" }
                            : { background: b.preview }
                    }
                  />
                ))}
              </div>
              {bg === "custom" && (
                <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="mt-2 h-8 w-full cursor-pointer rounded-lg bg-transparent" />
              )}
            </Section>


            {/* Hand Position (only when hand bg selected) */}
            {bg.startsWith("hand_") && (
            <Section title="Hand position">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/50">Pan &amp; zoom</span>
                  <button type="button" className="text-[10px] text-white/50 hover:text-white" onClick={() => { setHandOffsetX(0); setHandOffsetY(0); setHandZoom(1); }}>Reset</button>
                </div>
                <div>
                  <label className="text-[10px] text-white/40">H: {(handOffsetX * 100).toFixed(0)}%</label>
                  <input type="range" min={-0.8} max={0.8} step={0.01} value={handOffsetX} onChange={(e) => setHandOffsetX(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40">V: {(handOffsetY * 100).toFixed(0)}%</label>
                  <input type="range" min={-0.8} max={0.8} step={0.01} value={handOffsetY} onChange={(e) => setHandOffsetY(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/40">Zoom: {handZoom.toFixed(2)}x</label>
                  <input type="range" min={0.5} max={2.5} step={0.01} value={handZoom} onChange={(e) => setHandZoom(Number(e.target.value))} className="w-full accent-white h-1" />
                </div>
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
                    const handMode = bg.startsWith("hand_");
                    const startOffX = handMode ? handOffsetX : videoOffsetX;
                    const startOffY = handMode ? handOffsetY : videoOffsetY;
                    const move = (ev: PointerEvent) => {
                      if (handMode) {
                        const dx = (ev.clientX - startX) / rect.width;
                        const dy = (ev.clientY - startY) / rect.height;
                        setHandOffsetX(Math.max(-1, Math.min(1, +(startOffX + dx).toFixed(3))));
                        setHandOffsetY(Math.max(-1, Math.min(1, +(startOffY + dy).toFixed(3))));
                      } else {
                        const dx = ((ev.clientX - startX) / rect.width) * 200;
                        const dy = ((ev.clientY - startY) / rect.height) * 200;
                        setVideoOffsetX(Math.max(-100, Math.min(100, Math.round(startOffX + dx))));
                        setVideoOffsetY(Math.max(-100, Math.min(100, Math.round(startOffY + dy))));
                      }
                    };
                    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    if (bg.startsWith("hand_")) setHandZoom((z) => Math.max(0.5, Math.min(2.5, +(z - e.deltaY * 0.002).toFixed(2))));
                    else setVideoScale((s) => Math.max(0.5, Math.min(3, +(s - e.deltaY * 0.002).toFixed(2))));
                  }}
                />
              ) : (
                <div className="text-white/40 text-sm">Upload a video to preview</div>
              )}
            </div>

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
) {
  const radius = w * dev.radiusRatio;
  const bezel = w * dev.bezelRatio;

  ctx.save();

  // Shadow
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = w * 0.10;
  ctx.shadowOffsetY = w * 0.04;
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();


  // Outer rail
  const railGrad = ctx.createLinearGradient(x, y, x + w, y);
  railGrad.addColorStop(0, shade(dev.rail, -25));
  railGrad.addColorStop(0.15, dev.rail);
  railGrad.addColorStop(0.5, shade(dev.rail, 20));
  railGrad.addColorStop(0.85, dev.rail);
  railGrad.addColorStop(1, shade(dev.rail, -25));
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
  ctx.fillStyle = dev.body;
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
  ctx.fillStyle = shade(dev.rail, -10);
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


function paintBackground(
  ctx: CanvasRenderingContext2D, w: number, h: number, bg: BgId, custom: string,
) {
  if (bg === "transparent") return;
  let fill: string | CanvasGradient = custom;
  if (bg === "white") fill = "#ffffff";
  else if (bg === "black") fill = "#000000";
  else if (bg === "sunset") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#ff6a3d"); g.addColorStop(1, "#f9c846"); fill = g;
  } else if (bg === "ocean") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#0ea5e9"); g.addColorStop(1, "#1e3a8a"); fill = g;
  } else if (bg === "violet") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#7c3aed"); g.addColorStop(1, "#ec4899"); fill = g;
  } else if (bg === "custom") {
    fill = custom;
  }
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
}
