"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Clapperboard, Crop, Download, FileImage, FileVideo, Film, Image as ImageIcon, Link2, Loader2, Pause, Play, Plus, RotateCw, RotateCcw, Scissors, SlidersHorizontal, Sparkles, Trash2, Type, Upload, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { formatNumber, requestJson } from "@/lib/client";
import type { StudioVideo, View, WorkspaceData } from "@/lib/types";

interface MediaItem { id: string; kind: "image" | "video"; name: string; url: string; file: File; width: number; height: number; duration: number }
type ToolTab = "filter" | "adjust" | "transform" | "text" | "trim";
interface Settings { preset: string; brightness: number; contrast: number; saturation: number; rotation: number; flip: boolean; crop: string; text: string; textSize: number; textColor: string; textPosition: string; trimStart: number; trimEnd: number; muted: boolean }

const PRESETS: Record<string, string> = {
  none: "",
  vivid: "saturate(1.4) contrast(1.1)",
  vintage: "sepia(0.5) contrast(0.9) brightness(1.05)",
  mono: "grayscale(1) contrast(1.1)",
  warm: "sepia(0.3) saturate(1.2) brightness(1.05)",
  cool: "saturate(1.1) hue-rotate(15deg) brightness(1.02)",
  dramatic: "contrast(1.3) saturate(0.8) brightness(0.95)",
};
const PRESET_LABELS: Record<string, string> = { none: "Gốc", vivid: "Rực rỡ", vintage: "Hoài cổ", mono: "Đen trắng", warm: "Ấm áp", cool: "Lạnh", dramatic: "Kịch tính" };
const CROP_RATIOS: Record<string, number | null> = { free: null, "1:1": 1, "16:9": 16 / 9, "9:16": 9 / 16, "4:5": 4 / 5, "3:2": 3 / 2 };
const DEFAULT_SETTINGS: Settings = { preset: "none", brightness: 0, contrast: 0, saturation: 0, rotation: 0, flip: false, crop: "free", text: "", textSize: 42, textColor: "#ffffff", textPosition: "bottom", trimStart: 0, trimEnd: 0, muted: false };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function cropRect(sourceWidth: number, sourceHeight: number, ratio: number | null) {
  if (!ratio) return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > ratio) { const sw = sourceHeight * ratio; return { sx: (sourceWidth - sw) / 2, sy: 0, sw, sh: sourceHeight }; }
  const sh = sourceWidth / ratio;
  return { sx: 0, sy: (sourceHeight - sh) / 2, sw: sourceWidth, sh };
}
function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function MediaEditor({ data, onNavigate, notify }: { data: WorkspaceData; onNavigate: (view: View) => void; notify: (message: string, error?: boolean) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tool, setTool] = useState<ToolTab>("filter");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedName, setExportedName] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadPrivacy, setUploadPrivacy] = useState("private");
  const [uploadFormat, setUploadFormat] = useState("video");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importing, setImporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const active = items.find((item) => item.id === activeId) || null;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const item = itemsRef.current.find((entry) => entry.id === activeId);
    if (!canvas || !item) return;
    const source = item.kind === "video" ? videoRef.current : imageRef.current;
    if (!source) return;
    const sourceWidth = item.kind === "video" ? (videoRef.current?.videoWidth || item.width) : item.width;
    const sourceHeight = item.kind === "video" ? (videoRef.current?.videoHeight || item.height) : item.height;
    if (!sourceWidth || !sourceHeight) return;
    const ratio = CROP_RATIOS[settings.crop];
    const rect = cropRect(sourceWidth, sourceHeight, ratio);
    const rotated = settings.rotation % 180 !== 0;
    const cap = 1600;
    const scale = Math.min(1, cap / Math.max(rect.sw, rect.sh));
    const width = Math.round((rotated ? rect.sh : rect.sw) * scale);
    const height = Math.round((rotated ? rect.sw : rect.sh) * scale);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.round(rect.sw * scale);
    offscreen.height = Math.round(rect.sh * scale);
    const octx = offscreen.getContext("2d");
    if (!octx) return;
    const filter = `${PRESETS[settings.preset]} brightness(${1 + settings.brightness / 100}) contrast(${1 + settings.contrast / 100}) saturate(${1 + settings.saturation / 100})`.trim();
    octx.filter = filter;
    octx.drawImage(source as CanvasImageSource, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, offscreen.width, offscreen.height);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((settings.rotation * Math.PI) / 180);
    ctx.scale(settings.flip ? -1 : 1, 1);
    ctx.drawImage(offscreen, -offscreen.width / 2, -offscreen.height / 2);
    ctx.restore();
    if (settings.text.trim()) {
      const fontSize = Math.max(12, (settings.textSize / 100) * width);
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const y = settings.textPosition === "top" ? fontSize : settings.textPosition === "center" ? height / 2 : height - fontSize;
      ctx.lineWidth = Math.max(2, fontSize / 10);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(settings.text, width / 2, y);
      ctx.fillStyle = settings.textColor;
      ctx.fillText(settings.text, width / 2, y);
    }
  }, [activeId, settings]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!active) { videoRef.current = null; imageRef.current = null; return; }
    if (active.kind === "video") {
      const video = document.createElement("video");
      video.src = active.url;
      video.muted = settings.muted;
      video.playsInline = true;
      video.preload = "auto";
      videoRef.current = video;
      imageRef.current = null;
      const onTime = () => setCurrentTime(video.currentTime);
      video.addEventListener("timeupdate", onTime);
      return () => { video.removeEventListener("timeupdate", onTime); video.pause(); video.removeAttribute("src"); video.load(); videoRef.current = null; };
    }
    const image = new Image();
    image.src = active.url;
    imageRef.current = image;
    videoRef.current = null;
    image.onload = () => draw();
    return () => { imageRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = settings.muted;
    if (settings.trimEnd > 0 && video.currentTime >= settings.trimEnd) video.currentTime = settings.trimStart;
  }, [settings.muted, settings.trimStart, settings.trimEnd]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, draw]);

  useEffect(() => () => { itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url)); }, []);

  async function importFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setImporting(true);
    const added: MediaItem[] = [];
    for (const file of list) {
      const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : null;
      if (!kind) continue;
      const url = URL.createObjectURL(file);
      try {
        if (kind === "image") {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
          added.push({ id: uid(), kind, name: file.name, url, file, width: image.naturalWidth, height: image.naturalHeight, duration: 0 });
        } else {
          const meta = await new Promise<{ width: number; height: number; duration: number }>((resolve, reject) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration || 0 });
            video.onerror = reject;
            video.src = url;
          });
          added.push({ id: uid(), kind, name: file.name, url, file, width: meta.width, height: meta.height, duration: meta.duration });
        }
      } catch { URL.revokeObjectURL(url); }
    }
    setImporting(false);
    if (!added.length) { notify("Không đọc được file. Hãy chọn ảnh hoặc video hợp lệ.", true); return; }
    setItems((current) => [...current, ...added]);
    setActiveId(added[0].id);
    setSettings({ ...DEFAULT_SETTINGS, trimEnd: added[0].duration || 0 });
    setCurrentTime(0);
    notify(`Đã thêm ${added.length} file vào trình chỉnh sửa.`);
  }

  async function addThumbnail(video: StudioVideo) {
    if (!video.thumbnail) { notify("Video này chưa có ảnh bìa.", true); return; }
    setImporting(true);
    try {
      const response = await fetch(video.thumbnail);
      const blob = await response.blob();
      const file = new File([blob], `${video.youtubeVideoId}-thumbnail.jpg`, { type: blob.type || "image/jpeg" });
      const url = URL.createObjectURL(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
      const item: MediaItem = { id: uid(), kind: "image", name: `Thumbnail: ${video.title}`, url, file, width: image.naturalWidth, height: image.naturalHeight, duration: 0 };
      setItems((current) => [...current, item]);
      setActiveId(item.id);
      setSettings(DEFAULT_SETTINGS);
      notify("Đã thêm ảnh bìa vào trình chỉnh sửa.");
    } catch { notify("Không tải được ảnh bìa. Hãy kiểm tra mạng và thử lại.", true); }
    finally { setImporting(false); }
  }

  function removeItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (item) URL.revokeObjectURL(item.url);
    const next = items.filter((entry) => entry.id !== id);
    setItems(next);
    if (activeId === id) { setActiveId(next[0]?.id || null); setSettings(DEFAULT_SETTINGS); setPlaying(false); }
  }

  function selectItem(item: MediaItem) {
    setActiveId(item.id);
    setSettings({ ...DEFAULT_SETTINGS, trimEnd: item.duration || 0 });
    setCurrentTime(0);
    setPlaying(false);
    setExportedUrl(null);
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video || !active || active.kind !== "video") return;
    if (playing) { video.pause(); setPlaying(false); return; }
    if (settings.trimEnd > 0 && video.currentTime >= settings.trimEnd) video.currentTime = settings.trimStart;
    void video.play().then(() => setPlaying(true)).catch(() => notify("Không phát được video trên trình duyệt này.", true));
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
    draw();
  }

  async function exportImageBlob(): Promise<Blob | null> {
    draw();
    return new Promise((resolve) => canvasRef.current?.toBlob((blob) => resolve(blob), "image/png"));
  }

  async function exportVideoBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !active || active.kind !== "video") return null;
    if (!("MediaRecorder" in window) || typeof canvas.captureStream !== "function") throw new Error("unsupported");
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 8000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      recorder.onerror = () => reject(new Error("record_failed"));
    });
    const start = settings.trimStart;
    const end = settings.trimEnd > 0 ? settings.trimEnd : active.duration;
    video.currentTime = start;
    await video.play();
    setPlaying(true);
    recorder.start(200);
    await new Promise<void>((resolve) => {
      const check = () => {
        if (video.currentTime >= end - 0.05 || video.ended) { video.pause(); setPlaying(false); resolve(); }
        else setTimeout(check, 100);
      };
      check();
    });
    recorder.stop();
    return done;
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleDownload() {
    if (!active) return;
    setExporting(true);
    try {
      if (active.kind === "image") {
        const blob = await exportImageBlob();
        if (!blob) throw new Error("export_failed");
        downloadBlob(blob, "tubeflow-edit.png");
        notify("Đã tải ảnh đã chỉnh sửa.");
      } else {
        const blob = await exportVideoBlob();
        if (!blob) throw new Error("export_failed");
        downloadBlob(blob, "tubeflow-edit.webm");
        notify("Đã tải video đã chỉnh sửa.");
      }
    } catch (error) {
      notify(error instanceof Error && error.message === "unsupported" ? "Trình duyệt không hỗ trợ xuất video. Hãy dùng Chrome hoặc xuất ảnh." : "Không xuất được file. Hãy thử lại.", true);
    } finally { setExporting(false); }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!active || !uploadTitle.trim()) { setUploadError("Hãy nhập tiêu đề video."); return; }
    setUploading(true); setUploadError("");
    try {
      let blob: Blob | null;
      if (active.kind === "image") blob = await exportImageBlob();
      else blob = await exportVideoBlob();
      if (!blob) throw new Error("export_failed");
      const extension = active.kind === "image" ? "png" : "webm";
      const file = new File([blob], `tubeflow-edit.${extension}`, { type: blob.type || (active.kind === "image" ? "image/png" : "video/webm") });
      const form = new FormData();
      form.append("file", file);
      form.append("title", uploadTitle.trim());
      form.append("description", uploadDescription.trim());
      form.append("privacyStatus", uploadPrivacy);
      form.append("format", uploadFormat);
      const response = await fetch("/api/youtube/upload", { method: "POST", body: form, credentials: "same-origin" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setUploadError(payload?.error || "Không thể đăng video. Vui lòng thử lại."); return; }
      setUploadOpen(false);
      notify("Đã đăng lên YouTube. Video có thể mất vài phút để xử lý.");
      onNavigate("studio");
    } catch (error) {
      setUploadError(error instanceof Error && error.message === "unsupported" ? "Trình duyệt không hỗ trợ xuất video để đăng. Hãy dùng Chrome hoặc tải file xuống rồi đăng tại YouTube Studio." : "Không thể đăng video. Hãy kiểm tra mạng và thử lại.");
    } finally { setUploading(false); }
  }

  const tools: { id: ToolTab; label: string; icon: typeof Wand2 }[] = [
    { id: "filter", label: "Bộ lọc", icon: Wand2 },
    { id: "adjust", label: "Điều chỉnh", icon: SlidersHorizontal },
    { id: "transform", label: "Xoay & Cắt", icon: Crop },
    { id: "text", label: "Chữ", icon: Type },
    { id: "trim", label: "Cắt đoạn", icon: Scissors },
  ];

  return <div className="workspace-view editor-view">
    <div className="page-heading"><div><div className="eyebrow">CHỈNH SỬA NHƯ CAPCUT</div><h1>Edit Video/Image<span className="heading-dot">.</span></h1><p>Chỉnh sửa ảnh và video ngay trên trình duyệt, lưu file hoặc đăng lên YouTube.</p></div><div className="editor-heading-actions"><button className="button button-secondary" onClick={handleDownload} disabled={!active || exporting}>{exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}{exporting ? "Đang xuất…" : "Tải xuống"}</button><button className="button button-primary" onClick={() => { setUploadTitle(active?.name.replace(/\.[^.]+$/, "") || ""); setUploadOpen(true); }} disabled={!active || exporting}><Upload size={16} />Đăng lên YouTube</button></div></div>
    <input ref={fileInput} type="file" accept="image/*,video/*" multiple className="sr-only" aria-label="Nhập file ảnh hoặc video" onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = ""; }} />
    <div className="editor-layout">
      <aside className="editor-library card">
        <div className="editor-panel-heading"><h2>Thư viện</h2><button className="button button-secondary button-small" onClick={() => fileInput.current?.click()} disabled={importing}>{importing ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}Nhập file</button></div>
        {items.length ? <div className="editor-media-list">{items.map((item) => <button key={item.id} className={`editor-media-item ${item.id === activeId ? "active" : ""}`} onClick={() => selectItem(item)} aria-pressed={item.id === activeId}>{item.kind === "video" ? <video src={item.url} muted preload="metadata" /> : <img src={item.url} alt="" />}<span><strong>{item.name}</strong><small>{item.kind === "video" ? `Video · ${formatTime(item.duration)}` : "Ảnh"}</small></span>{item.kind === "video" ? <Film size={14} /> : <ImageIcon size={14} />}</button>)}</div> : <div className="editor-empty"><FileVideo size={30} /><p>Chưa có file nào</p><span>Nhập ảnh hoặc video từ thiết bị để bắt đầu chỉnh sửa.</span></div>}
        {data.videos.length > 0 && <div className="editor-synced"><h3>Từ video đã đăng</h3>{data.videos.slice(0, 5).map((video) => <button key={video.id} className="editor-synced-item" onClick={() => addThumbnail(video)} disabled={importing}>{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="studio-thumb-fallback"><Film size={14} /></span>}<span>{video.title}</span><Plus size={14} /></button>)}</div>}
      </aside>
      <section className="editor-stage card">
        {active ? <>
          <div className="editor-canvas-wrap"><canvas ref={canvasRef} className="editor-canvas" aria-label={`Xem trước ${active.name}`} /></div>
          {active.kind === "video" && <div className="editor-playback"><button className="icon-button editor-play-button" onClick={togglePlay} aria-label={playing ? "Tạm dừng" : "Phát"}>{playing ? <Pause size={19} /> : <Play size={19} />}</button><span className="editor-time">{formatTime(currentTime)} / {formatTime(settings.trimEnd > 0 ? settings.trimEnd : active.duration)}</span><input type="range" min={settings.trimStart} max={settings.trimEnd > 0 ? settings.trimEnd : active.duration} step={0.1} value={currentTime} onChange={(event) => seek(Number(event.target.value))} aria-label="Tua video" /></div>}
          <div className="editor-stage-name"><FileVideo size={15} /><span>{active.name}</span><span>{active.width}×{active.height}</span></div>
        </> : <div className="editor-empty large"><Clapperboard size={40} /><h3>Bắt đầu chỉnh sửa</h3><p>Nhập ảnh hoặc video từ thiết bị, hoặc chọn ảnh bìa từ video đã đăng.</p><button className="button button-primary" onClick={() => fileInput.current?.click()}><Upload size={16} />Nhập file</button></div>}
      </section>
      <aside className="editor-tools card">
        <div className="editor-tool-tabs" role="tablist" aria-label="Công cụ chỉnh sửa">{tools.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tool === id} className={tool === id ? "active" : ""} onClick={() => setTool(id)} disabled={!active || (id === "trim" && active?.kind !== "video")}><Icon size={17} /><span>{label}</span></button>)}</div>
        {!active ? <p className="editor-tools-empty">Hãy nhập file để bắt đầu chỉnh sửa.</p> : <>
          {tool === "filter" && <div className="editor-tool-panel"><h3>Bộ lọc màu</h3><div className="editor-filter-grid">{Object.keys(PRESETS).map((key) => <button key={key} className={`editor-filter ${settings.preset === key ? "active" : ""}`} onClick={() => setSettings({ ...settings, preset: key })} aria-pressed={settings.preset === key}><span className="editor-filter-preview" style={{ filter: PRESETS[key] || undefined }}><ImageIcon size={18} /></span>{PRESET_LABELS[key]}</button>)}</div></div>}
          {tool === "adjust" && <div className="editor-tool-panel"><h3>Điều chỉnh</h3>{([["brightness", "Độ sáng"], ["contrast", "Độ tương phản"], ["saturation", "Độ bão hòa"]] as const).map(([key, label]) => <label key={key} className="editor-slider"><span>{label}<strong>{settings[key] > 0 ? "+" : ""}{settings[key]}</strong></span><input type="range" min={-100} max={100} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} /></label>)}<button className="text-button" onClick={() => setSettings({ ...settings, brightness: 0, contrast: 0, saturation: 0 })}>Đặt lại điều chỉnh</button></div>}
          {tool === "transform" && <div className="editor-tool-panel"><h3>Xoay & cắt</h3><div className="editor-transform-actions"><button className="button button-secondary button-small" onClick={() => setSettings({ ...settings, rotation: (settings.rotation + 90) % 360 })}><RotateCcw size={14} />Xoay trái</button><button className="button button-secondary button-small" onClick={() => setSettings({ ...settings, rotation: (settings.rotation + 270) % 360 })}><RotateCw size={14} />Xoay phải</button><button className="button button-secondary button-small" onClick={() => setSettings({ ...settings, flip: !settings.flip })} aria-pressed={settings.flip}>Lật ngang</button></div><label className="field-label" htmlFor="crop-ratio">Tỷ lệ cắt</label><select id="crop-ratio" value={settings.crop} onChange={(event) => setSettings({ ...settings, crop: event.target.value })}><option value="free">Tự do (giữ nguyên)</option><option value="1:1">Vuông 1:1</option><option value="16:9">Ngang 16:9</option><option value="9:16">Dọc 9:16 (Shorts)</option><option value="4:5">Dọc 4:5</option><option value="3:2">Ngang 3:2</option></select><p className="field-hint">Cắt giữa khung hình theo tỷ lệ đã chọn.</p></div>}
          {tool === "text" && <div className="editor-tool-panel"><h3>Chữ trên video/ảnh</h3><label className="field-label" htmlFor="overlay-text">Nội dung chữ</label><input id="overlay-text" value={settings.text} onChange={(event) => setSettings({ ...settings, text: event.target.value })} maxLength={80} placeholder="Nhập chữ muốn hiển thị…" /><label className="field-label" htmlFor="text-size">Cỡ chữ</label><input id="text-size" type="range" min={16} max={120} value={settings.textSize} onChange={(event) => setSettings({ ...settings, textSize: Number(event.target.value) })} /><div className="form-two-columns"><div><label className="field-label" htmlFor="text-color">Màu chữ</label><input id="text-color" type="color" value={settings.textColor} onChange={(event) => setSettings({ ...settings, textColor: event.target.value })} /></div><div><label className="field-label" htmlFor="text-position">Vị trí</label><select id="text-position" value={settings.textPosition} onChange={(event) => setSettings({ ...settings, textPosition: event.target.value })}><option value="top">Trên</option><option value="center">Giữa</option><option value="bottom">Dưới</option></select></div></div></div>}
          {tool === "trim" && active.kind === "video" && <div className="editor-tool-panel"><h3>Cắt đoạn video</h3><label className="editor-slider"><span>Điểm bắt đầu<strong>{formatTime(settings.trimStart)}</strong></span><input type="range" min={0} max={active.duration} step={0.1} value={settings.trimStart} onChange={(event) => { const value = Math.min(Number(event.target.value), settings.trimEnd > 0 ? settings.trimEnd : active.duration); setSettings({ ...settings, trimStart: value }); seek(value); }} /></label><label className="editor-slider"><span>Điểm kết thúc<strong>{formatTime(settings.trimEnd > 0 ? settings.trimEnd : active.duration)}</strong></span><input type="range" min={0} max={active.duration} step={0.1} value={settings.trimEnd > 0 ? settings.trimEnd : active.duration} onChange={(event) => setSettings({ ...settings, trimEnd: Number(event.target.value) })} /></label><label className="editor-check"><input type="checkbox" checked={settings.muted} onChange={(event) => setSettings({ ...settings, muted: event.target.checked })} /><span>Tắt tiếng khi xuất</span></label><p className="field-hint">Phần video ngoài đoạn cắt sẽ không có trong file xuất ra.</p></div>}
        </>}
      </aside>
    </div>
    <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Đăng lên YouTube" description="File đã chỉnh sửa sẽ được đăng trực tiếp lên kênh của bạn.">
      <form onSubmit={handleUpload} className="plan-form">
        <label className="field-label" htmlFor="editor-upload-title">Tiêu đề video <span className="required">*</span></label>
        <input id="editor-upload-title" value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} maxLength={100} required placeholder="Tiêu đề video đã chỉnh sửa" />
        <label className="field-label" htmlFor="editor-upload-description">Mô tả</label>
        <textarea id="editor-upload-description" rows={4} value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} maxLength={5000} placeholder="Mô tả video…" />
        <div className="form-two-columns"><div><label className="field-label" htmlFor="editor-upload-privacy">Trạng thái</label><select id="editor-upload-privacy" value={uploadPrivacy} onChange={(event) => setUploadPrivacy(event.target.value)}><option value="private">Riêng tư</option><option value="unlisted">Không công khai</option><option value="public">Công khai</option></select></div><div><label className="field-label" htmlFor="editor-upload-format">Định dạng</label><select id="editor-upload-format" value={uploadFormat} onChange={(event) => setUploadFormat(event.target.value)}><option value="video">Video dài</option><option value="short">YouTube Shorts</option></select></div></div>
        <p className="field-hint">Video sẽ được xuất lại từ trình duyệt (định dạng WebM) rồi gửi lên YouTube. Cần đã cấp quyền đăng video.</p>
        {uploadError && <div className="form-error" role="alert">{uploadError}</div>}
        <div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setUploadOpen(false)} disabled={uploading}>Hủy</button><button className="button button-primary" type="submit" disabled={uploading || !uploadTitle.trim()}>{uploading ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}{uploading ? "Đang xuất và đăng…" : "Đăng lên YouTube"}</button></div>
      </form>
    </Modal>
  </div>;
}
