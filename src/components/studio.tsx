"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronsUpDown, CircleHelp, Clapperboard, Coins, Grid2X2, Info, Layers2, Lightbulb, Link2, Loader2, Menu, Settings2, Sparkles, Target, Wand2, X } from "lucide-react";
import { BrandMark } from "@/components/ui";
import { Connections } from "@/components/connections";
import { Planner } from "@/components/planner";
import { Analytics, Overview, Settings } from "@/components/workspace-views";
import { StudioWorkspace } from "@/components/studio-workspace";
import { StrategyView } from "@/components/strategy-view";
import { MonetizationView } from "@/components/monetization-view";
import { MediaEditor } from "@/components/media-editor";
import { HelpDialog } from "@/components/help-dialog";
import { MobileNavigation, QuickCreateDialog } from "@/components/mobile-navigation";
import { ConnectivityNotice, InstallBanner, PwaInstallDialog, PwaSettingsCard, PwaUpdateDialog } from "@/components/pwa-experience";
import { usePwa } from "@/lib/use-pwa";
import { Smartphone } from "lucide-react";
import { requestJson } from "@/lib/client";
import type { PublicConfig, View, WorkspaceData } from "@/lib/types";
import { isView } from "@/lib/types";

const navigation = [
  { id: "overview" as View, label: "Tổng quan", icon: Grid2X2 },
  { id: "studio" as View, label: "YouTube Studio", icon: Clapperboard },
  { id: "strategy" as View, label: "Ý tưởng & chiến lược", icon: Target },
  { id: "monetization" as View, label: "Kiếm tiền", icon: Coins },
  { id: "planner" as View, label: "Lịch nội dung", icon: CalendarDays },
  { id: "ideas" as View, label: "Kho ý tưởng", icon: Lightbulb },
  { id: "analytics" as View, label: "Phân tích", icon: BarChart3 },
];
const management = [
  { id: "editor" as View, label: "Edit Video/Image", icon: Wand2 },
  { id: "connections" as View, label: "Kết nối kênh", icon: Link2 },
  { id: "settings" as View, label: "Cài đặt", icon: Settings2 },
];
const viewNames: Record<View, string> = { connections: "Kết nối kênh", overview: "Tổng quan", studio: "YouTube Studio", strategy: "Ý tưởng & chiến lược", monetization: "Kiếm tiền", editor: "Edit Video/Image", planner: "Lịch nội dung", ideas: "Kho ý tưởng", analytics: "Phân tích", settings: "Cài đặt không gian" };
const oauthMessages: Record<string, string> = {
  success: "Kết nối YouTube thành công! Chào mừng kênh của bạn đến với TubeFlow.",
  access_denied: "Bạn chưa cấp quyền truy cập. Có thể thử lại khi sẵn sàng; nếu ứng dụng đang Testing, kiểm tra email trong Test users.",
  invalid_state: "Phiên xác thực đã hết hạn hoặc không hợp lệ. Hãy bắt đầu kết nối lại từ trình duyệt này.",
  missing_config: "Máy chủ chưa có đủ cấu hình Google OAuth. Hãy làm theo 4 bước thiết lập bên dưới.",
  wrong_origin: "Địa chỉ đang mở khác APP_URL. Mở đúng URL triển khai hoặc cập nhật APP_URL và triển khai lại.",
  unauthorized: "Không tìm thấy phiên làm việc. Hãy cho phép cookie, tải lại trang rồi kết nối lại.",
  no_channel: "Tài khoản Google này chưa có kênh YouTube. Hãy chọn tài khoản quản lý kênh hoặc tạo kênh trước.",
  google_api: "Không đọc được dữ liệu kênh. Kiểm tra đã bật YouTube Data API v3 và YouTube Analytics API trong đúng dự án.",
  token_exchange: "Không đổi được mã xác thực. Kiểm tra Client ID, Client Secret và redirect URI, rồi thử kết nối lại.",
  offline_access: "Google chưa cấp refresh token. Hãy kết nối lại và cấp quyền truy cập đầy đủ.",
  missing_scopes: "Chưa được cấp đủ quyền. Kết nối lại và chọn cả quyền đọc YouTube lẫn YouTube Analytics.",
  connection_failed: "Chưa thể hoàn tất kết nối. Kiểm tra cấu hình Google Cloud và thử lại.",
};

