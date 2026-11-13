import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://localhost:3000";
async function session() {
  const response = await fetch(`${base}/api/workspace`);
  assert.equal(response.status, 200, "workspace initializes");
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "HttpOnly session cookie is created");
  assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
  return { cookie, data: await response.json() };
}
const first = await session();
const second = await session();
const call = (path, method = "GET", body, cookie = first.cookie, headers = {}) => fetch(`${base}${path}`, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });

assert.equal((await fetch(`${base}/api/health`)).status, 200);
assert.equal((await fetch(`${base}/api/plans`)).status, 401, "anonymous requests cannot read plans");
assert.equal((await call("/api/plans", "POST", {})).status, 400, "invalid plan rejected");
assert.equal((await call("/api/setup", "PATCH", { step: 3, completed: true })).status, 400, "environment verification cannot be self-reported");
assert.equal((await call("/api/setup", "PATCH", { step: 1, completed: true }, first.cookie, { "sec-fetch-site": "cross-site" })).status, 403, "cross-site mutations blocked");

const input = { title: "Kế hoạch kiểm thử tự động", description: "Verifies database persistence and workspace isolation.", format: "video", status: "planned", scheduledDate: "2026-12-12" };
const createdResponse = await call("/api/plans", "POST", input);
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json();
let list = await (await call("/api/plans")).json();
assert.ok(list.some((plan) => plan.id === created.id), "plan persists across requests");
assert.equal((await call(`/api/plans/${created.id}`, "PATCH", input, second.cookie)).status, 404, "another workspace cannot edit this plan");
assert.equal((await call(`/api/plans/${created.id}`, "DELETE", undefined, second.cookie)).status, 404, "another workspace cannot delete this plan");
assert.equal((await call(`/api/plans/${created.id}`, "PATCH", { ...input, title: "Đã cập nhật", status: "published" })).status, 200);
const marked = await call("/api/setup", "PATCH", { step: 1, completed: true });
assert.equal(marked.status, 200);
assert.ok((await marked.json()).completedSteps.includes(1));
const restored = await (await call("/api/workspace")).json();
assert.ok(restored.completedSteps.includes(1), "setup progress persists");
assert.equal(restored.plans[0].title, "Đã cập nhật");
assert.ok(!JSON.stringify(restored).includes("encryptedTokens"), "tokens never leave the server");
assert.equal((await call("/api/workspace", "PATCH", { name: "Không gian kiểm thử" })).status, 200);
assert.equal((await (await call("/api/workspace")).json()).name, "Không gian kiểm thử");
assert.equal((await call(`/api/plans/${created.id}`, "DELETE")).status, 200);
list = await (await call("/api/plans")).json();
assert.equal(list.length, 0);
await call("/api/setup", "PATCH", { step: 1, completed: false });
const config = await (await fetch(`${base}/api/config`)).json();
assert.equal(config.checks.length, 4);
assert.ok(!Object.hasOwn(config, "clientSecret"));
if (!config.ready) {
  const connect = await call("/api/youtube/connect");
  assert.equal(connect.status, 307);
  assert.match(connect.headers.get("location"), /oauth=missing_config/);
}
console.log("PASS: health, validation, session cookies, CRUD persistence, progress, configuration, OAuth gating, and workspace isolation.");
