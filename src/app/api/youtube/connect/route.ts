import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireConfiguration } from "@/lib/config";
import { requireWorkspace } from "@/lib/workspace";
import { encrypt, OAUTH_COOKIE, randomToken, secureCookie } from "@/lib/security";
import { YOUTUBE_MONETARY_SCOPE, YOUTUBE_SCOPES, YOUTUBE_UPLOAD_SCOPE, type OAuthState } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const configuration = requireConfiguration();
    const workspace = await requireWorkspace(request);
    if (request.nextUrl.origin !== configuration.appUrl) {
      const visibleHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
      if (visibleHost !== new URL(configuration.appUrl).host) throw new Error("wrong_origin");
    }
    const scopeParam = request.nextUrl.searchParams.get("scope");
    const requestedScopes = scopeParam === "upload" ? [...YOUTUBE_SCOPES, YOUTUBE_UPLOAD_SCOPE] : scopeParam === "monetary" ? [...YOUTUBE_SCOPES, YOUTUBE_MONETARY_SCOPE] : [...YOUTUBE_SCOPES];
    const state: OAuthState = { nonce: randomToken(), verifier: randomToken(), workspaceId: workspace.id, expiresAt: Date.now() + 10 * 60 * 1000, scopes: requestedScopes };
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: configuration.clientId, redirect_uri: configuration.redirectUri, response_type: "code", scope: requestedScopes.join(" "), access_type: "offline", prompt: "consent select_account", state: state.nonce, code_challenge: createHash("sha256").update(state.verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    const response = NextResponse.redirect(url);
    response.cookies.set(OAUTH_COOKIE, encrypt(state), { httpOnly: true, secure: secureCookie(request), sameSite: "lax", path: "/api/youtube", maxAge: 600 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "connection_failed";
    const target = new URL("/", request.url);
    target.searchParams.set("oauth", ["missing_config", "wrong_origin", "unauthorized"].includes(code) ? code : "connection_failed");
    return NextResponse.redirect(target);
  }
}
