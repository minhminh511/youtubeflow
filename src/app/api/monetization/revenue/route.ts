import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { revenueEntries } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const entries = await db.select().from(revenueEntries).where(eq(revenueEntries.workspaceId, workspace.id)).orderBy(desc(revenueEntries.month));
    return NextResponse.json(entries.map((entry) => ({ id: entry.id, month: entry.month, amount: entry.amount, source: entry.source, note: entry.note, createdAt: entry.createdAt.toISOString() })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const body = await request.json();
    if (!body || typeof body.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) return NextResponse.json({ error: "Tháng phải có định dạng YYYY-MM." }, { status: 400 });
    if (typeof body.amount !== "string" || !/^\d{1,15}$/.test(body.amount.trim())) return NextResponse.json({ error: "Số tiền phải là số nguyên (VNĐ)." }, { status: 400 });
    if (body.source !== undefined && (typeof body.source !== "string" || body.source.length > 80)) return NextResponse.json({ error: "Nguồn doanh thu tối đa 80 ký tự." }, { status: 400 });
    if (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 500)) return NextResponse.json({ error: "Ghi chú tối đa 500 ký tự." }, { status: 400 });
    const [entry] = await db.insert(revenueEntries).values({ workspaceId: workspace.id, month: body.month, amount: body.amount.trim(), source: (body.source || "Quảng cáo").trim() || "Quảng cáo", note: (body.note || "").trim() }).returning();
    return NextResponse.json({ id: entry.id, month: entry.month, amount: entry.amount, source: entry.source, note: entry.note, createdAt: entry.createdAt.toISOString() }, { status: 201 });
  } catch (error) { return apiError(error); }
}
