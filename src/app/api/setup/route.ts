import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { assertSameOrigin } from "@/lib/security";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace(request);
    const { step, completed } = await request.json();
    if (![1, 2, 4].includes(step) || typeof completed !== "boolean") {
      return NextResponse.json({ error: "Bước thiết lập không hợp lệ." }, { status: 400 });
    }
    const completedSteps = completed ? [...new Set([...workspace.completedSteps, step])].sort() : workspace.completedSteps.filter((item) => item !== step);
    await db.update(workspaces).set({ completedSteps }).where(eq(workspaces.id, workspace.id));
    return NextResponse.json({ completedSteps });
  } catch (error) { return apiError(error); }
}
