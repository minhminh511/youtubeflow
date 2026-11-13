import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contentPillars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { validUuid } from "@/lib/plan-validation";
import { listPillars } from "@/lib/strategy";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã trụ cột không hợp lệ." }, { status: 400 });
    const body = await request.json();
    const updates: Partial<{ name: string; description: string }> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) return NextResponse.json({ error: "Tên trụ cột cần có và tối đa 120 ký tự." }, { status: 400 });
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      if (typeof body.description !== "string" || body.description.length > 2000) return NextResponse.json({ error: "Mô tả tối đa 2000 ký tự." }, { status: 400 });
      updates.description = body.description.trim();
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Không có thay đổi nào để lưu." }, { status: 400 });
    const [updated] = await db.update(contentPillars).set({ ...updates, updatedAt: new Date() }).where(and(eq(contentPillars.id, id), eq(contentPillars.workspaceId, workspace.id))).returning();
    if (!updated) return NextResponse.json({ error: "Không tìm thấy trụ cột." }, { status: 404 });
    const pillars = await listPillars(workspace.id);
    return NextResponse.json(pillars.find((pillar) => pillar.id === id));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã trụ cột không hợp lệ." }, { status: 400 });
    const [deleted] = await db.delete(contentPillars).where(and(eq(contentPillars.id, id), eq(contentPillars.workspaceId, workspace.id))).returning({ id: contentPillars.id });
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy trụ cột." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
