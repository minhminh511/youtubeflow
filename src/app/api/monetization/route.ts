import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { monetization, revenueEntries, youtubeConnections } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { fetchAnalyticsTotals, getStudioVideos, getTokenInfo, YOUTUBE_MONETARY_SCOPE } from "@/lib/youtube";

export const dynamic = "force-dynamic";
const CHECKLIST_KEYS = ["twoStep", "adsense", "policies", "noStrikes", "contentOriginal"];

async function getOrCreate(workspaceId: string) {
  const [existing] = await db.select().from(monetization).where(eq(monetization.workspaceId, workspaceId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(monetization).values({ workspaceId }).returning();
  return created;
}

function parseDurationSeconds(value: string | null) {
  if (!value) return 0;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const settings = await getOrCreate(workspace.id);
    const entries = await db.select().from(revenueEntries).where(eq(revenueEntries.workspaceId, workspace.id)).orderBy(desc(revenueEntries.month));
    const [connection] = await db.select().from(youtubeConnections).where(eq(youtubeConnections.workspaceId, workspace.id)).limit(1);
    const base = {
      connected: !!connection,
      subscribers: connection?.subscribers || "0",
      watchHours: 0,
      watchHoursEstimated: false,
      shortsViews: 0,
      shortsEstimated: true,
      eligible: false,
      checklist: settings.checklist,
      revenueGoal: settings.revenueGoal,
      revenue28Days: null as number | null,
      canRequestRevenue: true,
      entries: entries.map((entry) => ({ id: entry.id, month: entry.month, amount: entry.amount, source: entry.source, note: entry.note, createdAt: entry.createdAt.toISOString() })),
    };
    if (!connection) return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });
    const { accessToken, scope } = await getTokenInfo(workspace.id);
    const end = new Date(); end.setUTCDate(end.getUTCDate() - 1);
    const endDate = end.toISOString().slice(0, 10);
    let watchMinutes = 0;
    let watchHoursEstimated = false;
    try {
      const yearStart = new Date(end); yearStart.setUTCDate(yearStart.getUTCDate() - 364);
      const [minutes] = await fetchAnalyticsTotals(accessToken, yearStart.toISOString().slice(0, 10), endDate, "estimatedMinutesWatched");
      watchMinutes = minutes || 0;
    } catch {
      const monthStart = new Date(end); monthStart.setUTCDate(monthStart.getUTCDate() - 27);
      const [minutes] = await fetchAnalyticsTotals(accessToken, monthStart.toISOString().slice(0, 10), endDate, "estimatedMinutesWatched");
      watchMinutes = minutes || 0;
      watchHoursEstimated = true;
    }
    const videos = await getStudioVideos(workspace.id);
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const shortsViews = videos.filter((video) => video.publishAt && new Date(video.publishAt).getTime() >= ninetyDaysAgo && parseDurationSeconds(video.duration) <= 180).reduce((sum, video) => sum + (Number(video.viewCount) || 0), 0);
    const watchHours = Math.round(watchMinutes / 60);
    const subscribers = Number(connection.subscribers) || 0;
    let revenue28Days: number | null = null;
    let canRequestRevenue = true;
    if (scope.split(" ").includes(YOUTUBE_MONETARY_SCOPE)) {
      canRequestRevenue = false;
      try {
        const monthStart = new Date(end); monthStart.setUTCDate(monthStart.getUTCDate() - 27);
        const [revenue] = await fetchAnalyticsTotals(accessToken, monthStart.toISOString().slice(0, 10), endDate, "estimatedRevenue");
        revenue28Days = revenue || 0;
      } catch { revenue28Days = null; }
    }
    return NextResponse.json({
      ...base,
      subscribers: connection.subscribers,
      watchHours,
      watchHoursEstimated,
      shortsViews,
      eligible: subscribers >= 1000 && (watchHours >= 4000 || shortsViews >= 10000000),
      revenue28Days,
      canRequestRevenue,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const body = await request.json();
    const settings = await getOrCreate(workspace.id);
    const updates: Partial<{ checklist: Record<string, boolean>; revenueGoal: string }> = {};
    if (body.checklist !== undefined) {
      if (!body.checklist || typeof body.checklist !== "object") return NextResponse.json({ error: "Checklist không hợp lệ." }, { status: 400 });
      const checklist: Record<string, boolean> = {};
      for (const key of CHECKLIST_KEYS) checklist[key] = body.checklist[key] === true;
      updates.checklist = checklist;
    }
    if (body.revenueGoal !== undefined) {
      if (typeof body.revenueGoal !== "string" || !/^\d{0,15}$/.test(body.revenueGoal.trim())) return NextResponse.json({ error: "Mục tiêu doanh thu phải là số nguyên." }, { status: 400 });
      updates.revenueGoal = body.revenueGoal.trim() || "0";
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Không có thay đổi nào để lưu." }, { status: 400 });
    const [updated] = await db.update(monetization).set({ ...updates, updatedAt: new Date() }).where(eq(monetization.id, settings.id)).returning();
    return NextResponse.json({ checklist: updated.checklist, revenueGoal: updated.revenueGoal });
  } catch (error) { return apiError(error); }
}
