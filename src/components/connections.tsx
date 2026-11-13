"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, CheckCheck, CircleHelp, ExternalLink, Info, Link2, Loader2, LockKeyhole, RefreshCw, Server, ShieldCheck, Sparkles, Unplug, X } from "lucide-react";
import { BrandMark, CopyButton, Modal, YouTubeMark } from "@/components/ui";
import { formatNumber, requestJson } from "@/lib/client";
import { SetupWalkthrough } from "@/components/setup-walkthrough";
import type { Channel, PublicConfig, View, WorkspaceData } from "@/lib/types";

interface Props {
  config: PublicConfig;
  onConfigChange: (value: PublicConfig) => void;
  data: WorkspaceData;
  initialized: boolean;
  onStepsChange: (steps: number[]) => void;
  onChannelChange: (channel: Channel | null) => void;
  notify: (message: string, error?: boolean) => void;
  onNavigate: (view: View) => void;
  onHelp: (topic?: string) => void;
  guideRequest: number;
}

const stepTitles = ["Bật các API của YouTube", "Tạo thông tin xác thực OAuth", "Thêm biến môi trường", "Thêm URI và kết nối kênh"];
const stepDescriptions = ["Cho phép ứng dụng truy cập dữ liệu YouTube.", "Thiết lập màn hình đồng ý và OAuth Client.", "Lưu thông tin kết nối an toàn trên máy chủ.", "Hoàn tất cấu hình và bắt đầu đồng bộ."];

