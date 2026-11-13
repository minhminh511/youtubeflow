import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";
import { parsePlan } from "@/lib/plan-validation";
import { desc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const items = await db.select().from(plans).where(eq(plans.workspaceId, workspace.id)).orderBy(desc(plans.createdAt));
    return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const input = parsePlan(await request.json());
    if (!input) return NextResponse.json({ error: "Kiểm tra tiêu đề, định dạng và ngày dự kiến. Nội dung đã lên lịch cần có ngày." }, { status: 400 });
    const [plan] = await db.insert(plans).values({ ...input, workspaceId: workspace.id }).returning();
    return NextResponse.json(plan, { status: 201 });
  } catch (error) { return apiError(error); }
}
