import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { fetchVideoAnalytics, getAccessToken } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const data = await fetchVideoAnalytics(await getAccessToken(workspace.id));
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
