"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
type AppleNavigator = Navigator & { standalone?: boolean };
type WorkerStatus = "loading" | "ready" | "unsupported" | "error";
const DISMISS_KEY = "tubeflow-install-dismissed-until";

export function usePwa() {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [online, setOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [origin, setOrigin] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>("loading");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const wantsReload = useRef(false);

  const dismissInstall = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000)); } catch { /* Private browsing may deny storage. */ }
  }, []);

  useEffect(() => {
    let disposed = false;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;
    let lastUpdate = 0;
    const display = window.matchMedia("(display-mode: standalone)");
    const nav = navigator as AppleNavigator;
    const syncDisplay = () => {
      const installed = display.matches || nav.standalone === true;
      setStandalone(installed);
      document.documentElement.dataset.standalone = String(installed);
    };
    const syncNetwork = () => setOnline(navigator.onLine);
    const syncViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--visual-viewport-height", `${height}px`);
      document.documentElement.style.setProperty("--visual-viewport-offset-top", `${viewport?.offsetTop || 0}px`);
      const editable = document.activeElement?.matches("input,textarea,[contenteditable='true']");
      document.documentElement.dataset.keyboard = String(!!editable && (viewport?.scale || 1) <= 1.01 && window.innerHeight - height > 120);
    };
    const onFocusOut = () => { focusTimer = setTimeout(syncViewport, 180); };
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const installed = () => {
      setInstallPrompt(null);
      setInstallMessage("Đã thêm ứng dụng. Bạn có thể mở TubeFlow từ màn hình chính.");
      dismissInstall();
      syncDisplay();
    };
    const controllerChange = () => {
      if (disposed) return;
      setWorkerStatus("ready");
      if (wantsReload.current) window.location.reload();
    };
    const workerStateChange = () => {
      if (disposed || !installingWorker) return;
      if (installingWorker.state === "installed") {
        if (navigator.serviceWorker.controller) setUpdateAvailable(true);
        else setWorkerStatus("ready");
      }
      if (installingWorker.state === "activated") setWorkerStatus("ready");
    };
    const updateFound = () => {
      if (!registration?.installing) return;
      installingWorker?.removeEventListener("statechange", workerStateChange);
      installingWorker = registration.installing;
      installingWorker.addEventListener("statechange", workerStateChange);
    };
    const checkUpdates = () => {
      if (!registration || document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastUpdate < 60000) return;
      lastUpdate = Date.now();
      void registration.update().catch(() => undefined);
    };

    syncDisplay();
    syncNetwork();
    syncViewport();
    setIsIOS(/iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1));
    setOrigin(window.location.origin);
    try { setEmbedded(window.self !== window.top); } catch { setEmbedded(true); }
    try { setDismissed(Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now()); } catch { /* Optional UI preference only. */ }
    setReady(true);
    display.addEventListener("change", syncDisplay);
    window.addEventListener("online", syncNetwork);
    window.addEventListener("offline", syncNetwork);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    document.addEventListener("focusin", syncViewport);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", checkUpdates);
    window.addEventListener("online", checkUpdates);

    if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("controllerchange", controllerChange);
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((value) => {
        if (disposed) return;
        registration = value;
        registrationRef.current = value;
        if (value.active) setWorkerStatus("ready");
        if (value.waiting) setUpdateAvailable(true);
        value.addEventListener("updatefound", updateFound);
        updateFound();
        checkUpdates();
      }).catch(() => { if (!disposed) setWorkerStatus("error"); });
    } else setWorkerStatus("unsupported");

    return () => {
      disposed = true;
      if (focusTimer) clearTimeout(focusTimer);
      display.removeEventListener("change", syncDisplay);
      window.removeEventListener("online", syncNetwork);
      window.removeEventListener("offline", syncNetwork);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.removeEventListener("focusin", syncViewport);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", checkUpdates);
      window.removeEventListener("online", checkUpdates);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", controllerChange);
      registration?.removeEventListener("updatefound", updateFound);
      installingWorker?.removeEventListener("statechange", workerStateChange);
    };
  }, [dismissInstall]);

  const install = useCallback(async () => {
    if (!installPrompt) return;
    setInstalling(true); setInstallMessage("");
    try {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (result.outcome === "accepted") {
        dismissInstall();
        setInstallMessage("Bạn đã đồng ý cài đặt. Hoàn tất theo hướng dẫn của trình duyệt.");
      } else setInstallMessage("Bạn có thể thêm ứng dụng vào màn hình chính bất cứ lúc nào.");
    } catch { setInstallMessage("Trình duyệt chưa mở được hộp cài đặt. Hãy dùng menu trình duyệt hoặc hướng dẫn Safari bên dưới."); }
    finally { setInstalling(false); }
  }, [installPrompt, dismissInstall]);

  const applyUpdate = useCallback(() => {
    const waiting = registrationRef.current?.waiting;
    if (waiting) { wantsReload.current = true; waiting.postMessage({ type: "SKIP_WAITING" }); }
    else window.location.reload();
  }, []);

  return { ready, standalone, isIOS, embedded, online, dismissed, origin, canInstall: !!installPrompt, installing, installMessage, workerStatus, updateAvailable, dismissInstall, install, applyUpdate };
}

export type PwaRuntime = ReturnType<typeof usePwa>;
