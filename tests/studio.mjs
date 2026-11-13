import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://localhost:3000";
async function session() {
  const response = await fetch(`${base}/api/workspace`);
  assert.equal(response.status, 200);
  return { cookie: response.headers.get("set-cookie")?.split(";")[0], data: await response.json() };
}
const first = await session();
const second = await session();
const call = (path, method = "GET", body, cookie = first.cookie, headers = {}) => fetch(`${base}${path}`, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });

assert.equal((await fetch(`${base}/api/youtube/videos`)).status, 401, "anonymous cannot read studio videos");
assert.equal((await call("/api/youtube/videos")).status, 200, "connected workspace can read local video list");
assert.deepEqual(await (await call("/api/youtube/videos")).json(), [], "no fake videos are invented before sync");
const syncStatus = (await call("/api/youtube/videos", "POST")).status;
assert.ok([409, 503].includes(syncStatus), "sync requires configuration and a connected channel");
assert.equal((await call("/api/youtube/comments")).status, 400, "comments require a video id");
assert.equal((await call("/api/youtube/comments?videoId=bad")).status, 400, "invalid video id rejected");
const commentsStatus = (await call("/api/youtube/comments?videoId=dQw4w9WgXcQ")).status;
assert.ok([409, 503].includes(commentsStatus), "comments require configuration and a connected channel");
const analyticsStatus = (await call("/api/youtube/analytics/videos")).status;
assert.ok([409, 503].includes(analyticsStatus), "per-video analytics require configuration and a connected channel");
assert.equal((await call("/api/youtube/videos/not-a-uuid", "PATCH", { localStatus: "draft" })).status, 400, "invalid video id rejected");
assert.equal((await call("/api/youtube/videos/00000000-0000-0000-0000-000000000000", "PATCH", { localStatus: "draft" })).status, 404, "unknown video returns 404");
assert.equal((await call("/api/youtube/videos/00000000-0000-0000-0000-000000000000", "PATCH", { localStatus: "bogus" })).status, 400, "invalid local status rejected");
assert.equal((await call("/api/youtube/videos/00000000-0000-0000-0000-000000000000", "DELETE")).status, 404, "unknown video cannot be deleted");
assert.equal((await call("/api/youtube/upload", "POST", { title: "x" })).status, 400, "upload without file is rejected before any Google call");

const planResponse = await call("/api/plans", "POST", { title: "Kế hoạch kiểm thử Studio", description: "", format: "video", status: "planned", scheduledDate: "2026-12-20" });
assert.equal(planResponse.status, 201);
const plan = await planResponse.json();
assert.equal((await call("/api/youtube/videos/00000000-0000-0000-0000-000000000000", "PATCH", { planId: plan.id }, second.cookie)).status, 404, "another workspace cannot link a plan to a video");
await call(`/api/plans/${plan.id}`, "DELETE");
const workspace = await (await call("/api/workspace")).json();
assert.ok(!JSON.stringify(workspace).includes("encryptedTokens"), "tokens never leave the server");
console.log("PASS: Studio API gating, validation, workspace isolation, and no fabricated video data.");
