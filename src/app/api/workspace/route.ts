import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { apiError, createWorkspace, getWorkspace, requireWorkspace, setWorkspaceCookie, workspaceData } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    let workspace = await getWorkspace(request);
    let token: string | undefined;
    if (!workspace) {
      const created = await createWorkspace();
      workspace = created.workspace;
      token = created.token;
    }
    const response = NextResponse.json(await workspaceData(workspace), { headers: { "Cache-Control": "no-store" } });
    if (token) setWorkspaceCookie(response, request, token);
    return response;
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const body = await request.json();
    if (typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 80) {
      return NextResponse.json({ error: "Tên không gian phải có từ 1 đến 80 ký tự." }, { status: 400 });
    }
    await db.update(workspaces).set({ name: body.name.trim() }).where(eq(workspaces.id, workspace.id));
    return NextResponse.json({ name: body.name.trim() });
  } catch (error) { return apiError(error); }
}
