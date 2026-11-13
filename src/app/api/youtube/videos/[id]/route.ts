import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans, studioVideos } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { validUuid } from "@/lib/plan-validation";
import { getStudioVideos } from "@/lib/youtube";

type Context = { params: Promise<{ id: string }> };
const LOCAL_STATUSES = ["published", "scheduled", "draft"];

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã video không hợp lệ." }, { status: 400 });
    const body = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
    const updates: Partial<{ localStatus: string; planId: string | null; localNotes: string }> = {};
    if (body.localStatus !== undefined) {
      if (!LOCAL_STATUSES.includes(String(body.localStatus))) return NextResponse.json({ error: "Trạng thái quản lý không hợp lệ." }, { status: 400 });
      updates.localStatus = String(body.localStatus);
    }
    if (body.localNotes !== undefined) {
      if (typeof body.localNotes !== "string" || body.localNotes.length > 5000) return NextResponse.json({ error: "Ghi chú tối đa 5000 ký tự." }, { status: 400 });
      updates.localNotes = body.localNotes;
    }
    if (body.planId !== undefined) {
      if (body.planId === null) updates.planId = null;
      else {
        if (typeof body.planId !== "string" || !validUuid(body.planId)) return NextResponse.json({ error: "Mã kế hoạch không hợp lệ." }, { status: 400 });
        const [plan] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.id, body.planId), eq(plans.workspaceId, workspace.id))).limit(1);
        if (!plan) return NextResponse.json({ error: "Kế hoạch không thuộc không gian của bạn." }, { status: 404 });
        updates.planId = body.planId;
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Không có thay đổi nào để lưu." }, { status: 400 });
    const [updated] = await db.update(studioVideos).set({ ...updates, updatedAt: new Date() }).where(and(eq(studioVideos.id, id), eq(studioVideos.workspaceId, workspace.id))).returning();
    if (!updated) return NextResponse.json({ error: "Không tìm thấy video trong không gian của bạn." }, { status: 404 });
    const videos = await getStudioVideos(workspace.id);
    return NextResponse.json(videos.find((video) => video.id === id));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã video không hợp lệ." }, { status: 400 });
    const [deleted] = await db.delete(studioVideos).where(and(eq(studioVideos.id, id), eq(studioVideos.workspaceId, workspace.id))).returning({ id: studioVideos.id });
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy video trong không gian của bạn." }, { status: 404 });
    return NextResponse.json({ ok: true, message: "Đã xóa khỏi quản lý TubeFlow. Video trên YouTube không bị xóa." });
  } catch (error) { return apiError(error); }
}
