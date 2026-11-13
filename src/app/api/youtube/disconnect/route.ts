import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { youtubeConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertSameOrigin, decrypt } from "@/lib/security";
import { apiError, requireWorkspace } from "@/lib/workspace";
import type { Tokens } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const [connection] = await db.select().from(youtubeConnections).where(eq(youtubeConnections.workspaceId, workspace.id)).limit(1);
    let revoked = !connection;
    if (connection) {
      try {
        const tokens = decrypt<Tokens>(connection.encryptedTokens);
        const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refreshToken || tokens.accessToken }), signal: AbortSignal.timeout(12000) });
        revoked = response.ok;
      } catch { /* Still remove local credentials if Google is unavailable. */ }
      await db.delete(youtubeConnections).where(eq(youtubeConnections.workspaceId, workspace.id));
    }
    return NextResponse.json({ ok: true, warning: revoked ? null : "Token đã được xóa khỏi TubeFlow. Hãy thu hồi thêm quyền truy cập trong Tài khoản Google → Kết nối với bên thứ ba." });
  } catch (error) { return apiError(error); }
}
