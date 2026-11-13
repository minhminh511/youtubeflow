import "server-only";
import { db } from "@/db";
import { plans, workspaces, youtubeConnections } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { randomToken, secureCookie, SESSION_COOKIE, sessionHash } from "@/lib/security";
import { getStudioVideos } from "@/lib/youtube";

export async function getWorkspace(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.sessionHash, sessionHash(token))).limit(1);
  return workspace || null;
}

export async function requireWorkspace(request: NextRequest) {
  const workspace = await getWorkspace(request);
  if (!workspace) throw new Error("unauthorized");
  return workspace;
}

export async function createWorkspace() {
  const token = randomToken();
  const [workspace] = await db.insert(workspaces).values({ sessionHash: sessionHash(token) }).returning();
  return { token, workspace };
}

export function setWorkspaceCookie(response: NextResponse, request: NextRequest, token: string) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: secureCookie(request), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export const publicChannelFields = {
  channelId: youtubeConnections.channelId,
  title: youtubeConnections.title,
  thumbnail: youtubeConnections.thumbnail,
  subscribers: youtubeConnections.subscribers,
  views: youtubeConnections.views,
  videoCount: youtubeConnections.videoCount,
  connectedAt: youtubeConnections.connectedAt,
  updatedAt: youtubeConnections.updatedAt,
};

export async function workspaceData(workspace: typeof workspaces.$inferSelect) {
  // Studio videos are optional: if the schema has not been pushed yet, the
  // workspace must still load instead of failing the whole page with a 500.
  const videos = await getStudioVideos(workspace.id).catch(() => []);
  const [items, channels] = await Promise.all([
    db.select({ id: plans.id, title: plans.title, description: plans.description, format: plans.format, status: plans.status, scheduledDate: plans.scheduledDate, createdAt: plans.createdAt, updatedAt: plans.updatedAt }).from(plans).where(eq(plans.workspaceId, workspace.id)).orderBy(desc(plans.createdAt)),
    db.select(publicChannelFields).from(youtubeConnections).where(eq(youtubeConnections.workspaceId, workspace.id)).limit(1),
  ]);
  return { name: workspace.name, completedSteps: workspace.completedSteps, plans: items, channel: channels[0] || null, videos };
}

function databaseErrorCode(error: unknown): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return null;
}

export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "unknown";
  const dbCode = databaseErrorCode(error);
  if (dbCode === "42P01") return NextResponse.json({ error: "Cơ sở dữ liệu chưa có bảng mới. Hãy chạy npx drizzle-kit push trong thư mục dự án rồi khởi động lại ứng dụng." }, { status: 503 });
  if (dbCode === "ECONNREFUSED" || dbCode === "ENOTFOUND" || dbCode === "28P01" || dbCode === "3D000") return NextResponse.json({ error: "Không kết nối được PostgreSQL. Hãy kiểm tra DATABASE_URL và đảm bảo máy chủ cơ sở dữ liệu đang chạy." }, { status: 503 });
  if (code === "unauthorized") return NextResponse.json({ error: "Phiên làm việc đã hết hạn. Vui lòng tải lại trang." }, { status: 401 });
  if (code === "forbidden") return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  if (code === "missing_config") return NextResponse.json({ error: "Máy chủ chưa đủ cấu hình Google OAuth. Hãy hoàn thành các bước thiết lập." }, { status: 503 });
  if (code === "not_connected") return NextResponse.json({ error: "Bạn chưa kết nối kênh YouTube." }, { status: 409 });
  if (code === "reconnect") return NextResponse.json({ error: "Quyền truy cập đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại kênh." }, { status: 401 });
  if (code === "google_api") return NextResponse.json({ error: "Google chưa trả về dữ liệu. Kiểm tra API đã bật và quyền truy cập, rồi thử lại." }, { status: 502 });
  if (code === "upload_scope_required") return NextResponse.json({ error: "Cần cấp thêm quyền đăng video. Hãy kết nối lại và đồng ý quyền tải lên.", code }, { status: 403 });
  if (code === "invalid_file") return NextResponse.json({ error: "File video không hợp lệ hoặc quá lớn (tối đa 2GB)." }, { status: 400 });
  if (code === "upload_failed") return NextResponse.json({ error: "YouTube chưa nhận được video. Kiểm tra định dạng file và hạn ngạch, rồi thử lại." }, { status: 502 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  return NextResponse.json({ error: "Không thể hoàn tất yêu cầu. Vui lòng thử lại sau." }, { status: 500 });
}
