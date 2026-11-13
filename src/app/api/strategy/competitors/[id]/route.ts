import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { competitors } from "@/db/schema";
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
    if (!validUuid(id)) return NextResponse.json({ error: "Mã đối thủ không hợp lệ." }, { status: 400 });
    const [deleted] = await db.delete(competitors).where(and(eq(competitors.id, id), eq(competitors.workspaceId, workspace.id))).returning({ id: competitors.id });
    if (!deleted) return NextResponse.json({ error: "Không tìm thấy đối thủ." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
