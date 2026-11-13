/* TubeFlow PWA: only public assets are stored. No workspace/API/OAuth data. */
const VERSION = "tubeflow-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_PAGE = "/offline.html";
const REQUIRED_PUBLIC_ASSETS = [
  OFFLINE_PAGE,
  "/offline.css",
  "/offline.js",
  "/fonts/font-faces.css",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/apple-touch-icon.png",
];
const FONT_ASSETS = ["/fonts/inter-latin.woff2", "/fonts/inter-vietnamese.woff2"];
const PUBLIC_ASSETS = [...REQUIRED_PUBLIC_ASSETS, ...FONT_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(REQUIRED_PUBLIC_ASSETS);
    const stylesheet = await cache.match("/fonts/font-faces.css");
    const fontCss = stylesheet ? await stylesheet.text() : "";
    // Optional fonts never block installation; only request declared, present fonts.
    await Promise.all(FONT_ASSETS.filter((url) => fontCss.includes(url)).map((url) => cache.add(url).catch(() => undefined)));
  })());
  // An update waits until the user explicitly chooses to reload.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("tubeflow-") && ![SHELL_CACHE, ASSET_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

async function publicAsset(request) {
  const shell = await caches.open(SHELL_CACHE);
  const shellMatch = await shell.match(request);
  if (shellMatch) return shellMatch;
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200 && response.type === "basic") {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    if (keys.length > 80) await Promise.all(keys.slice(0, keys.length - 80).map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Never intercept APIs, OAuth callbacks, mutations, or partial requests.
  if (url.pathname.startsWith("/api/") || request.headers.has("range")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // Network-only HTML: a cached page must never expose another session.
        return await fetch(request);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        const offline = await cache.match(OFFLINE_PAGE);
        return offline || new Response("Bạn đang ngoại tuyến. Hãy kết nối mạng và thử lại.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }
  // The allowlist deliberately excludes RSC requests and channel images.
  if (url.search) return;
  if (PUBLIC_ASSETS.includes(url.pathname) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(publicAsset(request));
  }
});
