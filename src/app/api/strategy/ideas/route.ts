import { NextRequest, NextResponse } from "next/server";
import { apiError, requireWorkspace } from "@/lib/workspace";
import { generateIdeas } from "@/lib/strategy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const workspace = await requireWorkspace(request);
    const ideas = await generateIdeas(workspace.id);
    return NextResponse.json(ideas, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
