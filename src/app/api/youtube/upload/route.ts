import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { getStudioVideos, uploadVideo } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const MAX_SIZE = 2 * 1024 * 1024 * 1024;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/avi", "video/mpeg", "video/3gpp", "video/x-msvideo"];

export async function POST(request: NextRequest) {
  let record: typeof uploads.$inferSelect | null = null;
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    let form: FormData;
    try { form = await request.formData(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ. Hãy chọn file video và điền đầy đủ thông tin." }, { status: 400 }); }
    const file = form.get("file");
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const privacy = String(form.get("privacyStatus") || "private");
    const publishAtRaw = String(form.get("publishAt") || "");
    if (!(file instanceof File)) return NextResponse.json({ error: "Hãy chọn file video để đăng." }, { status: 400 });
    if (!title || title.length > 100) return NextResponse.json({ error: "Tiêu đề video cần có và tối đa 100 ký tự." }, { status: 400 });
    if (description.length > 5000) return NextResponse.json({ error: "Mô tả tối đa 5000 ký tự." }, { status: 400 });
    if (!["public", "unlisted", "private"].includes(privacy)) return NextResponse.json({ error: "Trạng thái công khai không hợp lệ." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_SIZE) throw new Error("invalid_file");
    const type = file.type || "video/mp4";
    if (!ALLOWED_TYPES.includes(type) && !type.startsWith("video/")) throw new Error("invalid_file");
    let publishAt: Date | null = null;
    if (publishAtRaw) {
      publishAt = new Date(publishAtRaw);
      if (Number.isNaN(publishAt.getTime()) || publishAt.getTime() <= Date.now()) return NextResponse.json({ error: "Ngày lên lịch phải ở trong tương lai." }, { status: 400 });
    }
    const effectivePrivacy = publishAt ? "private" : privacy;
    const format = String(form.get("format") || "video");
    if (!["video", "short"].includes(format)) return NextResponse.json({ error: "Định dạng video không hợp lệ." }, { status: 400 });
    const [created] = await db.insert(uploads).values({ workspaceId: workspace.id, title, description, privacyStatus: effectivePrivacy, publishAt, status: "uploading" }).returning();
    record = created;
    const youtubeVideoId = await uploadVideo(workspace.id, { title, description, privacyStatus: effectivePrivacy, publishAt, fileName: file.name, contentType: type, size: file.size, file, format });
    const [finished] = await db.update(uploads).set({ status: "done", youtubeVideoId, error: null, updatedAt: new Date() }).where(eq(uploads.id, created.id)).returning();
    const videos = await getStudioVideos(workspace.id);
    return NextResponse.json({ upload: finished, video: videos.find((video) => video.youtubeVideoId === youtubeVideoId) || null }, { status: 201 });
  } catch (error) {
    if (record) {
      const message = error instanceof Error ? error.message : "upload_failed";
      await db.update(uploads).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(uploads.id, record.id)).catch(() => undefined);
    }
    return apiError(error);
  }
}
