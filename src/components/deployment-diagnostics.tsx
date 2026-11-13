"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronRight, Cloud, Download, FileCheck2, Info, Loader2, RefreshCw, Server, ShieldCheck, Terminal, TriangleAlert, XCircle } from "lucide-react";
import { CopyButton, downloadText, Modal } from "@/components/ui";
import { requestJson } from "@/lib/client";
import type { PublicConfig } from "@/lib/types";
import { isQuickTunnelUrl } from "@/lib/setup-guide";

type Probe = { path: string; kind: "png" | "woff2" | "css" | "script" | "html" | "manifest"; size?: number };
type ProbeResult = { path: string; ok: boolean; status: number | null; detail: string };
const REQUIRED_PROBES: Probe[] = [
  { path: "/icons/icon-192.png", kind: "png", size: 192 },
  { path: "/icons/icon-512.png", kind: "png", size: 512 },
  { path: "/icons/maskable-512.png", kind: "png", size: 512 },
  { path: "/apple-touch-icon.png", kind: "png", size: 180 },
  { path: "/manifest.webmanifest", kind: "manifest" },
  { path: "/sw.js", kind: "script" },
  { path: "/offline.html", kind: "html" },
];
const FONT_PATHS = ["/fonts/inter-vietnamese.woff2", "/fonts/inter-latin.woff2"];

async function probeResource(spec: Probe, stamp: number, signal: AbortSignal): Promise<ProbeResult & { text?: string }> {
  try {
    // Query strings bypass TubeFlow's service-worker asset cache. Check the server, not a stale copy.
    const response = await fetch(`${spec.path}?tubeflow-check=${stamp}`, { cache: "no-store", credentials: "omit", signal });
    if (!response.ok) return { path: spec.path, ok: false, status: response.status, detail: response.status === 404 ? "404 · Không tìm thấy" : `${response.status} · Máy chủ từ chối hoặc chưa phản hồi đúng` };
    const mime = (response.headers.get("content-type") || "").toLowerCase();
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let valid = false;
    let label = "";
    let text: string | undefined;
    if (spec.kind === "png") {
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      valid = bytes.length > 24 && signature.every((value, index) => bytes[index] === value) && new DataView(buffer).getUint32(16) === spec.size && new DataView(buffer).getUint32(20) === spec.size && mime.includes("image/png");
      if (valid && typeof createImageBitmap === "function") {
        try { const image = await createImageBitmap(new Blob([buffer], { type: "image/png" })); valid = image.width === spec.size && image.height === spec.size; image.close(); }
        catch { valid = false; }
      }
      label = `PNG ${spec.size}×${spec.size}`;
    } else if (spec.kind === "woff2") {
      valid = bytes.length >= 48 && String.fromCharCode(...bytes.slice(0, 4)) === "wOF2" && new DataView(buffer).getUint32(8) === bytes.length;
      label = "WOFF2";
    } else {
      text = new TextDecoder().decode(bytes);
      if (spec.kind === "css") { valid = mime.includes("text/css") && text.includes("TUBEFLOW_FONT_FACES"); label = "Stylesheet font"; }
      if (spec.kind === "script") { valid = /(?:java|ecma)script/.test(mime) && text.includes("TubeFlow PWA"); label = "Service worker"; }
      if (spec.kind === "html") { valid = mime.includes("text/html") && text.includes("offline-art"); label = "Trang ngoại tuyến"; }
      if (spec.kind === "manifest") {
        try { const manifest = JSON.parse(text); valid = manifest.display === "standalone" && Array.isArray(manifest.icons) && manifest.icons.some((icon: { src?: string }) => icon.src === "/icons/icon-192.png"); } catch { valid = false; }
        label = "Manifest PWA";
      }
    }
    return { path: spec.path, ok: valid, status: response.status, detail: valid ? `200 · ${label}` : "200 nhưng nội dung / định dạng không đúng", ...(spec.kind === "css" ? { text } : {}) };
  } catch {
    return { path: spec.path, ok: false, status: null, detail: signal.aborted ? "Hết thời gian hoặc đã hủy" : "Không tải được · kiểm tra mạng / tunnel" };
  }
}

