import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { listCompetitors, syncCompetitor } from "@/lib/strategy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    return NextResponse.json(await listCompetitors(workspace.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const body = await request.json();
    if (!body || typeof body.handle !== "string" || !body.handle.trim()) return NextResponse.json({ error: "Hãy nhập handle kênh đối thủ, ví dụ @tenkenh." }, { status: 400 });
    try {
      const saved = await syncCompetitor(workspace.id, body.handle);
      return NextResponse.json({ id: saved.id, handle: saved.handle, channelId: saved.channelId, title: saved.title, thumbnail: saved.thumbnail, subscribers: saved.subscribers, views: saved.views, videoCount: saved.videoCount, lastSyncedAt: saved.lastSyncedAt.toISOString(), createdAt: saved.createdAt.toISOString() }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "channel_not_found") return NextResponse.json({ error: "Không tìm thấy kênh với handle này. Kiểm tra lại tên kênh." }, { status: 404 });
      if (error instanceof Error && error.message === "invalid_handle") return NextResponse.json({ error: "Handle không hợp lệ." }, { status: 400 });
      throw error;
    }
  } catch (error) { return apiError(error); }
}
