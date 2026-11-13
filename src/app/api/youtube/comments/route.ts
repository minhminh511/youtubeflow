import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { fetchComments, getAccessToken } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const videoId = request.nextUrl.searchParams.get("videoId") || "";
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return NextResponse.json({ error: "Mã video không hợp lệ." }, { status: 400 });
    const comments = await fetchComments(await getAccessToken(workspace.id), videoId);
    return NextResponse.json(comments, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
