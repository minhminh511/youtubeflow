import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { getAccessToken } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const token = await getAccessToken(workspace.id);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 27);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.search = new URLSearchParams({ ids: "channel==MINE", startDate, endDate, metrics: "views,estimatedMinutesWatched,subscribersGained", dimensions: "day", sort: "day" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(response.status === 401 ? "reconnect" : "google_api");
    const data = await response.json() as { rows?: (string | number)[][] };
    const rows = (data.rows || []).map((row) => ({ day: String(row[0]), views: Number(row[1]) || 0, minutes: Number(row[2]) || 0, subscribers: Number(row[3]) || 0 }));
    return NextResponse.json({ startDate, endDate, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