export function Studio({ initialConfig, initialView = "connections" }: { initialConfig: PublicConfig; initialView?: View }) {
  const pwa = usePwa();
  const [view, setView] = useState<View>(initialView);
  const [config, setConfig] = useState(initialConfig);
  const [data, setData] = useState<WorkspaceData>({ name: "Không gian của tôi", completedSteps: [], plans: [], channel: null, videos: [] });
  const [initialized, setInitialized] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloading, setReloading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [popover, setPopover] = useState<"workspace" | "notifications" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState("guide");
  const [guideRequest, setGuideRequest] = useState(0);
  const [plannerRequest, setPlannerRequest] = useState(0);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const previousOnline = useRef(true);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), error ? 10000 : 6500);
  }, []);
  const loadWorkspace = useCallback(async () => {
    setReloading(true);
    try { const workspace = await requestJson<WorkspaceData>("/api/workspace"); setData(workspace); setInitialized(true); setLoadError(""); }
    catch (error) { setLoadError((error as Error).message); }
    finally { setReloading(false); }
  }, []);

  useEffect(() => {
    void loadWorkspace();
    const url = new URL(window.location.href);
    const requestedView = url.searchParams.get("view");
    if (isView(requestedView)) setView(requestedView);
    if (url.searchParams.get("install") === "1") {
      setInstallOpen(true);
      url.searchParams.delete("install");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
    const oauth = url.searchParams.get("oauth");
    if (oauth) {
      notify(oauthMessages[oauth] || oauthMessages.connection_failed, oauth !== "success");
      url.searchParams.delete("oauth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
    const onPopstate = () => { const next = new URL(window.location.href).searchParams.get("view"); setView(isView(next) ? next : "connections"); setPlannerRequest(0); };
    const onOutside = (event: MouseEvent) => { if (!(event.target as Element)?.closest("[data-popover]")) setPopover(null); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPopover(null); setMobileOpen(false); } };
    window.addEventListener("popstate", onPopstate);
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => { window.removeEventListener("popstate", onPopstate); document.removeEventListener("click", onOutside); document.removeEventListener("keydown", onEscape); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [loadWorkspace, notify]);
  useEffect(() => { document.title = `${viewNames[view]} · TubeFlow`; }, [view]);
  useEffect(() => {
    if (!previousOnline.current && pwa.online) {
      notify("Thiết bị đã có mạng trở lại. Bạn có thể tiếp tục lưu nội dung.");
      if (!document.querySelector('[role="dialog"]')) void loadWorkspace();
    }
    previousOnline.current = pwa.online;
  }, [pwa.online, loadWorkspace, notify]);

  function navigate(next: View) {
    setView(next); setMobileOpen(false); setPopover(null); setPlannerRequest(0);
    const url = new URL(window.location.href);
    if (next === "connections") url.searchParams.delete("view"); else url.searchParams.set("view", next);
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function showHelp(topic = "guide") { setHelpTopic(topic); setHelpOpen(true); setPopover(null); }
  function openGuide() { setHelpOpen(false); navigate("connections"); setGuideRequest((value) => value + 1); }
  function createContent() { navigate("planner"); setPlannerRequest((value) => value + 1); }
  function createIdea() { navigate("ideas"); setPlannerRequest((value) => value + 1); }
  function openInstall() { setMobileOpen(false); setPopover(null); setInstallOpen(true); }
  const hasNotification = !config.ready || !data.channel;

  return <div className="app-shell" data-app-mode={pwa.standalone ? "standalone" : "browser"}>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    {mobileOpen && <button className="sidebar-overlay" aria-label="Đóng điều hướng" onClick={() => setMobileOpen(false)} />}
    <aside id="primary-sidebar" className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <button className="brand" onClick={() => navigate("overview")} aria-label="TubeFlow — về trang tổng quan"><BrandMark /><span>Tube<span className="brand-flow">Flow</span></span><span className="brand-period" /></button>
      <div className="workspace-switcher-container" data-popover><button className={`workspace-switcher ${popover === "workspace" ? "is-open" : ""}`} onClick={() => setPopover(popover === "workspace" ? null : "workspace")} aria-expanded={popover === "workspace"}><span className="workspace-avatar"><Layers2 size={18} /></span><span><strong>{data.name}</strong><small>Không gian cá nhân</small></span><ChevronsUpDown size={14} /></button>{popover === "workspace" && <div className="workspace-popover"><span className="popover-label">KHÔNG GIAN CỦA BẠN</span><div><span className="workspace-avatar"><Layers2 size={17} /></span><strong>{data.name}</strong><Check size={15} /></div><p>Dữ liệu riêng trên trình duyệt này.</p><button onClick={() => navigate("settings")}><Settings2 size={15} />Quản lý không gian <ArrowRight size={14} /></button></div>}</div>
      <nav className="sidebar-navigation" aria-label="Điều hướng chính"><div className="nav-group-label">KHÔNG GIAN LÀM VIỆC</div>{navigation.map(({ icon: Icon, ...item }) => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item ${view === item.id ? "active" : ""}`} aria-current={view === item.id ? "page" : undefined}><Icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{item.id === "ideas" && data.plans.some((plan) => plan.status === "idea") && <span className="nav-count">{data.plans.filter((plan) => plan.status === "idea").length}</span>}{view === item.id && <span className="nav-active-dot" />}</button>)}<div className="nav-group-label management-label">QUẢN LÝ</div>{management.map(({ icon: Icon, ...item }) => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item ${view === item.id ? "active" : ""}`} aria-current={view === item.id ? "page" : undefined}><Icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{view === item.id && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-guide-card"><span className="sidebar-guide-icon"><BookOpen size={19} /></span><span className="guide-decoration one" /><span className="guide-decoration two" /><h3>Bắt đầu thật dễ dàng</h3><p>Một vài bước nhỏ cho hành trình sáng tạo lớn.</p><button onClick={openGuide}>Khám phá hướng dẫn <ArrowUpRight size={14} /></button></div><button className="sidebar-install-link" onClick={openInstall}><Smartphone size={17} /><span>{pwa.standalone ? "Ứng dụng của bạn" : "Ứng dụng trên điện thoại"}</span><ArrowUpRight size={13} /></button><button className="profile-button" onClick={() => navigate("settings")}><span className="profile-avatar">B<span /></span><span className="profile-name"><strong>Nhà sáng tạo</strong><small>Không gian cá nhân</small></span><ChevronsUpDown size={15} /></button></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="topbar-left"><button className="mobile-brand" onClick={() => navigate("overview")} aria-label="TubeFlow — mở tổng quan"><BrandMark /><span>TubeFlow<small>Không gian sáng tạo</small></span></button><div className="breadcrumbs"><span className="breadcrumb-icon">{view === "connections" || view === "settings" ? <Settings2 size={16} /> : <Layers2 size={16} />}</span><span>{view === "connections" || view === "settings" ? "Cài đặt" : "Không gian làm việc"}</span><ChevronRight size={13} /><strong>{viewNames[view]}</strong></div></div><div className="topbar-right"><span className="personal-space"><span />Không gian cá nhân</span><span className="topbar-divider" /><button className="icon-button desktop-help" onClick={() => showHelp()} aria-label="Trung tâm trợ giúp" title="Trung tâm trợ giúp"><CircleHelp size={19} /></button><div className="notification-container" data-popover><button className={`icon-button notification-button ${popover === "notifications" ? "selected" : ""}`} onClick={() => setPopover(popover === "notifications" ? null : "notifications")} aria-label="Thông báo" aria-expanded={popover === "notifications"}><Bell size={19} />{hasNotification && <span />}</button>{popover === "notifications" && <div className="notification-popover"><h3>Thông báo của bạn <span>{hasNotification ? 1 : 0}</span></h3>{hasNotification ? <button onClick={() => { navigate("connections"); setGuideRequest((value) => value + 1); }}><span className="notification-symbol"><Link2 size={18} /></span><span><strong>{config.ready ? "Sẵn sàng kết nối kênh" : "Hoàn tất thiết lập YouTube"}</strong><small>{config.ready ? "Máy chủ đã có đủ biến môi trường. Kết nối kênh để bắt đầu đồng bộ." : "Chỉ còn vài bước để mang dữ liệu kênh vào không gian sáng tạo của bạn."}</small><span>Xem hướng dẫn <ArrowRight size={12} /></span></span></button> : <div className="no-notifications"><CheckCircle2 size={24} /><p>Bạn đã cập nhật mọi thứ!</p></div>}</div>}</div><button className="icon-button mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Mở điều hướng" aria-expanded={mobileOpen} aria-controls="primary-sidebar"><Menu size={22} /></button><span className="topbar-avatar" aria-label="Không gian của bạn">B</span></div></header>
      <main className="main-content" id="main-content">{loadError && <div className="load-error" role="alert"><Info size={18} /><span>{loadError}</span><button className="text-button" onClick={loadWorkspace} disabled={reloading}>{reloading ? <Loader2 size={14} className="spin" /> : "Thử lại"}</button></div>}
        <ConnectivityNotice online={pwa.online} />
        {view !== "settings" && <InstallBanner pwa={pwa} onOpen={openInstall} />}
        {pwa.updateAvailable && !updateDismissed && <div className="pwa-update-banner"><span><Sparkles size={16} />Phiên bản mới đã sẵn sàng.</span><button className="text-button" onClick={() => setUpdateOpen(true)}>Xem cập nhật</button><button className="icon-button" aria-label="Để thông báo cập nhật sau" onClick={() => setUpdateDismissed(true)}><X size={15} /></button></div>}
        {view === "connections" && <Connections config={config} onConfigChange={setConfig} data={data} initialized={initialized} onStepsChange={(steps) => setData((current) => ({ ...current, completedSteps: steps }))} onChannelChange={(channel) => setData((current) => ({ ...current, channel }))} notify={notify} onNavigate={navigate} onHelp={showHelp} guideRequest={guideRequest} />}
        {view === "overview" && <Overview data={data} onNavigate={navigate} onCreate={createContent} />}
        {view === "studio" && <StudioWorkspace data={data} config={config} onNavigate={navigate} onPlansChange={(plans) => setData((current) => ({ ...current, plans }))} onVideosChange={(videos) => setData((current) => ({ ...current, videos }))} notify={notify} />}
        {view === "strategy" && <StrategyView data={data} onNavigate={navigate} onPlansChange={(plans) => setData((current) => ({ ...current, plans }))} notify={notify} />}
        {view === "monetization" && <MonetizationView connected={!!data.channel} onNavigate={navigate} notify={notify} />}
        {view === "editor" && <MediaEditor data={data} onNavigate={navigate} notify={notify} />}
        {(view === "planner" || view === "ideas") && <Planner key={view} plans={data.plans} onChange={(plans) => setData((current) => ({ ...current, plans }))} mode={view} initialized={initialized} notify={notify} newRequest={plannerRequest} />}
        {view === "analytics" && <Analytics channel={data.channel} onNavigate={navigate} />}
        {view === "settings" && <Settings data={data} config={config} installation={<PwaSettingsCard pwa={pwa} onInstall={openInstall} onUpdate={() => setUpdateOpen(true)} />} onNameChange={(name) => setData((current) => ({ ...current, name }))} notify={notify} onNavigate={navigate} />}
      </main>
    </div>
    <MobileNavigation view={view} onNavigate={navigate} onCreate={() => setQuickCreateOpen(true)} />
    <QuickCreateDialog open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} onPlan={createContent} onIdea={createIdea} />
    <PwaInstallDialog open={installOpen} onClose={() => setInstallOpen(false)} pwa={pwa} onSettings={() => navigate("settings")} />
    <PwaUpdateDialog open={updateOpen} onClose={() => setUpdateOpen(false)} onConfirm={pwa.applyUpdate} />
    <HelpDialog open={helpOpen} topic={helpTopic} onClose={() => setHelpOpen(false)} onGuide={openGuide} />
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.error ? <Info size={19} /> : <CheckCircle2 size={19} />}<span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Đóng thông báo" title="Đóng thông báo"><X size={17} /></button></div>}
  </div>;
}
