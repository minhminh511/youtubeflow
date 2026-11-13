import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { parsePlan, validUuid } from "@/lib/plan-validation";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã kế hoạch không hợp lệ." }, { status: 400 });
    const input = parsePlan(await request.json());
    if (!input) return NextResponse.json({ error: "Kiểm tra tiêu đề, định dạng và ngày dự kiến." }, { status: 400 });
    const [plan] = await db.update(plans).set({ ...input, updatedAt: new Date() }).where(and(eq(plans.id, id), eq(plans.workspaceId, workspace.id))).returning();
    if (!plan) return NextResponse.json({ error: "Không tìm thấy kế hoạch." }, { status: 404 });
    return NextResponse.json(plan);
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã kế hoạch không hợp lệ." }, { status: 400 });
    const [deleted] = await db.delete(plans).where(and(eq(plans.id, id), eq(plans.workspaceId, workspace.id))).returning({ id: plans.id });
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy kế hoạch." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
