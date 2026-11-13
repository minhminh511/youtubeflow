"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, Cloud, Download, ExternalLink, FileKey2, Globe2, Info, KeyRound, Laptop, Link2, Loader2, RefreshCw, Server, ShieldCheck, Terminal, XCircle } from "lucide-react";
import { CopyButton, downloadText, GoogleMark, Modal } from "@/components/ui";
import { requestJson } from "@/lib/client";
import { GOOGLE_READ_SCOPES, isLocalSetupUrl, isQuickTunnelUrl, normalizeSetupUrl, setupEnvironmentTemplate, setupHandoff } from "@/lib/setup-guide";
import type { PublicConfig } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  config: PublicConfig;
  onConfigChange: (config: PublicConfig) => void;
  completedSteps: number[];
  onProgress: (steps: number[]) => void;
  initialized: boolean;
  onConnect: () => void;
}

const titles = ["Nơi chạy", "Bật API", "OAuth Client", "Biến môi trường", "Chạy & kết nối"];

export function SetupWalkthrough({ open, onClose, config, onConfigChange, completedSteps, onProgress, initialized, onConnect }: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"hosted" | "local">("hosted");
  const [url, setUrl] = useState("");
  const [browserOrigin, setBrowserOrigin] = useState("");
  const [hostedUrl, setHostedUrl] = useState("");
  const [provider, setProvider] = useState("generic");
  const [dataApi, setDataApi] = useState(false);
  const [analyticsApi, setAnalyticsApi] = useState(false);
  const [clientSaved, setClientSaved] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [checkMessage, setCheckMessage] = useState("");
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const prepared = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || prepared.current) return;
    prepared.current = true;
    const current = window.location.origin;
    const configuredUrl = config.checks.find((check) => check.name === "APP_URL")?.configured;
    const chosen = configuredUrl ? config.appUrl : current;
    setBrowserOrigin(current);
    setUrl(chosen);
    setMode(isLocalSetupUrl(chosen) ? "local" : "hosted");
    if (isQuickTunnelUrl(chosen)) setProvider("cloudflare");
    setHostedUrl(!isLocalSetupUrl(current) ? current : "");
    setDataApi(completedSteps.includes(1));
    setAnalyticsApi(completedSteps.includes(1));
    setClientSaved(completedSteps.includes(2) && completedSteps.includes(4));
  }, [open, config, completedSteps]);

  useEffect(() => {
    if (!open) return;
    const dialog = contentRef.current?.closest<HTMLElement>(".modal");
    dialog?.scrollTo({ top: 0, behavior: "instant" });
  }, [step, open]);

  const origin = normalizeSetupUrl(url);
  const validMode = !!origin && (mode === "local" ? isLocalSetupUrl(origin) : !isLocalSetupUrl(origin));
  const redirectUri = origin ? `${origin}/api/youtube/callback` : "";
  const tokenAlreadySet = config.checks.some((check) => check.name === "YOUTUBE_TOKEN_SECRET" && check.configured);
  const serverUrlSet = config.checks.some((check) => check.name === "APP_URL" && check.configured);
  const matchesDraft = !!origin && config.appUrl === origin;
  const matchesBrowser = browserOrigin === config.appUrl;
  const canConnect = config.ready && validMode && matchesDraft && matchesBrowser && initialized && healthOk !== false;

  function chooseMode(next: "hosted" | "local") {
    if (mode === "hosted") setHostedUrl(url);
    setMode(next);
    setUrl(next === "local" ? "http://localhost:3000" : hostedUrl);
    setError("");
  }

  function goTo(next: number) { setStep(next); setError(""); }

  async function saveProgress(items: number[]) {
    for (const item of items) {
      const result = await requestJson<{ completedSteps: number[] }>("/api/setup", { method: "PATCH", body: JSON.stringify({ step: item, completed: true }) });
      onProgress(result.completedSteps);
    }
  }

  async function next() {
    setError("");
    if (step === 0 && !validMode) { setError("Nhập URL gốc hợp lệ, đúng nơi chạy ứng dụng."); return; }
    if (step === 1 && (!dataApi || !analyticsApi)) { setError("Bật cả hai API trong Google Cloud, sau đó đánh dấu hai ô xác nhận."); return; }
    if (step === 2 && !clientSaved) { setError("Hoàn tất OAuth Client và lưu URI, rồi đánh dấu ô xác nhận."); return; }
    setSaving(true);
    try {
      if (step === 1 || step === 2) {
        if (!initialized) throw new Error("Phiên làm việc chưa sẵn sàng. Đóng hướng dẫn, tải lại trang và thử lại.");
        await saveProgress(step === 1 ? [1] : [2, 4]);
      }
      setStep((current) => Math.min(current + 1, 4));
    } catch (issue) { setError((issue as Error).message); }
    finally { setSaving(false); }
  }

  function generateSecret() {
    const random = crypto.getRandomValues(new Uint8Array(32));
    setGeneratedSecret(Array.from(random, (value) => value.toString(16).padStart(2, "0")).join(""));
  }

  async function verifyServer() {
    setChecking(true); setError(""); setCheckMessage("");
    try {
      const [fresh, health] = await Promise.all([
        requestJson<PublicConfig>("/api/config"),
        requestJson<{ ok: boolean }>("/api/health").catch(() => ({ ok: false })),
      ]);
      onConfigChange(fresh);
      setHealthOk(health.ok);
      setCheckedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      const missing = fresh.checks.filter((check) => !check.configured);
      setCheckMessage(missing.length ? `Còn ${missing.length} biến chưa có hoặc chưa đúng định dạng. Hãy điền tại nơi triển khai, lưu và chạy lại máy chủ.` : "Máy chủ đã nhận đủ 4 biến. Đây chưa phải xác nhận kết nối Google; hãy tiếp tục đăng nhập và cấp quyền.");
      if (!health.ok) setError("Cơ sở dữ liệu chưa phản hồi. Kiểm tra PostgreSQL và DATABASE_URL trước khi kết nối kênh.");
    } catch (issue) { setError((issue as Error).message); }
    finally { setChecking(false); }
  }

  function valueBox(label: string, value: string, copyLabel: string) {
    return <div className="walk-value"><span>{label}</span><div><code>{value}</code><CopyButton text={value} compact label={copyLabel} /></div></div>;
  }

  return <Modal open={open} onClose={() => !saving && !checking && onClose()} title="Cùng bạn kết nối YouTube" description="Làm theo từng màn hình. Không cần tự viết mã kết nối." wide>
    <div className="walkthrough" ref={contentRef}>
      <nav className="walk-navigation" aria-label="Các bước hướng dẫn thao tác">{titles.map((title, index) => <button type="button" key={title} className={index === step ? "active" : ""} aria-current={index === step ? "step" : undefined} onClick={() => goTo(index)} disabled={saving || checking}><span>{index + 1}</span><small>{title}</small></button>)}</nav>
      <div className="walk-panel">
        <span className="walk-location">BƯỚC {step + 1} / 5 · {step === 1 || step === 2 ? "TRONG GOOGLE CLOUD" : step === 3 ? mode === "hosted" ? "TẠI NƠI TRIỂN KHAI ỨNG DỤNG" : "TRÊN MÁY TÍNH CỦA BẠN" : "TRONG ỨNG DỤNG"}</span>

        {step === 0 && <>
          <h3>Trước tiên, dùng đúng địa chỉ ứng dụng</h3>
          <p className="walk-intro">Nếu đang dùng bản ứng dụng trên web, chọn cách đầu tiên. <strong>Bạn không cần chạy lệnh terminal</strong> để làm các bước Google Cloud.</p>
          <div className="walk-mode-options" role="group" aria-label="Nơi chạy ứng dụng"><button type="button" className={mode === "hosted" ? "selected" : ""} aria-pressed={mode === "hosted"} onClick={() => chooseMode("hosted")}><Cloud size={21} /><span><strong>Ứng dụng đang triển khai</strong><small>Dùng tên miền HTTPS của ứng dụng</small></span>{mode === "hosted" && <Check size={16} />}</button><button type="button" className={mode === "local" ? "selected" : ""} aria-pressed={mode === "local"} onClick={() => chooseMode("local")}><Laptop size={21} /><span><strong>Chạy trên máy cá nhân</strong><small>Cần mã nguồn, Node.js và PostgreSQL</small></span>{mode === "local" && <Check size={16} />}</button></div>
          <label className="field-label" htmlFor="walk-app-url">URL gốc của ứng dụng <span>APP_URL</span></label>
          <div className="walk-url-field"><Globe2 size={16} /><input id="walk-app-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={mode === "hosted" ? "https://ung-dung-cua-ban.com" : "http://localhost:3000"} autoComplete="off" /></div>
          <button type="button" className="text-button walk-current-url" onClick={() => { const current = window.location.origin; setUrl(current); setMode(isLocalSetupUrl(current) ? "local" : "hosted"); if (!isLocalSetupUrl(current)) setHostedUrl(current); }}>Dùng địa chỉ ứng dụng đang mở <ArrowUpRight size={13} /></button>
          {url && !validMode && <p className="field-error">{mode === "hosted" ? "Bản triển khai cần URL HTTPS thật, không phải localhost." : "Chọn URL localhost hoặc 127.0.0.1 đúng cổng máy chủ của bạn."} Không thêm đường dẫn, query hoặc thông tin đăng nhập.</p>}
          {validMode && valueBox("URI sẽ dán vào Google Cloud", redirectUri, "Sao chép URI cho Google Cloud")}
          <div className="walk-callout"><Info size={17} /><div><strong>URL này là bản hướng dẫn, chưa thay đổi máy chủ.</strong><p>Ở bước 4, bạn vẫn phải đặt APP_URL tại nơi triển khai. Nếu đang xem trong khung preview, nút trên lấy URL của ứng dụng, không lấy URL trang trò chuyện. Nên dùng tên miền ổn định; URL preview đổi thì cần cập nhật cả APP_URL và URI.</p></div></div>
          <p className="walk-small">Cần có: tài khoản Google quản lý kênh, quyền tạo dự án Google Cloud và quyền sửa biến môi trường của dịch vụ chạy ứng dụng. Nếu không có quyền cuối cùng, dùng nút tải checklist bên dưới để gửi người triển khai.</p>
        </>}

        {step === 1 && <>
          <h3>Tạo dự án và bật hai API</h3>
          <p className="walk-intro">Các nút bên dưới mở tab Google Cloud mới. Làm xong ở Google, quay lại tab TubeFlow này.</p>
          <ol className="walk-task-list"><li><span>1</span><div><strong>Tạo hoặc chọn một dự án</strong><p>Mở Google Cloud, đăng nhập. Bấm tên dự án ở thanh trên cùng → <b>New project / Dự án mới</b> → đặt tên <b>TubeFlow</b> → <b>Create / Tạo</b>. Chọn dự án vừa tạo trước khi làm tiếp.</p><a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="button button-secondary button-small"><GoogleMark />Mở trang tạo dự án <ExternalLink size={13} /></a></div></li><li><span>2</span><div><strong>Bật YouTube Data API v3</strong><p>Bấm liên kết bên dưới, kiểm tra đúng dự án ở đầu trang, rồi bấm <b>Enable / Bật</b>. Nếu thấy <b>Manage / Quản lý</b>, API đã được bật.</p><a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="walk-external">Mở YouTube Data API v3 <ArrowUpRight size={14} /></a></div></li><li><span>3</span><div><strong>Bật YouTube Analytics API</strong><p>Làm tương tự trong <b>cùng dự án</b>. Không chọn YouTube Reporting API thay cho Analytics.</p><a href="https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com" target="_blank" rel="noreferrer" className="walk-external">Mở YouTube Analytics API <ArrowUpRight size={14} /></a></div></li></ol>
          <div className="walk-confirmations"><label><input type="checkbox" checked={dataApi} onChange={(event) => setDataApi(event.target.checked)} /><span>Tôi đã thấy Data API v3 ở trạng thái được bật.</span></label><label><input type="checkbox" checked={analyticsApi} onChange={(event) => setAnalyticsApi(event.target.checked)} /><span>Tôi đã thấy Analytics API ở trạng thái được bật.</span></label></div>
          <p className="walk-small">Đây là xác nhận của bạn, không phải kiểm tra tự động từ Google. Nút Tiếp tục lưu tiến độ vào không gian làm việc.</p>
        </>}

        {step === 2 && <>
          <h3>Tạo Client ID và Client Secret</h3>
          <p className="walk-intro">Giữ nguyên dự án vừa bật API. Mở Google Auth Platform, rồi làm theo đúng thứ tự dưới đây.</p>
          <a className="button button-secondary" href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noreferrer"><GoogleMark />Mở Google Auth Platform <ExternalLink size={14} /></a>
          <ol className="walk-task-list"><li><span>1</span><div><strong>Branding / Thông tin ứng dụng</strong><p>Nếu thấy <b>Get started</b>, bấm để bắt đầu. Nhập <b>App name: TubeFlow</b>, chọn email hỗ trợ của bạn. Chọn <b>External</b> nếu dùng Gmail cá nhân, điền email liên hệ, xem điều khoản và hoàn tất bằng <b>Create</b>.</p></div></li><li><span>2</span><div><strong>Audience → Test users → Add users</strong><p>Khi ứng dụng ở chế độ <b>Testing</b>, thêm <b>email Google thực sự quản lý kênh YouTube</b> rồi bấm <b>Save</b>. Dùng chính email này khi kết nối.</p></div></li><li><span>3</span><div><strong>Data Access → Add or remove scopes</strong><p>Chọn các quyền bên dưới rồi áp dụng và lưu. Hai quyền đầu dùng để đọc dữ liệu; quyền youtube.upload dùng để đăng video từ TubeFlow.</p><div className="walk-scopes"><code>{GOOGLE_READ_SCOPES.join("\n")}</code><CopyButton text={GOOGLE_READ_SCOPES.join("\n")} compact label="Sao chép hai quyền chỉ đọc" /></div></div></li><li><span>4</span><div><strong>Clients → Create client</strong><p>Chọn <b>Application type: Web application</b>, đặt <b>Name: TubeFlow Web</b>. Trong <b>Authorized redirect URIs</b>, bấm <b>Add URI</b> và dán giá trị này:</p>{validMode ? valueBox("Authorized redirect URI", redirectUri, "Sao chép URI cho OAuth Client") : <button type="button" className="text-button" onClick={() => goTo(0)}>Về bước 1 để nhập URL hợp lệ <ArrowLeft size={13} /></button>}<p>Không dán vào mục <b>Authorized JavaScript origins</b>. Với luồng máy chủ này, mục origins không thay thế cho redirect URI.</p></div></li><li><span>5</span><div><strong>Bấm Create và lưu thông tin được cấp</strong><p>Sao chép <b>Client ID</b> và <b>Client Secret</b> hoặc tải tệp JSON ngay khi tạo. Chúng phải thuộc cùng Client. Nếu Google không còn cho xem secret cũ, tạo secret mới theo hướng dẫn trên trang Client.</p><a className="walk-external" href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">Mở danh sách OAuth Client <ArrowUpRight size={14} /></a></div></li></ol>
          <div className="walk-callout"><ShieldCheck size={17} /><div><strong>Không gửi Client Secret vào chat.</strong><p>Bước tiếp theo chỉ hướng dẫn nơi dán secret trên máy chủ; TubeFlow không thu thập secret bằng biểu mẫu này.</p></div></div>
          <div className="walk-confirmations"><label><input type="checkbox" checked={clientSaved} onChange={(event) => setClientSaved(event.target.checked)} /><span>Tôi đã tạo Web application, lưu Client ID/Secret và thêm đúng redirect URI.</span></label></div>
        </>}

        {step === 3 && <>
          <h3>Điền bốn biến vào đúng nơi</h3>
          <p className="walk-intro"><strong>Biến môi trường là cặp “Tên” và “Giá trị”</strong> trong cấu hình máy chủ. Không dán chúng vào ô tìm kiếm Google hoặc vào phần cài đặt kênh YouTube.</p>
          {mode === "hosted" ? <div className="walk-provider"><label className="field-label" htmlFor="walk-provider">Nơi bạn quản lý triển khai</label><select id="walk-provider" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="generic">Dịch vụ đang chạy ứng dụng của tôi</option><option value="vercel">Vercel</option><option value="cloudflare">Cloudflare Tunnel trên máy tính</option></select>{provider === "cloudflare" ? <><p>Cloudflare Tunnel chỉ chuyển tiếp kết nối. Các biến phải đặt trong <b>.env / .env.local trên máy đang chạy Next.js</b>, không phải trong Cloudflare Dashboard. Đặt APP_URL là URL HTTPS hiện tại của tunnel, rồi khởi động lại Next.js. Giữ terminal cloudflared chạy để tránh nhận URL mới.</p><p><b>.env.local có thể ghi đè .env.</b> Dòng bắt đầu bằng # chỉ là chú thích, không cấu hình Google Cloud.</p><a className="walk-external" href="https://developers.cloudflare.com/tunnel/troubleshooting/" target="_blank" rel="noreferrer">Hướng dẫn kiểm tra tunnel <ArrowUpRight size={13} /></a></> : provider === "vercel" ? <><p>Vercel Dashboard → chọn dự án TubeFlow → <b>Settings → Environment Variables</b> → <b>Add Environment Variable</b>. Điền Key/Value, chọn <b>Production</b> hoặc <b>Preview</b> đúng với URL ở bước 1, rồi <b>Save</b>.</p><a className="walk-external" href="https://vercel.com/docs/environment-variables/managing-environment-variables" target="_blank" rel="noreferrer">Xem hướng dẫn chính thức của Vercel <ArrowUpRight size={13} /></a></> : <p>Mở trang quản trị của dịch vụ bạn dùng để xuất bản TubeFlow → chọn đúng dự án → tìm <b>Environment Variables</b>, <b>Environment</b> hoặc <b>Secrets</b> → <b>Add variable</b>. Thêm lần lượt từng cặp dưới đây và lưu. Tên menu có thể khác theo dịch vụ.</p>}</div> : <div className="walk-callout"><Terminal size={17} /><div><strong>Trong thư mục dự án có package.json</strong><p>Tạo file tên chính xác <b>.env.local</b> (không phải .env.local.txt), điền bốn dòng ở mẫu bên dưới. Giữ nguyên <b>DATABASE_URL</b> hiện có trong .env. Không sửa package.json. Cần PostgreSQL đã chạy và Node.js 22 trở lên để chạy dự án trên máy cá nhân.</p></div></div>}
          <div className="walk-variable-list"><div><header><code>GOOGLE_CLIENT_ID</code><CopyButton text="GOOGLE_CLIENT_ID" compact label="Sao chép tên GOOGLE_CLIENT_ID" /></header><p>Giá trị: Client ID vừa tạo ở Google, thường kết thúc bằng <b>.apps.googleusercontent.com</b>.</p></div><div><header><code>GOOGLE_CLIENT_SECRET</code><CopyButton text="GOOGLE_CLIENT_SECRET" compact label="Sao chép tên GOOGLE_CLIENT_SECRET" /></header><p>Giá trị: Client Secret của chính OAuth Client đó. Chỉ dán vào ô giá trị bí mật trên máy chủ.</p></div><div><header><code>YOUTUBE_TOKEN_SECRET</code><CopyButton text="YOUTUBE_TOKEN_SECRET" compact label="Sao chép tên YOUTUBE_TOKEN_SECRET" /></header>{tokenAlreadySet ? <p className="walk-safe"><CheckCircle2 size={14} />Máy chủ đã có khóa đủ dài. Giữ nguyên khóa hiện tại; không tạo khóa thay thế chỉ để làm lại hướng dẫn.</p> : <><p>Giá trị: chuỗi ngẫu nhiên ít nhất 32 ký tự. Nút này tạo khóa 64 ký tự trên thiết bị của bạn.</p><button type="button" className="button button-secondary button-small" onClick={generateSecret}><KeyRound size={14} />{generatedSecret ? "Tạo khóa khác" : "Tạo khóa 64 ký tự"}</button>{generatedSecret && <>{valueBox("Khóa mới — sao chép vào biến máy chủ", generatedSecret, "Sao chép khóa mã hóa mới")}<p className="walk-small">Khóa chưa được gửi hoặc lưu lên máy chủ. Hãy lưu lại trước khi tải lại trang.</p></>}</>}</div><div><header><code>APP_URL</code><CopyButton text="APP_URL" compact label="Sao chép tên APP_URL" /></header>{validMode ? valueBox("Giá trị cần điền", origin!, "Sao chép giá trị APP_URL") : <button className="text-button" type="button" onClick={() => goTo(0)}>Chọn URL hợp lệ ở bước 1 <ArrowLeft size={13} /></button>}<p>Chỉ URL gốc. Không thêm /api/youtube/callback vào giá trị của APP_URL.</p></div></div>
          {validMode && <details className="walk-template"><summary><FileKey2 size={15} />Xem và tải mẫu biến môi trường</summary><p>Hai dòng Google được để trống để bạn tự điền, không phải giá trị dùng được. Nếu máy chủ đã có khóa mã hóa, giữ nguyên khóa đó.</p><div className="walk-code"><header><span>{mode === "local" ? ".env.local" : "Environment Variables"}</span><CopyButton text={setupEnvironmentTemplate(origin!, generatedSecret)} compact label="Sao chép mẫu hướng dẫn môi trường" /></header><pre>{setupEnvironmentTemplate(origin!, generatedSecret)}</pre></div><button type="button" className="text-button" onClick={() => downloadText(".env.local.example", setupEnvironmentTemplate(origin!, generatedSecret))}><Download size={14} />Tải mẫu để tự điền</button></details>}
          <div className="walk-callout walk-callout-amber"><Info size={17} /><div><strong>Không thấy chỗ nhập biến?</strong><p>Bạn cần quyền quản trị nơi triển khai. Nếu chỉ có link xem trước, hãy gửi checklist cho người có quyền đó. Không thể đặt secret thật bằng cách sửa ô URL trong hướng dẫn. Đừng thêm tiền tố NEXT_PUBLIC_ và đừng xóa DATABASE_URL.</p></div></div>
        </>}

        {step === 4 && <>
          <h3>Lưu, chạy lại, rồi kết nối</h3>
          <p className="walk-intro">Chỉ bấm kiểm tra sau khi bản triển khai mới đã chạy. Nút kiểm tra <strong>không tự thêm biến, không tự triển khai</strong> và không bật API trên Google.</p>
          {mode === "hosted" && provider === "cloudflare" ? <CloudflareRunGuide /> : mode === "hosted" ? <ol className="walk-task-list"><li><span>1</span><div><strong>Lưu biến môi trường và triển khai lại</strong><p>{provider === "vercel" ? <>Trong Vercel: <b>Deployments</b> → bản triển khai mới nhất → nút <b>⋯</b> → <b>Redeploy</b>. Chờ trạng thái Ready, rồi mở đúng URL của bản mới.</> : <>Ở trang quản trị nơi chạy TubeFlow, bấm <b>Redeploy / Deploy / Restart</b> theo dịch vụ bạn dùng. Chờ quá trình hoàn tất. Chỉ tải lại trình duyệt không thay thế bước này.</>}</p></div></li><li><span>2</span><div><strong>Quay lại đúng URL ứng dụng</strong><p>Địa chỉ mở trên trình duyệt phải khớp với APP_URL và URI đã lưu ở Google. Nếu URL preview đổi, cập nhật cả hai.</p>{validMode && <a href={origin!} target="_blank" rel="noreferrer" className="walk-external">Mở URL đã chọn ở bước 1 <ArrowUpRight size={14} /></a>}</div></li></ol> : <><div className="walk-callout"><Laptop size={17} /><div><strong>Chạy tại máy tính, không gõ các lệnh vào Google Cloud.</strong><p>Mở mã nguồn bằng VS Code → <b>Terminal → New Terminal</b>. Terminal phải ở thư mục chứa package.json; PostgreSQL và DATABASE_URL phải sẵn sàng.</p></div></div><div className="walk-command-list">{[{ command: "npm install", text: "Lần đầu: cài thư viện của dự án." }, { command: "npx drizzle-kit push", text: "Lần đầu với cơ sở dữ liệu mới: tạo bảng. Kiểm tra đúng DATABASE_URL trước khi chạy; nếu có cảnh báo mất dữ liệu, dừng và kiểm tra." }, { command: "npm run dev", text: "Khởi động ứng dụng. Giữ cửa sổ terminal này mở. Nếu đã chạy trước khi sửa biến, Ctrl+C rồi chạy lại lệnh này." }].map((item) => <div key={item.command}><p>{item.text}</p><div><code>{item.command}</code><CopyButton text={item.command} compact label={`Sao chép lệnh ${item.command}`} /></div></div>)}</div>{validMode && <p className="walk-small">Mở <a href={origin!} target="_blank" rel="noreferrer">{origin}</a>. Nếu terminal báo cổng khác, sửa lại APP_URL và URI Google cho cùng cổng.</p>}</>}
          <section className="walk-server-check"><header><Server size={17} /><div><h4>Máy chủ đang được kiểm tra</h4><code>{browserOrigin || "Đang xác định…"}</code></div></header>{validMode && browserOrigin !== origin && <div className="walk-check-warning"><Info size={15} /><p>Trang này đang kiểm tra <b>{browserOrigin}</b>, không phải <b>{origin}</b>. Mở URL đã chọn rồi kiểm tra ở đó; thay ô URL không đổi máy chủ được kiểm tra.</p></div>}<div className="walk-server-list">{config.checks.map((check) => <div key={check.name}><code>{check.name}</code><span className={check.configured ? "ok" : "missing"}>{check.configured ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{check.configured ? "Đã có" : "Thiếu / chưa hợp lệ"}</span></div>)}</div><button type="button" className="button button-secondary full-width" onClick={verifyServer} disabled={checking}>{checking ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}Kiểm tra máy chủ ngay</button>{checkedAt && <p className="walk-small">Kiểm tra lúc {checkedAt} · PostgreSQL: {healthOk ? "đang hoạt động" : "chưa sẵn sàng"}</p>}{checkMessage && <p className="walk-check-result" role="status">{checkMessage}</p>}{serverUrlSet && (!matchesDraft || !matchesBrowser) && <div className="walk-check-warning"><Info size={15} /><p>APP_URL trên máy chủ là <b>{config.appUrl}</b>. Chọn và mở đúng URL này hoặc sửa biến rồi triển khai lại trước khi kết nối.</p></div>}</section>
          <div className="walk-callout"><GoogleMark /><div><strong>Cuối cùng: đăng nhập Google và cấp quyền</strong><p>Khi đủ cấu hình và đúng URL, bấm Kết nối kênh bên dưới. Chọn email đã thêm vào Test users, chọn đúng kênh và cấp <b>cả hai quyền chỉ đọc</b>. Chỉ khi quay về và thấy tên kênh cùng trạng thái <b>Đã kết nối</b> mới là thành công.</p></div></div>
          {!config.ready && <button type="button" className="text-button walk-edit-env" onClick={() => goTo(3)}><ArrowLeft size={14} />Quay lại xem cách điền biến</button>}
        </>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="walk-footer"><button type="button" className="button button-secondary" onClick={() => goTo(step - 1)} disabled={step === 0 || saving || checking}><ArrowLeft size={14} />Quay lại</button>{step < 4 ? <button type="button" className="button button-primary" onClick={next} disabled={saving || (step === 0 && !validMode) || (step === 1 && (!dataApi || !analyticsApi || !initialized)) || (step === 2 && (!clientSaved || !validMode || !initialized))}>{saving ? <Loader2 size={14} className="spin" /> : null}{step === 1 || step === 2 ? "Lưu xác nhận & tiếp tục" : step === 3 ? "Xem cách chạy lại" : "Tiếp tục"}<ArrowRight size={14} /></button> : <button type="button" className="button button-primary" onClick={() => { onClose(); onConnect(); }} disabled={!canConnect || checking}><Link2 size={15} />Kết nối kênh <ArrowUpRight size={14} /></button>}</div>
      <div className="walk-handoff"><ShieldCheck size={14} /><span>Khóa bí mật không được đưa vào checklist.</span><button type="button" className="text-button" disabled={!validMode} onClick={() => downloadText("tubeflow-checklist-trien-khai.txt", setupHandoff(origin!))}><Download size={13} />Tải checklist cho người triển khai</button></div>
    </div>
  </Modal>;
}

function CloudflareRunGuide() {
  const commands = [
    { label: "Terminal ứng dụng · khôi phục tài nguyên công khai", value: "node scripts/prepare-assets.cjs" },
    { label: "Terminal ứng dụng · tạo bản production", value: "npm run build" },
    { label: "Terminal ứng dụng · chạy cổng 3000, không dùng HMR", value: "npm run start -- --hostname 127.0.0.1 --port 3000" },
    { label: "Terminal thứ hai · chỉ chạy nếu cần tạo tunnel mới", value: "cloudflared tunnel --url http://127.0.0.1:3000" },
  ];
  return <><div className="walk-callout"><Cloud size={18} /><div><strong>Thử PWA bằng production, không dùng npm run dev.</strong><p>Giữ tunnel hiện có nếu vẫn hoạt động. Dừng tiến trình Next.js dev trước khi chạy production cùng cổng. Chạy các lệnh trong terminal máy tính, không gõ vào Google Cloud.</p></div></div><div className="walk-command-list">{commands.map((item) => <div key={item.value}><p>{item.label}</p><div><code>{item.value}</code><CopyButton text={item.value} compact label={`Sao chép lệnh ${item.value}`} /></div></div>)}</div><div className="walk-callout walk-callout-amber"><Info size={17} /><div><strong>Không đổi tunnel sau khi chép URL nếu không cần thiết.</strong><p>Nếu tunnel mới cho URL khác, cập nhật APP_URL và Authorized redirect URI đầy đủ trong Google Cloud, rồi chỉ khởi động lại Next.js. Callback luôn kết thúc bằng <b>/api/youtube/callback</b>. Không tắt kiểm tra TLS hoặc cho phép mọi hostname để xử lý lỗi.</p></div></div><p className="walk-small">Trong Cài đặt → Chẩn đoán tài nguyên &amp; Tunnel, kiểm tra icon, font, chế độ dev/production và HTTP thực tế. Nếu localhost cũng 404, khôi phục public/ trước; nếu chỉ tunnel lỗi, kiểm tra cổng và log cloudflared.</p></>;
}
