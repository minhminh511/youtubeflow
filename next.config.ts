import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { preparePublicAssets } from "./scripts/prepare-assets.cjs";

export default async function configureNext(phase: string): Promise<NextConfig> {
  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
    const assets = await preparePublicAssets();
    if (assets.restored.length) console.info(`[TubeFlow] Restored ${assets.restored.length} missing or invalid public assets.`);
    for (const warning of assets.warnings) console.warn(`[TubeFlow] ${warning}`);
  }

  // Only the explicitly configured hostname may access development endpoints.
  // Do not allow all *.trycloudflare.com hosts or weaken API origin protection.
  let allowedDevOrigins: string[] = [];
  try {
    const url = new URL(process.env.APP_URL?.trim() || "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol === "https:" || (local && url.protocol === "http:")) && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password) allowedDevOrigins = [url.hostname];
  } catch { /* APP_URL may be unset while planning features are in use. */ }

  return {
    allowedDevOrigins,
    async headers() {
      return [
        {
          source: "/sw.js",
          headers: [
            { key: "Content-Type", value: "application/javascript; charset=utf-8" },
            { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
            { key: "Service-Worker-Allowed", value: "/" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          ],
        },
        { source: "/fonts/font-faces.css", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Content-Type", value: "text/css; charset=utf-8" }] },
        { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }] },
        { source: "/offline.html", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
      ];
    },
  };
}
