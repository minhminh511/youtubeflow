import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { youtubeConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertSameOrigin } from "@/lib/security";
import { apiError, publicChannelFields, requireWorkspace } from "@/lib/workspace";
import { fetchChannel, getAccessToken } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const channel = await fetchChannel(await getAccessToken(workspace.id));
    const [updated] = await db.update(youtubeConnections).set({ ...channel, updatedAt: new Date() }).where(eq(youtubeConnections.workspaceId, workspace.id)).returning(publicChannelFields);
    return NextResponse.json(updated);
  } catch (error) { return apiError(error); }
}
