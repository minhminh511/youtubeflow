import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { listCompetitors, syncCompetitor } from "@/lib/strategy";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const current = await listCompetitors(workspace.id);
    for (const competitor of current) {
      try { await syncCompetitor(workspace.id, competitor.handle); } catch { /* Keep the last known snapshot on failure. */ }
    }
    return NextResponse.json(await listCompetitors(workspace.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