export function Connections({ config, onConfigChange, data, initialized, onStepsChange, onChannelChange, notify, onNavigate, onHelp, guideRequest }: Props) {
  const [tab, setTab] = useState("connection");
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [modal, setModal] = useState<"setup" | "disconnect" | "origin" | null>(null);
  const [busy, setBusy] = useState(false);
  const channel = data.channel;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("guide") === "1") {
      setWalkthroughOpen(true);
      url.searchParams.delete("guide");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, []);

  useEffect(() => {
    if (guideRequest > 0) {
      setTab("connection");
      setWalkthroughOpen(true);
    }
  }, [guideRequest]);

  async function checkConfig() {
    setChecking(true);
    try {
      const fresh = await requestJson<PublicConfig>("/api/config");
      onConfigChange(fresh);
      setLastChecked(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      notify(fresh.ready ? "Đủ 4 biến môi trường. Bạn đã có thể kết nối kênh!" : `Máy chủ còn ${fresh.checks.filter((check) => !check.configured).length} biến cần cấu hình. Hãy lưu biến và triển khai lại.`);
    } catch (error) { notify((error as Error).message, true); }
    finally { setChecking(false); }
  }

  function connect() {
    if (!config.ready) { setModal("setup"); return; }
    if (!initialized) { notify("Chưa tải được phiên làm việc. Vui lòng tải lại trang.", true); return; }
    if (window.location.origin !== config.appUrl) { setModal("origin"); return; }
    setBusy(true);
    window.location.assign("/api/youtube/connect");
  }

  async function sync() {
    setBusy(true);
    try {
      const fresh = await requestJson<Channel>("/api/youtube/sync", { method: "POST" });
      onChannelChange(fresh);
      notify("Đã cập nhật thông tin mới nhất từ YouTube.");
    } catch (error) { notify((error as Error).message, true); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const result = await requestJson<{ warning: string | null }>("/api/youtube/disconnect", { method: "POST" });
      onChannelChange(null);
      setModal(null);
      notify(result.warning || "Đã ngắt kết nối. Kế hoạch nội dung của bạn vẫn được giữ lại.", !!result.warning);
    } catch (error) { notify((error as Error).message, true); }
    finally { setBusy(false); }
  }

  return <div className="connections-page">
    <div className="page-heading"><div><div className="eyebrow">KHÔNG GIAN SÁNG TẠO CỦA BẠN</div><h1>Kết nối kênh<span className="heading-dot">.</span></h1><p>Kết nối dữ liệu, thấu hiểu khán giả và lên kế hoạch tốt hơn.</p></div><button className="button button-secondary heading-help" onClick={() => setWalkthroughOpen(true)}><BookOpen size={16} /> Hướng dẫn thao tác <ArrowUpRight size={15} /></button></div>
    <div className="page-tabs" role="tablist" aria-label="Cài đặt kết nối"><button role="tab" aria-selected={tab === "connection"} onClick={() => setTab("connection")} className={tab === "connection" ? "active" : ""}><Link2 size={16} /> Kết nối kênh <span className="tab-count">{channel ? 1 : 0}</span></button><button role="tab" aria-selected={tab === "permissions"} onClick={() => setTab("permissions")} className={tab === "permissions" ? "active" : ""}><ShieldCheck size={16} /> Quyền truy cập</button></div>

    <section className="channel-card card">
      <div className="youtube-app-icon"><YouTubeMark /></div>
      <div className="channel-main"><div className="channel-title"><h2>{channel ? channel.title : "YouTube"}</h2><span className={`status-pill ${channel ? "status-green" : "status-neutral"}`}><span />{channel ? "Đã kết nối" : "Chưa kết nối"}</span></div><p>{channel ? `Kênh của bạn đã sẵn sàng. Dữ liệu cập nhật ${new Date(channel.updatedAt).toLocaleDateString("vi-VN")}.` : "Một kết nối. Nhiều cơ hội phát triển kênh hơn."}</p><div className="channel-features">{channel ? <><span><CheckCheck size={14} />{formatNumber(channel.subscribers)} người đăng ký</span><span><BarChart3 size={14} />{formatNumber(channel.views)} lượt xem</span><span><YouTubeMark />{formatNumber(channel.videoCount)} video</span></> : <><span><Check size={14} /> Đồng bộ dữ liệu kênh</span><span><Check size={14} /> Theo dõi hiệu suất</span><span><Check size={14} /> Lập kế hoạch hiệu quả</span></>}</div></div>
      <div className="channel-actions">{channel ? <><button className="button button-primary" onClick={sync} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}Đồng bộ dữ liệu</button><button className="text-button muted" onClick={() => setModal("disconnect")}><Unplug size={13} />Ngắt kết nối</button></> : <><button className="button button-primary connect-button" onClick={connect} disabled={busy}><Link2 size={17} /> Kết nối kênh <ArrowUpRight size={16} /></button><span className="secure-caption"><LockKeyhole size={12} /> Bảo mật với Google OAuth</span></>}</div>
    </section>

    {tab === "connection" ? <div className="connection-grid">
      <div className="setup-column">
        {!config.ready ? <div className="configuration-notice"><span className="notice-icon"><Info size={19} /></span><div><strong>Cần thiết lập Google OAuth</strong><p>Máy chủ chưa có đủ thông tin kết nối. Bạn vẫn có thể <button onClick={() => onNavigate("planner")}>lập kế hoạch</button> như bình thường.</p></div></div> : <div className="configuration-notice notice-success"><ShieldCheck size={20} /><div><strong>Cấu hình máy chủ đã sẵn sàng</strong><p>Hoàn thành thiết lập trong Google Cloud, sau đó chọn Kết nối kênh.</p></div><Check size={18} /></div>}
        <div className="planning-note"><span className="planning-note-icon"><Sparkles size={17} /></span><div><strong>Sáng tạo không cần chờ đợi</strong><p>Lưu ý tưởng và lên lịch nội dung ngay cả khi chưa kết nối kênh.</p></div><button onClick={() => onNavigate("planner")} aria-label="Đi đến lịch nội dung"><ArrowRight size={19} /></button></div>
      </div>

      <aside className="configuration-sidebar">
        <section className="server-card card"><div className="aside-card-heading"><span><Server size={17} /><h3>Trạng thái máy chủ</h3></span><span className={`tiny-status-dot ${config.ready ? "green" : "amber"}`} /></div><p className="aside-description">Kiểm tra các biến môi trường cần thiết.</p><div className="environment-checks">{config.checks.map((check) => <div className="environment-row" key={check.name} title={check.hint}><span>{check.label}</span><span className={check.configured ? "env-status configured" : "env-status"}>{check.configured ? <Check size={11} /> : <span className="small-dot" />}{check.configured ? "Đã có" : "Chưa có"}</span></div>)}</div><button className="button button-secondary full-width check-config-button" onClick={checkConfig} disabled={checking}>{checking ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} {checking ? "Đang kiểm tra..." : "Kiểm tra lại cấu hình"}</button><p className="server-footnote">{lastChecked ? `Đã kiểm tra lúc ${lastChecked} · Không hiển thị giá trị bí mật` : <><LockKeyhole size={11} /> Giá trị bí mật không được hiển thị</>}</p></section>
        <section className="redirect-card card"><div className="aside-card-heading"><span><Link2 size={17} /><h3>Địa chỉ chuyển hướng</h3></span></div><p className="aside-description">Authorized redirect URI</p><div className="redirect-uri"><code>{config.appUrl}<wbr />/api/youtube/callback</code><CopyButton text={config.redirectUri} compact label="Sao chép Authorized redirect URI" /></div><p className="redirect-explanation">Dán chính xác địa chỉ này vào cấu hình OAuth Client trên Google Cloud.</p>{config.appUrl.includes("localhost") && <div className="localhost-note"><Info size={12} /><span>localhost chỉ dùng trên máy cá nhân.</span></div>}<button className="text-button" onClick={() => setWalkthroughOpen(true)}>Xem cách cấu hình <ArrowRight size={13} /></button></section>
        <section className="security-card"><div className="security-card-heading"><span className="security-symbol"><ShieldCheck size={20} /></span><h3>Kết nối an toàn.<br />Bạn luôn nắm quyền.</h3></div><ul><li><Check size={13} />Quyền đọc dữ liệu theo mặc định</li><li><Check size={13} />Đăng video chỉ khi bạn cấp thêm quyền</li><li><Check size={13} />Ngắt kết nối bất cứ lúc nào</li></ul><button className="text-button" onClick={() => { setTab("permissions"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Tìm hiểu về quyền truy cập <ArrowUpRight size={13} /></button></section>
        <div className="sidebar-help"><CircleHelp size={17} /><div><span>Bạn cần một chút trợ giúp?</span><button className="text-button" onClick={() => onHelp("troubleshooting")}>Xem các câu hỏi thường gặp <ArrowUpRight size={12} /></button></div></div>
      </aside>
    </div> : <section className="permissions-section card"><div className="permissions-hero"><span className="permissions-icon"><ShieldCheck size={29} /></span><div><span className="eyebrow">MINH BẠCH & AN TOÀN</span><h2>Kênh của bạn. Quyền kiểm soát của bạn.</h2><p>TubeFlow chỉ đọc những dữ liệu cần thiết để giúp bạn hiểu và phát triển kênh.</p></div></div><div className="permission-grid"><div className="permission-item"><BarChart3 size={21} /><h3>Thông tin và hiệu suất kênh</h3><p>Đọc tên kênh, số người đăng ký, danh sách video, lượt xem và thời gian xem. Báo cáo chỉ được lấy khi bạn mở trang Phân tích hoặc đồng bộ.</p><code>youtube.readonly<br />yt-analytics.readonly<br />youtube.upload <span>(khi đăng video)</span></code></div><div className="permission-item"><LockKeyhole size={21} /><h3>Token được mã hóa</h3><p>Token được mã hóa bằng AES-256-GCM trước khi lưu trong cơ sở dữ liệu. Client Secret và token không được gửi về trình duyệt.</p><span className="status-pill status-green"><Check size={12} /> Chỉ lưu ở máy chủ</span></div></div><div className="permission-exclusions"><h3>Những điều TubeFlow không làm</h3><span><X size={15} /> Tự đăng hoặc xóa video</span><span><X size={15} /> Chỉnh sửa thông tin kênh</span><span><X size={15} /> Đọc mật khẩu Google của bạn</span></div><div className="permission-footer"><div><h3>Bạn có thể thay đổi quyết định bất cứ lúc nào.</h3><p>Ngắt kết nối sẽ xóa token và dữ liệu kênh đã lưu tại TubeFlow. Kế hoạch nội dung vẫn được giữ lại.</p></div>{channel ? <button className="button button-secondary" onClick={() => setModal("disconnect")}><Unplug size={15} /> Ngắt kết nối</button> : <a className="button button-secondary" href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Quản lý quyền tại Google <ExternalLink size={14} /></a>}</div></section>}

    <footer className="page-footer"><span><ShieldCheck size={14} /> Được thiết kế để bảo vệ dữ liệu của bạn.</span><div><button onClick={() => onHelp("privacy")}>Chính sách bảo mật</button><span>·</span><a href="https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps" target="_blank" rel="noreferrer">Tài liệu Google <ArrowUpRight size={12} /></a></div></footer>

    <SetupWalkthrough open={walkthroughOpen} onClose={() => setWalkthroughOpen(false)} config={config} onConfigChange={onConfigChange} completedSteps={data.completedSteps} onProgress={onStepsChange} initialized={initialized} onConnect={connect} />
    <Modal open={modal === "setup"} onClose={() => setModal(null)} title="Một bước nhỏ trước khi kết nối" description="Máy chủ cần đủ thông tin Google OAuth để kết nối an toàn."><div className="modal-connection-art"><span className="art-app"><YouTubeMark /></span><span className="art-dashes" /><span className="art-link"><Link2 size={19} /></span><span className="art-dashes" /><BrandMark /></div><div className="missing-config-list">{config.checks.filter((check) => !check.configured).map((check) => <div key={check.name}><span className="small-dot" /><div><code>{check.name}</code><p>{check.hint}</p></div></div>)}</div><p className="field-hint">Bạn không cần nhập khóa bí mật vào trang này. Thêm chúng trong cài đặt máy chủ, triển khai lại rồi kiểm tra cấu hình.</p><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Để sau</button><button className="button button-primary" onClick={() => { setModal(null); setWalkthroughOpen(true); }}>Xem hướng dẫn thiết lập <ArrowRight size={15} /></button></div></Modal>
    <Modal open={modal === "origin"} onClose={() => setModal(null)} title="Mở đúng địa chỉ ứng dụng" description="Địa chỉ đang mở không trùng với APP_URL trên máy chủ."><p className="modal-body-copy">Để cookie xác thực quay về đúng nơi, hãy mở ứng dụng tại địa chỉ dưới đây, hoặc cập nhật APP_URL theo tên miền hiện tại và triển khai lại.</p><div className="redirect-uri"><code>{config.appUrl}</code><CopyButton text={config.appUrl} compact /></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Đóng</button><a href={config.appUrl} className="button button-primary">Mở ứng dụng <ArrowUpRight size={15} /></a></div></Modal>
    <Modal open={modal === "disconnect"} onClose={() => !busy && setModal(null)} title="Ngắt kết nối kênh YouTube?" description="Bạn có thể kết nối lại bất cứ lúc nào."><div className="disconnect-info"><Unplug size={26} /><p>TubeFlow sẽ thu hồi quyền truy cập với Google, xóa token và thông tin kênh đã lưu. <strong>Ý tưởng và kế hoạch nội dung của bạn không bị xóa.</strong></p></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)} disabled={busy}>Giữ kết nối</button><button className="button button-danger" onClick={disconnect} disabled={busy}>{busy && <Loader2 size={15} className="spin" />}Ngắt kết nối</button></div></Modal>
  </div>;
}
