"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, Clapperboard, Eye, ExternalLink, FileVideo, Film, Heart, Info, Link2, Loader2, MessageSquare, Pencil, Play, Plus, RefreshCw, Search, ShieldCheck, Trash2, Upload, Users, Video } from "lucide-react";
import { Modal, YouTubeMark } from "@/components/ui";
import { formatDate, formatNumber, requestJson } from "@/lib/client";
import type { AnalyticsData, Channel, Plan, PublicConfig, StudioVideo, VideoAnalyticsRow, VideoComment, View, WorkspaceData } from "@/lib/types";

type Tab = "dashboard" | "videos" | "upload" | "analytics" | "comments";
interface Props {
  data: WorkspaceData;
  config: PublicConfig;
  onNavigate: (view: View) => void;
  onPlansChange: (plans: Plan[]) => void;
  onVideosChange: (videos: StudioVideo[]) => void;
  notify: (message: string, error?: boolean) => void;
}

const privacyLabels: Record<string, string> = { public: "Công khai", unlisted: "Không công khai", private: "Riêng tư" };
const localLabels: Record<string, string> = { published: "Đã đăng", scheduled: "Đã lên lịch", draft: "Nháp" };

function formatDuration(value: string | null) {
  if (!value) return "";
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return value;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function formatDurationSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}
const studioUrl = (video: StudioVideo) => `https://studio.youtube.com/video/${video.youtubeVideoId}/edit`;
const watchUrl = (video: StudioVideo) => `https://www.youtube.com/watch?v=${video.youtubeVideoId}`;

