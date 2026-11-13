import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { getStudioVideos, syncStudioVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const videos = await getStudioVideos(workspace.id);
    return NextResponse.json(videos, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const videos = await syncStudioVideos(workspace.id);
    return NextResponse.json(videos, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
