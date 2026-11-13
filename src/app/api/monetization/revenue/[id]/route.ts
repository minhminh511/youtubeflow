import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { revenueEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { validUuid } from "@/lib/plan-validation";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { id } = await context.params;
    if (!validUuid(id)) return NextResponse.json({ error: "Mã mục doanh thu không hợp lệ." }, { status: 400 });
    const [deleted] = await db.delete(revenueEntries).where(and(eq(revenueEntries.id, id), eq(revenueEntries.workspaceId, workspace.id))).returning({ id: revenueEntries.id });
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy mục doanh thu." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