export function StudioWorkspace({ data, config, onNavigate, onPlansChange, onVideosChange, notify }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [videos, setVideos] = useState<StudioVideo[]>(data.videos);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [privacyFilter, setPrivacyFilter] = useState("all");
  const [localFilter, setLocalFilter] = useState("all");
  const [selected, setSelected] = useState<StudioVideo | null>(null);
  const [detailStatus, setDetailStatus] = useState("published");
  const [detailPlan, setDetailPlan] = useState("");
  const [detailNotes, setDetailNotes] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);
  const [deleting, setDeleting] = useState<StudioVideo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadPrivacy, setUploadPrivacy] = useState("private");
  const [uploadFormat, setUploadFormat] = useState("video");
  const [uploadPublishAt, setUploadPublishAt] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone, setUploadDone] = useState<StudioVideo | null>(null);
  const [report, setReport] = useState<AnalyticsData | null>(null);
  const [videoRows, setVideoRows] = useState<VideoAnalyticsRow[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [commentVideoId, setCommentVideoId] = useState("");
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const channel: Channel | null = data.channel;

  const sync = useCallback(async () => {
    if (!channel) return;
    setSyncing(true); setError("");
    try {
      const fresh = await requestJson<StudioVideo[]>("/api/youtube/videos", { method: "POST" });
      setVideos(fresh); onVideosChange(fresh);
    } catch (issue) { setError((issue as Error).message); }
    finally { setSyncing(false); }
  }, [channel, onVideosChange]);

  useEffect(() => { setVideos(data.videos); }, [data.videos]);
  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (channel && videos.length === 0) void sync(); }, [channel, videos.length, sync]);

  const loadAnalytics = useCallback(async () => {
    if (!channel) return;
    setAnalyticsLoading(true);
    try {
      const [channelReport, perVideo] = await Promise.all([
        requestJson<AnalyticsData>("/api/youtube/analytics"),
        requestJson<{ startDate: string; endDate: string; rows: VideoAnalyticsRow[] }>("/api/youtube/analytics/videos"),
      ]);
      setReport(channelReport); setVideoRows(perVideo.rows);
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setAnalyticsLoading(false); }
  }, [channel, notify]);

  useEffect(() => { if (tab === "analytics" && channel) void loadAnalytics(); }, [tab, channel, loadAnalytics]);

  const loadComments = useCallback(async (videoId: string) => {
    if (!videoId) return;
    setCommentsLoading(true);
    try { setComments(await requestJson<VideoComment[]>(`/api/youtube/comments?videoId=${encodeURIComponent(videoId)}`)); }
    catch (issue) { notify((issue as Error).message, true); }
    finally { setCommentsLoading(false); }
  }, [notify]);

  useEffect(() => {
    if (tab !== "comments") return;
    const first = commentVideoId || videos[0]?.youtubeVideoId || "";
    if (first && first !== commentVideoId) setCommentVideoId(first);
    if (first) void loadComments(first);
  }, [tab, videos, commentVideoId, loadComments]);

  const visible = useMemo(() => videos.filter((video) => {
    const matchesQuery = `${video.title} ${video.description}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"));
    return matchesQuery && (privacyFilter === "all" || video.privacyStatus === privacyFilter) && (localFilter === "all" || video.localStatus === localFilter);
  }), [videos, query, privacyFilter, localFilter]);

  const totals = useMemo(() => videos.reduce((result, video) => ({
    views: result.views + (Number(video.viewCount) || 0),
    likes: result.likes + (Number(video.likeCount) || 0),
    comments: result.comments + (Number(video.commentCount) || 0),
  }), { views: 0, likes: 0, comments: 0 }), [videos]);

  function openDetail(video: StudioVideo) {
    setSelected(video);
    setDetailStatus(video.localStatus);
    setDetailPlan(video.planId || "");
    setDetailNotes(video.localNotes);
  }

  async function saveDetail() {
    if (!selected) return;
    setSavingDetail(true);
    try {
      const updated = await requestJson<StudioVideo>(`/api/youtube/videos/${selected.id}`, { method: "PATCH", body: JSON.stringify({ localStatus: detailStatus, planId: detailPlan || null, localNotes: detailNotes }) });
      const next = videos.map((video) => video.id === updated.id ? updated : video);
      setVideos(next); onVideosChange(next); setSelected(updated);
      notify("Đã lưu quản lý video trong TubeFlow.");
    } catch (issue) { notify((issue as Error).message, true); }
    finally { setSavingDetail(false); }
  }

  async function removeLocal() {
    if (!deleting) return;
    try {
      await requestJson(`/api/youtube/videos/${deleting.id}`, { method: "DELETE" });
      const next = videos.filter((video) => video.id !== deleting.id);
      setVideos(next); onVideosChange(next); setSelected(null); setDeleting(null);
      notify("Đã xóa khỏi quản lý TubeFlow. Video trên YouTube không bị xóa.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  async function addToPlanner(video: StudioVideo) {
    try {
      const date = video.publishAt ? video.publishAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const plan = await requestJson<Plan>("/api/plans", { method: "POST", body: JSON.stringify({ title: video.title, description: video.description, format: "video", status: "planned", scheduledDate: date }) });
      onPlansChange([plan, ...data.plans]);
      const updated = await requestJson<StudioVideo>(`/api/youtube/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ planId: plan.id, localStatus: "scheduled" }) });
      const next = videos.map((item) => item.id === updated.id ? updated : item);
      setVideos(next); onVideosChange(next);
      notify("Đã đưa video vào lịch nội dung.");
    } catch (issue) { notify((issue as Error).message, true); }
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) { setUploadError("Hãy chọn file video để đăng."); return; }
    if (!uploadTitle.trim()) { setUploadError("Hãy nhập tiêu đề video."); return; }
    setUploading(true); setUploadError(""); setUploadDone(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", uploadTitle.trim());
      form.append("description", uploadDescription.trim());
      form.append("privacyStatus", uploadPrivacy);
      form.append("format", uploadFormat);
      if (uploadPublishAt) form.append("publishAt", new Date(uploadPublishAt).toISOString());
      const response = await fetch("/api/youtube/upload", { method: "POST", body: form, credentials: "same-origin" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || "Không thể đăng video. Vui lòng thử lại.";
        setUploadError(message);
        if (payload?.code === "upload_scope_required") setUploadError(`${message} Hãy bấm nút cấp quyền đăng video bên dưới.`);
        return;
      }
      const video = payload?.video as StudioVideo | null;
      if (video) {
        const next = [video, ...videos.filter((item) => item.youtubeVideoId !== video.youtubeVideoId)];
        setVideos(next); onVideosChange(next); setUploadDone(video);
      }
      setFile(null); setUploadTitle(""); setUploadDescription(""); setUploadPublishAt("");
      if (fileInput.current) fileInput.current.value = "";
      notify("Video đã được gửi lên YouTube. Có thể mất vài phút để xử lý.");
    } catch { setUploadError("Không thể kết nối máy chủ để đăng video. Hãy kiểm tra mạng và thử lại."); }
    finally { setUploading(false); }
  }

  if (!channel) {
    return <div className="workspace-view studio-view">
      <div className="page-heading"><div><div className="eyebrow">QUẢN LÝ KÊNH CỦA BẠN</div><h1>YouTube Studio<span className="heading-dot">.</span></h1><p>Đăng video, quản lý nội dung và theo dõi hiệu suất ngay trong TubeFlow.</p></div></div>
      <section className="card studio-connect-prompt">
        <div className="studio-connect-art"><YouTubeMark /><span className="art-dashes" /><span className="art-link"><Link2 size={19} /></span><span className="art-dashes" /><span className="art-brand"><Clapperboard size={22} /></span></div>
        <h2>Kết nối kênh để mở Studio</h2>
        <p>Sau khi kết nối, TubeFlow sẽ đồng bộ video đã đăng, hiển thị lượt xem và bình luận, đồng thời cho phép đăng video mới và lên lịch phát hành.</p>
        <div className="studio-connect-features"><span><Check size={13} />Quản lý video đã đăng</span><span><Check size={13} />Đăng và lên lịch video</span><span><Check size={13} />Phân tích theo từng video</span></div>
        <button className="button button-primary" onClick={() => onNavigate("connections")}><Link2 size={16} />Kết nối kênh YouTube <ArrowRight size={15} /></button>
        <p className="studio-connect-note">Lịch nội dung và kho ý tưởng vẫn dùng được khi chưa kết nối.</p>
      </section>
      <section className="card studio-local-preview"><h2>Không gian làm việc của bạn vẫn sẵn sàng</h2><p>Bạn đã có {data.plans.length} nội dung trong lịch và kho ý tưởng. Kết nối kênh để TubeFlow đồng bộ video thật từ YouTube, không dùng dữ liệu mẫu.</p><button className="text-button" onClick={() => onNavigate("planner")}>Mở lịch nội dung <ArrowRight size={14} /></button></section>
    </div>;
  }

  return <div className="workspace-view studio-view">
    <div className="page-heading"><div><div className="eyebrow">QUẢN LÝ KÊNH CỦA BẠN</div><h1>YouTube Studio<span className="heading-dot">.</span></h1><p>Đăng video, quản lý nội dung và theo dõi hiệu suất ngay trong TubeFlow.</p></div><div className="studio-heading-actions"><button className="button button-secondary" onClick={sync} disabled={syncing}>{syncing ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}Đồng bộ</button><button className="button button-primary" onClick={() => setTab("upload")}><Upload size={16} />Đăng video</button></div></div>
    <section className="card studio-channel-card">
      <div className="studio-channel-main">{channel.thumbnail ? <img src={channel.thumbnail} alt="" className="studio-channel-avatar" /> : <span className="studio-channel-avatar fallback"><Clapperboard size={24} /></span>}<div><div className="channel-title"><h2>{channel.title}</h2><span className="status-pill status-green"><span />Đã kết nối</span></div><p>Kênh của bạn đã sẵn sàng. Dữ liệu cập nhật {new Date(channel.updatedAt).toLocaleDateString("vi-VN")}.</p><div className="channel-features"><span><Users size={14} />{formatNumber(channel.subscribers)} người đăng ký</span><span><Eye size={14} />{formatNumber(channel.views)} lượt xem</span><span><Film size={14} />{formatNumber(channel.videoCount)} video</span></div></div></div>
      <a className="button button-secondary" href={`https://www.youtube.com/${channel.channelId.startsWith("UC") ? "channel/" + channel.channelId : "@" + channel.title}`} target="_blank" rel="noreferrer">Xem kênh <ArrowUpRight size={14} /></a>
    </section>
    {error && <div className="load-error" role="alert"><Info size={18} /><span>{error}</span><button className="text-button" onClick={sync}>Thử lại</button></div>}
    <div className="page-tabs studio-tabs" role="tablist" aria-label="Chức năng YouTube Studio">
      <button role="tab" aria-selected={tab === "dashboard"} className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}><Clapperboard size={16} /> Tổng quan</button>
      <button role="tab" aria-selected={tab === "videos"} className={tab === "videos" ? "active" : ""} onClick={() => setTab("videos")}><Film size={16} /> Nội dung <span className="tab-count">{videos.length}</span></button>
      <button role="tab" aria-selected={tab === "upload"} className={tab === "upload" ? "active" : ""} onClick={() => setTab("upload")}><Upload size={16} /> Đăng video</button>
      <button role="tab" aria-selected={tab === "analytics"} className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}><BarChart3 size={16} /> Phân tích</button>
      <button role="tab" aria-selected={tab === "comments"} className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}><MessageSquare size={16} /> Bình luận</button>
    </div>

    {tab === "dashboard" && <div className="studio-dashboard">
      <div className="stat-grid studio-stats">
        <div className="stat-card card"><span className="stat-icon purple"><Film size={21} /></span><span className="stat-number">{videos.length}</span><span className="stat-label">Video đã đồng bộ</span></div>
        <div className="stat-card card"><span className="stat-icon blue"><Eye size={21} /></span><span className="stat-number">{formatNumber(totals.views)}</span><span className="stat-label">Lượt xem</span></div>
        <div className="stat-card card"><span className="stat-icon rose"><Heart size={21} /></span><span className="stat-number">{formatNumber(totals.likes)}</span><span className="stat-label">Lượt thích</span></div>
        <div className="stat-card card"><span className="stat-icon green"><MessageSquare size={21} /></span><span className="stat-number">{formatNumber(totals.comments)}</span><span className="stat-label">Bình luận</span></div>
      </div>
      <div className="studio-dashboard-grid">
        <section className="card studio-panel"><div className="section-topline"><div><h2>Video mới nhất</h2><p>Đồng bộ trực tiếp từ kênh của bạn.</p></div><button className="text-button" onClick={() => setTab("videos")}>Tất cả video <ArrowRight size={14} /></button></div>
          {syncing ? <div className="loading-state"><Loader2 size={24} className="spin" /><p>Đang đồng bộ video từ YouTube…</p></div> : videos.length ? videos.slice(0, 5).map((video) => <button key={video.id} className="studio-video-row" onClick={() => openDetail(video)}>{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="studio-thumb-fallback"><Play size={18} /></span>}<span className="studio-video-row-main"><strong>{video.title}</strong><small>{video.publishAt ? formatDate(video.publishAt) : "Chưa công khai"} · {formatNumber(video.viewCount)} lượt xem</small></span><span className={`plan-status ${video.privacyStatus === "public" ? "published" : video.privacyStatus === "private" ? "idea" : "planned"}`}>{privacyLabels[video.privacyStatus] || video.privacyStatus}</span></button>) : <div className="empty-state compact-empty"><Film size={30} /><h3>Chưa có video nào được đồng bộ</h3><p>Đăng video đầu tiên hoặc bấm Đồng bộ để lấy video từ kênh.</p><button className="text-button" onClick={() => setTab("upload")}><Upload size={15} />Đăng video</button></div>}
        </section>
        <section className="card studio-panel"><div className="section-topline"><div><h2>Lên lịch tiếp theo</h2><p>Kế hoạch nội dung của bạn.</p></div><button className="text-button" onClick={() => onNavigate("planner")}>Lịch nội dung <ArrowRight size={14} /></button></div>
          {data.plans.filter((plan) => plan.status === "planned").slice(0, 4).map((plan) => <div key={plan.id} className="upcoming-plan"><span className="upcoming-date"><strong>{plan.scheduledDate?.slice(8, 10) || "—"}</strong><small>THÁNG {Number(plan.scheduledDate?.slice(5, 7) || 0)}</small></span><span><strong>{plan.title}</strong><small>{plan.format === "short" ? "YouTube Shorts" : plan.format === "live" ? "Livestream" : "Video dài"}</small></span><span className="plan-status planned">Đã lên lịch</span></div>)}
          {!data.plans.some((plan) => plan.status === "planned") && <div className="empty-state compact-empty"><CalendarDays size={28} /><h3>Chưa có lịch phát hành</h3><p>Lên lịch cho video tiếp theo ngay trong TubeFlow.</p><button className="text-button" onClick={() => onNavigate("planner")}><Plus size={15} />Lên kế hoạch</button></div>}
        </section>
      </div>
    </div>}

    {tab === "videos" && <div className="studio-videos">
      <div className="planner-toolbar"><div className="search-input"><Search size={16} /><input aria-label="Tìm video" placeholder="Tìm video theo tiêu đề..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select aria-label="Lọc theo trạng thái YouTube" value={privacyFilter} onChange={(event) => setPrivacyFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="public">Công khai</option><option value="unlisted">Không công khai</option><option value="private">Riêng tư</option></select>
        <select aria-label="Lọc theo quản lý TubeFlow" value={localFilter} onChange={(event) => setLocalFilter(event.target.value)}><option value="all">Tất cả quản lý</option><option value="published">Đã đăng</option><option value="scheduled">Đã lên lịch</option><option value="draft">Nháp</option></select>
        <button className="button button-secondary" onClick={sync} disabled={syncing}>{syncing ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}Đồng bộ</button></div>
      {syncing ? <div className="loading-state card"><Loader2 size={26} className="spin" /><p>Đang lấy video từ YouTube…</p></div> : visible.length ? <div className="studio-video-grid">{visible.map((video) => <article key={video.id} className="studio-video-card card">
        <button className="studio-video-thumb" onClick={() => openDetail(video)} aria-label={`Xem chi tiết ${video.title}`}>{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="studio-thumb-fallback large"><Play size={26} /></span>}<span className="studio-video-duration">{formatDuration(video.duration)}</span><span className={`studio-privacy-badge ${video.privacyStatus}`}>{privacyLabels[video.privacyStatus] || video.privacyStatus}</span></button>
        <div className="studio-video-body"><button className="studio-video-title" onClick={() => openDetail(video)}>{video.title}</button>
          <div className="studio-video-meta"><span><Eye size={13} />{formatNumber(video.viewCount)}</span><span><Heart size={13} />{formatNumber(video.likeCount)}</span><span><MessageSquare size={13} />{formatNumber(video.commentCount)}</span></div>
          <div className="studio-video-footer"><span>{video.publishAt ? formatDate(video.publishAt) : "Chưa công khai"}</span><span className={`plan-status ${video.localStatus === "published" ? "published" : video.localStatus === "scheduled" ? "planned" : "idea"}`}>{localLabels[video.localStatus] || video.localStatus}</span></div>
          <div className="studio-video-actions"><button className="text-button" onClick={() => openDetail(video)}><Pencil size={13} />Quản lý</button><a className="text-button" href={watchUrl(video)} target="_blank" rel="noreferrer"><Play size={13} />Xem</a><a className="text-button" href={studioUrl(video)} target="_blank" rel="noreferrer"><ExternalLink size={13} />Studio</a></div>
        </div></article>)}</div> : <div className="empty-state card"><Film size={32} /><h2>{query || privacyFilter !== "all" || localFilter !== "all" ? "Không có video phù hợp" : "Chưa có video nào"}</h2><p>{query || privacyFilter !== "all" || localFilter !== "all" ? "Thử thay đổi từ khóa hoặc bộ lọc." : "Đăng video đầu tiên để bắt đầu quản lý kênh của bạn."}</p><button className="button button-primary" onClick={() => setTab("upload")}><Upload size={16} />Đăng video</button></div>}
    </div>}

    {tab === "upload" && <div className="studio-upload">
      <section className="card studio-upload-card">
        <div className="studio-upload-heading"><span className="studio-upload-icon"><Upload size={22} /></span><div><h2>Một video mới, một khởi đầu mới</h2><p>Lưu ý tưởng hôm nay. Sẵn sàng chia sẻ khi bạn muốn.</p></div></div>
        <form onSubmit={submitUpload} className="studio-upload-form">
          <label className="field-label" htmlFor="upload-file">File video <span className="required">*</span></label>
          <button type="button" className={`studio-dropzone ${file ? "has-file" : ""}`} onClick={() => fileInput.current?.click()}>
            {file ? <><FileVideo size={28} /><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type || "video"}</span><small>Chạm để chọn file khác</small></> : <><Upload size={28} /><strong>Chọn file video</strong><span>MP4, MOV, WebM · Tối đa 2 GB · Không bắt buộc khi Lên lịch phát hành</span><small>Chạm để chọn từ thiết bị</small></>}
          </button>
          <input ref={fileInput} id="upload-file" type="file" accept="video/*,.mp4,.mov,.webm,.mkv,.avi" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <label className="field-label" htmlFor="upload-title">Tiêu đề video <span className="required">*</span></label>
          <input id="upload-title" value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} maxLength={100} placeholder="Tiêu đề hấp dẫn cho video của bạn" required />
          <label className="field-label" htmlFor="upload-description">Mô tả</label>
          <textarea id="upload-description" rows={5} value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} maxLength={5000} placeholder="Giới thiệu nội dung, liên kết và hashtag…" />
          <label className="field-label" htmlFor="upload-format">Định dạng</label>
          <select id="upload-format" value={uploadFormat} onChange={(event) => setUploadFormat(event.target.value)}><option value="video">Video dài</option><option value="short">YouTube Shorts</option></select>
          <p className="field-hint">YouTube tự nhận diện Shorts theo tỷ lệ khung hình và thời lượng video.</p>
          <div className="form-two-columns"><div><label className="field-label" htmlFor="upload-privacy">Trạng thái</label><select id="upload-privacy" value={uploadPrivacy} onChange={(event) => setUploadPrivacy(event.target.value)}><option value="private">Riêng tư</option><option value="unlisted">Không công khai</option><option value="public">Công khai</option></select></div><div><label className="field-label" htmlFor="upload-publish-at">Lên lịch phát hành <span>(không bắt buộc)</span></label><input id="upload-publish-at" type="datetime-local" value={uploadPublishAt} onChange={(event) => setUploadPublishAt(event.target.value)} /></div></div>
          <div className="studio-preview"><span className="field-label">Xem trước nội dung</span><div className="studio-preview-card"><div className="studio-preview-thumb">{previewUrl ? <video src={previewUrl} muted preload="metadata" playsInline /> : <span className="studio-thumb-fallback large"><Play size={26} /></span>}<span className="studio-video-duration">{uploadFormat === "short" ? "Shorts" : "Video dài"}</span></div><div className="studio-preview-body"><strong>{uploadTitle.trim() || "Tiêu đề video của bạn"}</strong><span>{channel.title} · Mẫu thumbnail minh họa</span></div></div></div>
          <p className="field-hint">Nếu đặt ngày phát hành, video sẽ ở chế độ riêng tư cho đến thời gian đó. YouTube có thể mất vài phút để xử lý video sau khi tải lên.</p>
          {uploadError && <div className="form-error" role="alert">{uploadError}</div>}
          {uploadDone && <div className="studio-upload-success" role="status"><Check size={18} /><div><strong>Đã đăng lên YouTube</strong><p>{uploadDone.title}</p><a href={watchUrl(uploadDone)} target="_blank" rel="noreferrer">Xem video <ArrowUpRight size={13} /></a></div></div>}
          <div className="studio-upload-actions"><button type="submit" className="button button-primary" disabled={uploading || !file}>{uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}{uploading ? "Đang tải lên…" : "Đăng video lên YouTube"}</button></div>
        </form>
      </section>
      <aside className="studio-upload-side">
        <section className="card studio-side-card"><h3><ShieldCheck size={17} />Quyền đăng video</h3><p>Đăng video cần quyền tải lên riêng. Nếu chưa cấp, YouTube sẽ từ chối và bạn cần kết nối lại.</p><a className="button button-secondary full-width" href="/api/youtube/connect?scope=upload"><Link2 size={15} />Cấp quyền đăng video <ArrowUpRight size={14} /></a></section>
        <section className="card studio-side-card"><h3><Info size={17} />Lưu ý khi đăng</h3><ul><li>File tối đa 2GB, tải lên theo từng phần nên không tốn bộ nhớ.</li><li>Video xử lý xong mới xem được trên YouTube.</li><li>Chỉnh sửa tiêu đề, mô tả, thumbnail sau khi đăng tại YouTube Studio.</li></ul></section>
      </aside>
    </div>}

    {tab === "analytics" && <div className="studio-analytics">
      {analyticsLoading && !report ? <div className="loading-state card"><Loader2 size={26} className="spin" /><p>Đang đọc dữ liệu phân tích từ YouTube…</p></div> : report ? <>
        <div className="report-period"><span className="status-pill status-green"><span />Dữ liệu YouTube</span><span>{formatDate(report.startDate)} – {formatDate(report.endDate)}</span><button className="text-button" onClick={loadAnalytics}><RefreshCw size={13} />Làm mới</button></div>
        <div className="stat-grid analytics-stats">{[{ title: "Lượt xem", value: report.rows.reduce((sum, row) => sum + row.views, 0), icon: Eye }, { title: "Phút xem", value: Math.round(report.rows.reduce((sum, row) => sum + row.minutes, 0)), icon: Film }, { title: "Người đăng ký mới", value: report.rows.reduce((sum, row) => sum + row.subscribers, 0), icon: Users }].map(({ icon: Icon, ...stat }) => <div className="stat-card card" key={stat.title}><span className="stat-icon purple"><Icon size={21} /></span><span className="stat-number">{formatNumber(stat.value)}</span><span className="stat-label">{stat.title}</span></div>)}</div>
        <section className="card studio-panel"><div className="section-topline"><div><h2>Hiệu suất theo video</h2><p>28 ngày gần nhất, sắp xếp theo lượt xem.</p></div><BarChart3 size={20} /></div>
          {videoRows.length ? <div className="studio-analytics-list">{videoRows.map((row) => { const video = videos.find((item) => item.youtubeVideoId === row.videoId); const max = Math.max(...videoRows.map((item) => item.views), 1); return <div key={row.videoId} className="studio-analytics-row"><button className="studio-analytics-video" onClick={() => video && openDetail(video)}>{video?.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="studio-thumb-fallback"><Play size={16} /></span>}<span><strong>{video?.title || row.videoId}</strong><small>{formatNumber(row.views)} lượt xem · {formatNumber(Math.round(row.minutes))} phút xem · TB {formatDurationSeconds(row.averageDuration)}</small></span></button><div className="studio-analytics-bar"><span style={{ width: `${Math.max(3, (row.views / max) * 100)}%` }} /></div><strong>{formatNumber(row.views)}</strong></div>; })}</div> : <div className="empty-state compact-empty"><BarChart3 size={28} /><h3>Chưa có dữ liệu phân tích</h3><p>Kênh mới hoặc dữ liệu chưa được YouTube xử lý. Hãy quay lại sau.</p></div>}
        </section>
      </> : <div className="empty-state card"><BarChart3 size={30} /><h2>Chưa tải được phân tích</h2><p>Kiểm tra kết nối và thử lại.</p><button className="button button-secondary" onClick={loadAnalytics}><RefreshCw size={15} />Thử lại</button></div>}
    </div>}

    {tab === "comments" && <div className="studio-comments">
      <div className="studio-comments-toolbar"><label className="field-label" htmlFor="comment-video">Chọn video</label><select id="comment-video" value={commentVideoId} onChange={(event) => { setCommentVideoId(event.target.value); void loadComments(event.target.value); }}><option value="">Chọn video…</option>{videos.map((video) => <option key={video.id} value={video.youtubeVideoId}>{video.title}</option>)}</select><a className="button button-secondary" href="https://studio.youtube.com/channel/UC/comments" target="_blank" rel="noreferrer">Mở bình luận trong Studio <ArrowUpRight size={14} /></a></div>
      {commentsLoading ? <div className="loading-state card"><Loader2 size={24} className="spin" /><p>Đang tải bình luận…</p></div> : comments.length ? <div className="studio-comment-list">{comments.map((comment) => <article key={comment.id} className="studio-comment card"><div className="studio-comment-head"><span className="studio-comment-avatar">{comment.author.slice(0, 1).toUpperCase()}</span><div><strong>{comment.author}</strong><small>{comment.publishedAt ? formatDate(comment.publishedAt) : ""} · {comment.replyCount} trả lời</small></div><span className="studio-comment-likes"><Heart size={13} />{formatNumber(comment.likeCount)}</span></div><p>{comment.text}</p>{comment.authorChannelUrl && <a className="text-button" href={comment.authorChannelUrl} target="_blank" rel="noreferrer">Xem kênh <ArrowUpRight size={12} /></a>}</article>)}</div> : <div className="empty-state card"><MessageSquare size={30} /><h2>{commentVideoId ? "Chưa có bình luận" : "Chọn một video"}</h2><p>{commentVideoId ? "Video này chưa có bình luận công khai." : "Chọn video để xem bình luận mới nhất."}</p></div>}
      <p className="studio-comments-note">TubeFlow chỉ đọc bình luận. Ẩn, xóa hoặc trả lời bình luận tại YouTube Studio.</p>
    </div>}

    <Modal open={!!selected} onClose={() => !savingDetail && setSelected(null)} title="Quản lý video" description="Quản lý nội bộ trong TubeFlow. Chỉnh sửa metadata tại YouTube Studio.">
      {selected && <div className="studio-detail">
        <div className="studio-detail-head">{selected.thumbnail ? <img src={selected.thumbnail} alt="" /> : <span className="studio-thumb-fallback large"><Play size={24} /></span>}<div><h3>{selected.title}</h3><div className="studio-detail-meta"><span className={`plan-status ${selected.privacyStatus === "public" ? "published" : selected.privacyStatus === "private" ? "idea" : "planned"}`}>{privacyLabels[selected.privacyStatus] || selected.privacyStatus}</span><span>{selected.publishAt ? formatDate(selected.publishAt) : "Chưa công khai"}</span><span>{formatDuration(selected.duration)}</span></div></div></div>
        <div className="studio-detail-stats"><span><Eye size={14} />{formatNumber(selected.viewCount)} lượt xem</span><span><Heart size={14} />{formatNumber(selected.likeCount)} lượt thích</span><span><MessageSquare size={14} />{formatNumber(selected.commentCount)} bình luận</span></div>
        {selected.description && <p className="studio-detail-description">{selected.description}</p>}
        {selected.tags.length > 0 && <div className="studio-detail-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
        <div className="form-two-columns"><div><label className="field-label" htmlFor="detail-status">Trạng thái quản lý</label><select id="detail-status" value={detailStatus} onChange={(event) => setDetailStatus(event.target.value)}><option value="published">Đã đăng</option><option value="scheduled">Đã lên lịch</option><option value="draft">Nháp</option></select></div><div><label className="field-label" htmlFor="detail-plan">Liên kết kế hoạch</label><select id="detail-plan" value={detailPlan} onChange={(event) => setDetailPlan(event.target.value)}><option value="">Không liên kết</option>{data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></div></div>
        <label className="field-label" htmlFor="detail-notes">Ghi chú quản lý</label>
        <textarea id="detail-notes" rows={3} value={detailNotes} onChange={(event) => setDetailNotes(event.target.value)} maxLength={5000} placeholder="Ghi chú riêng cho video này…" />
        <div className="studio-detail-links"><a className="button button-secondary button-small" href={watchUrl(selected)} target="_blank" rel="noreferrer"><Play size={14} />Xem video</a><a className="button button-secondary button-small" href={studioUrl(selected)} target="_blank" rel="noreferrer"><ExternalLink size={14} />Chỉnh sửa trong Studio</a><button className="button button-secondary button-small" onClick={() => addToPlanner(selected)}><CalendarDays size={14} />Thêm vào lịch</button></div>
        <div className="modal-actions"><button className="text-button delete-action" onClick={() => setDeleting(selected)} disabled={savingDetail}><Trash2 size={15} />Xóa khỏi TubeFlow</button><button className="button button-secondary" onClick={() => setSelected(null)} disabled={savingDetail}>Đóng</button><button className="button button-primary" onClick={saveDetail} disabled={savingDetail}>{savingDetail ? <Loader2 size={15} className="spin" /> : <Check size={16} />}Lưu quản lý</button></div>
      </div>}
    </Modal>
    <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Xóa khỏi quản lý TubeFlow?" description="Video trên YouTube không bị xóa."><p className="modal-body-copy">“{deleting?.title}” sẽ không còn trong danh sách quản lý của TubeFlow. Bạn có thể đồng bộ lại bất cứ lúc nào.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setDeleting(null)}>Giữ lại</button><button className="button button-danger" onClick={removeLocal}><Trash2 size={15} />Xóa khỏi TubeFlow</button></div></Modal>
  </div>;
}
