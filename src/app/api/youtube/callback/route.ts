import { NextRequest, NextResponse } from "next/server";
import { getConfiguration, requireConfiguration } from "@/lib/config";
import { requireWorkspace } from "@/lib/workspace";
import { decrypt, OAUTH_COOKIE, safeEqual, secureCookie } from "@/lib/security";
import { storeConnection, YOUTUBE_SCOPES, type OAuthState } from "@/lib/youtube";

export const dynamic = "force-dynamic";
function finish(request: NextRequest, result: string) {
  const configuration = getConfiguration();
  const target = new URL("/", configuration.checks.find((check) => check.name === "APP_URL")?.configured ? configuration.appUrl : request.url);
  target.searchParams.set("oauth", result);
  const response = NextResponse.redirect(target);
  response.cookies.set(OAUTH_COOKIE, "", { path: "/api/youtube", maxAge: 0, httpOnly: true, sameSite: "lax", secure: secureCookie(request) });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const configuration = requireConfiguration();
    const cookie = request.cookies.get(OAUTH_COOKIE)?.value;
    const nonce = request.nextUrl.searchParams.get("state");
    if (!cookie || !nonce) return finish(request, "invalid_state");
    let state: OAuthState;
    try { state = decrypt<OAuthState>(cookie); } catch { return finish(request, "invalid_state"); }
    const workspace = await requireWorkspace(request);
    if (state.expiresAt < Date.now() || state.workspaceId !== workspace.id || !safeEqual(state.nonce, nonce)) return finish(request, "invalid_state");
    if (request.nextUrl.searchParams.has("error")) return finish(request, "access_denied");
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 10000) return finish(request, "connection_failed");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: configuration.clientId, client_secret: configuration.clientSecret, redirect_uri: configuration.redirectUri, grant_type: "authorization_code", code_verifier: state.verifier }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return finish(request, "token_exchange");
    const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokens.access_token || !tokens.refresh_token) return finish(request, "offline_access");
    const granted = new Set((tokens.scope || "").split(" "));
    const requiredScopes = state.scopes?.length ? state.scopes : YOUTUBE_SCOPES;
    if (!requiredScopes.every((scope) => granted.has(scope))) return finish(request, "missing_scopes");
    await storeConnection(workspace.id, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000, scope: tokens.scope || "" });
    return finish(request, "success");
  } catch (error) {
    const code = error instanceof Error ? error.message : "connection_failed";
    return finish(request, ["no_channel", "google_api", "missing_config", "unauthorized"].includes(code) ? code : "connection_failed");
  }
}