export function DeploymentDiagnostics({ initialConfig }: { initialConfig: PublicConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [origin, setOrigin] = useState("");
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [fontsFallback, setFontsFallback] = useState(false);
  const [database, setDatabase] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);

  const scan = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setChecking(true); setError(""); setResults(null);
    try {
      const stamp = Date.now();
      const [fresh, health, stylesheet, assets] = await Promise.all([
        requestJson<PublicConfig>("/api/config", { signal: controller.signal }),
        requestJson<{ ok: boolean }>("/api/health", { signal: controller.signal }).catch(() => ({ ok: false })),
        probeResource({ path: "/fonts/font-faces.css", kind: "css" }, stamp, controller.signal),
        Promise.all(REQUIRED_PROBES.map((asset) => probeResource(asset, stamp, controller.signal))),
      ]);
      const activeFonts = FONT_PATHS.filter((path) => stylesheet.ok && stylesheet.text?.includes(path));
      const fontResults = await Promise.all(activeFonts.map((path) => probeResource({ path, kind: "woff2" }, stamp, controller.signal)));
      if (!mounted.current || controllerRef.current !== controller) return;
      setConfig(fresh); setDatabase(health.ok); setFontsFallback(stylesheet.ok && activeFonts.length === 0);
      setResults([stylesheet, ...fontResults, ...assets].map(({ path, ok, status, detail }) => ({ path, ok, status, detail })));
      setCheckedAt(new Date().toISOString());
    } catch (issue) {
      if (mounted.current && controllerRef.current === controller) setError(controller.signal.aborted ? "Kiểm tra quá thời gian. Xem log Next.js và cloudflared, rồi thử lại." : (issue as Error).message);
    } finally {
      clearTimeout(timer);
      if (mounted.current && controllerRef.current === controller) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setOrigin(window.location.origin);
    const url = new URL(window.location.href);
    if (url.searchParams.get("diagnostics") === "1") {
      url.searchParams.delete("diagnostics");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      sectionRef.current?.scrollIntoView({ block: "start" });
      void scan();
    }
    return () => { mounted.current = false; controllerRef.current?.abort(); };
  }, [scan]);

  async function resetCache() {
    if (!navigator.onLine) { setError("Cần có mạng trước khi làm mới cache PWA."); setResetOpen(false); return; }
    setResetting(true); setError("");
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((registration) => {
          const worker = registration.active || registration.waiting || registration.installing;
          if (!worker) return false;
          const script = new URL(worker.scriptURL);
          return script.origin === window.location.origin && script.pathname === "/sw.js" && registration.scope === `${window.location.origin}/`;
        }).map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith("tubeflow-")).map((name) => caches.delete(name)));
      }
      // Deliberately preserve cookies, localStorage, IndexedDB, and all server data.
      window.location.reload();
    } catch { setError("Chưa thể làm mới cache. Hãy đóng các tab TubeFlow khác và thử lại."); setResetting(false); setResetOpen(false); }
  }

  const isDevelopment = config.runtimeMode === "development";
  const isQuickTunnel = isQuickTunnelUrl(origin);
  const matchedUrl = config.checks.some((check) => check.name === "APP_URL" && check.configured) && origin === config.appUrl;
  const failed = results?.filter((item) => !item.ok).length || 0;
  function command(value: string) { return <div className="diagnostic-command"><code>{value}</code><CopyButton text={value} compact label={`Sao chép ${value}`} /></div>; }

  return <section ref={sectionRef} className="card settings-section deployment-diagnostics" id="deployment-diagnostics">
    <div className="diagnostic-heading"><span className="diagnostic-icon"><Cloud size={21} /></span><div><h2>Chẩn đoán tài nguyên & Tunnel</h2><p>Phân biệt lỗi file tĩnh, chế độ dev và cấu hình OAuth.</p></div></div>
    <div className="diagnostic-context"><span className={isDevelopment ? "diagnostic-badge warning" : "diagnostic-badge"}><Server size={13} />{isDevelopment ? "Development · có HMR" : config.runtimeMode === "production" ? "Production · không dùng HMR" : "Chưa xác định chế độ"}</span>{isQuickTunnel && <span className="diagnostic-badge warning"><Cloud size={13} />Quick Tunnel · tên miền tạm</span>}<code>{origin || "Đang xác định URL…"}</code></div>
    {isDevelopment && <div className="diagnostic-note warning"><Info size={17} /><p><strong>Thử PWA bằng bản production.</strong> Lỗi WebSocket ở /_next/hmr là lỗi cập nhật nóng của dev, không phải kết nối YouTube. Production không sử dụng HMR. Cho phép hostname đúng không đảm bảo sửa mọi lỗi 502; cần xem thêm log cloudflared.</p></div>}
    <div className="diagnostic-actions"><button className="button button-primary" onClick={scan} disabled={checking}>{checking ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}{checking ? "Đang kiểm tra URL này…" : "Kiểm tra font, icon & máy chủ"}</button><button className="button button-secondary" onClick={() => setResetOpen(true)} disabled={checking}><RefreshCw size={14} />Làm mới cache PWA</button></div>
    <p className="diagnostic-small">Kiểm tra trực tiếp qua URL đang mở, có tham số tránh cache PWA. Không gửi khóa bí mật và không kiểm tra tài khoản Google.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    {results && <div className="diagnostic-report"><div className="diagnostic-result-title" role="status">{failed ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}<strong>{results.length - failed}/{results.length} tài nguyên tải được</strong><span>{new Date(checkedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></div><ul className="diagnostic-resource-list">{results.map((item) => <li key={item.path} className={item.ok ? "ok" : "failed"}>{item.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}<code>{item.path}</code><span>{item.detail}</span></li>)}</ul>{fontsFallback && <p className="diagnostic-note"><Info size={15} />Phông hệ thống đang được dùng hợp lệ. Stylesheet không tham chiếu font bị thiếu.</p>}<div className="diagnostic-summary"><span className={database ? "good" : "bad"}>{database ? <CheckCircle2 size={14} /> : <XCircle size={14} />}PostgreSQL: {database ? "đang hoạt động" : "chưa phản hồi"}</span><button className="text-button" onClick={() => downloadText("tubeflow-diagnostic.json", JSON.stringify({ checkedAt, origin, runtimeMode: config.runtimeMode, appUrl: config.appUrl, redirectUri: config.redirectUri, databaseReady: database, systemFonts: fontsFallback, resources: results }, null, 2), "application/json")}><Download size={14} />Tải báo cáo không có secret</button></div>{failed > 0 && <div className="diagnostic-note warning"><Info size={16} /><p>Nếu localhost cũng 404, kiểm tra thư mục <b>public/</b> của đúng dự án đang chạy. Nếu localhost tải được nhưng tunnel không tải được, kiểm tra tunnel có trỏ đúng cổng / tiến trình không. APP_URL hay token không tạo ra các file này.</p></div>}</div>}
    <details className="diagnostic-guide"><summary><Terminal size={16} />Cách chạy để thử PWA qua Cloudflare Tunnel<ChevronRight size={15} /></summary><div><ol><li><strong>Dừng Next.js dev, giữ nguyên terminal tunnel nếu nó vẫn hoạt động.</strong><p>Sau khi cập nhật mã nguồn, mở terminal trong thư mục chứa package.json. Cài thư viện nếu cần, rồi khôi phục và kiểm tra tài nguyên:</p>{command("npm install")}{command("node scripts/prepare-assets.cjs")}</li><li><strong>Chạy bản production ở terminal ứng dụng.</strong><p>Chạy build trước, sau đó start. Giữ terminal start mở; không chạy dev và start cùng cổng.</p>{command("npm run build")}{command("npm run start -- --hostname 127.0.0.1 --port 3000")}</li><li><strong>Terminal tunnel riêng, trên cùng máy.</strong><p>Nếu cần tạo tunnel mới, dùng cùng địa chỉ IPv4 và cổng. Mỗi lần tạo Quick Tunnel mới có thể nhận một tên miền khác.</p>{command("cloudflared tunnel --url http://127.0.0.1:3000")}</li><li><strong>Đồng bộ URL rồi chỉ khởi động lại ứng dụng.</strong><p>Đặt APP_URL thành URL HTTPS hiện tại của tunnel. Kiểm tra .env.local không ghi đè bằng URL cũ. Giữ tunnel chạy, sửa URI trong Google Cloud và khởi động lại terminal ứng dụng để đọc biến mới.</p></li></ol><div className="diagnostic-note warning"><Info size={16} /><p>Nếu cloudflared chạy trong Docker, localhost là chính container đó; cần dùng địa chỉ dịch vụ ứng dụng trong cùng mạng container. Không tắt kiểm tra TLS hoặc origin chỉ để che lỗi.</p></div><a className="text-button" href="https://developers.cloudflare.com/tunnel/troubleshooting/" target="_blank" rel="noreferrer">Tài liệu xử lý lỗi Cloudflare <ArrowUpRight size={13} /></a></div></details>
    <div className="diagnostic-callback"><span><FileCheck2 size={15} />URI cần thêm trong Google Auth Platform</span><div><code>{config.redirectUri}</code><CopyButton compact text={config.redirectUri} label="Sao chép callback đầy đủ từ máy chủ" /></div><p>Dòng bắt đầu bằng <b>#</b> trong .env chỉ là chú thích. Bạn phải dán URI đầy đủ vào <b>Clients → Authorized redirect URIs</b>, không chỉ dán tên miền.</p>{origin && !matchedUrl && <p className="diagnostic-url-warning">APP_URL đang thiếu hoặc khác URL đang mở. Sửa biến máy chủ và khởi động lại trước khi sao chép URI cho tunnel này.</p>}</div>
    <Modal open={resetOpen} onClose={() => !resetting && setResetOpen(false)} title="Làm mới tài nguyên PWA?" description="Chỉ thực hiện sau khi đã sửa hoặc khôi phục tài nguyên trên máy chủ."><p className="modal-body-copy">Thao tác này gỡ service worker của TubeFlow, xóa riêng cache tài nguyên TubeFlow rồi tải lại trang. <strong>Không xóa cookie, khóa môi trường, kết nối kênh hoặc kế hoạch đã lưu.</strong> Hãy lưu phần đang nhập trước; thiết bị cần có mạng.</p><div className="diagnostic-note"><ShieldCheck size={16} /><p>Không cần dùng Clear site data, xóa lịch sử hoặc xóa toàn bộ cookie — các thao tác đó có thể làm bạn mất phiên không gian cá nhân.</p></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setResetOpen(false)} disabled={resetting}>Để sau</button><button className="button button-primary" onClick={resetCache} disabled={resetting}>{resetting ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}Làm mới và tải lại</button></div></Modal>
  </section>;
}
