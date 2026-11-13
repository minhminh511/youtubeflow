import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contentPillars } from "@/db/schema";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { listPillars } from "@/lib/strategy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    return NextResponse.json(await listPillars(workspace.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const body = await request.json();
    if (!body || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) return NextResponse.json({ error: "Tên trụ cột cần có và tối đa 120 ký tự." }, { status: 400 });
    if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 2000)) return NextResponse.json({ error: "Mô tả tối đa 2000 ký tự." }, { status: 400 });
    const [pillar] = await db.insert(contentPillars).values({ workspaceId: workspace.id, name: body.name.trim(), description: (body.description || "").trim() }).returning();
    return NextResponse.json({ id: pillar.id, name: pillar.name, description: pillar.description, createdAt: pillar.createdAt.toISOString(), updatedAt: pillar.updatedAt.toISOString() }, { status: 201 });
  } catch (error) { return apiError(error); }
}
