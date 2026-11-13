import type { PlanInput } from "@/lib/types";

export function parsePlan(body: unknown): PlanInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) return null;
  if (typeof input.description !== "string" || input.description.length > 5000) return null;
  if (!["video", "short", "live"].includes(String(input.format))) return null;
  if (!["idea", "planned", "published"].includes(String(input.status))) return null;
  const scheduledDate = input.scheduledDate || null;
  if (scheduledDate !== null) {
    if (typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return null;
    const parsed = new Date(`${scheduledDate}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== scheduledDate) return null;
  }
  if (input.status === "planned" && !scheduledDate) return null;
  return { title: input.title.trim(), description: input.description.trim(), format: input.format as PlanInput["format"], status: input.status as PlanInput["status"], scheduledDate: scheduledDate as string | null };
}
export const validUuid = (id: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id);
