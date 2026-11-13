import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://localhost:3000";
async function session() {
  const response = await fetch(`${base}/api/workspace`);
  assert.equal(response.status, 200);
  return { cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const first = await session();
const second = await session();
const call = (path, method = "GET", body, cookie = first.cookie) => fetch(`${base}${path}`, { method, headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });

assert.equal((await fetch(`${base}/api/strategy/pillars`)).status, 401, "anonymous cannot read pillars");
assert.equal((await call("/api/strategy/pillars")).status, 200);
assert.deepEqual(await (await call("/api/strategy/pillars")).json(), []);
assert.equal((await call("/api/strategy/pillars", "POST", { name: "" })).status, 400, "empty pillar name rejected");
const pillarResponse = await call("/api/strategy/pillars", "POST", { name: "Mẹo quay phim", description: "Kỹ thuật quay bằng điện thoại" });
assert.equal(pillarResponse.status, 201);
const pillar = await pillarResponse.json();
assert.equal((await call(`/api/strategy/pillars/${pillar.id}`, "PATCH", { name: "Mẹo quay phim nâng cao" }, second.cookie)).status, 404, "another workspace cannot edit a pillar");
const updated = await (await call(`/api/strategy/pillars/${pillar.id}`, "PATCH", { name: "Mẹo quay phim nâng cao" })).json();
assert.equal(updated.name, "Mẹo quay phim nâng cao");

const ideasResponse = await call("/api/strategy/ideas", "POST");
assert.equal(ideasResponse.status, 200);
const ideas = await ideasResponse.json();
assert.ok(Array.isArray(ideas) && ideas.length >= 2, "ideas are generated from pillars");
assert.ok(ideas.every((idea) => idea.title && idea.hook && ["video", "short"].includes(idea.format)));

assert.equal((await call("/api/strategy/competitors")).status, 200);
assert.equal((await call("/api/strategy/competitors", "POST", { handle: "" })).status, 400, "empty competitor handle rejected");
assert.equal((await call("/api/strategy/competitors", "POST", { handle: "@someone" })).status, 503, "competitor lookup requires Google configuration");
assert.equal((await call("/api/strategy/competitors/00000000-0000-0000-0000-000000000000", "DELETE")).status, 404);

const monetizationResponse = await call("/api/monetization");
assert.equal(monetizationResponse.status, 200);
const monetization = await monetizationResponse.json();
assert.equal(monetization.connected, false);
assert.equal(monetization.eligible, false);
assert.deepEqual(monetization.entries, []);
assert.equal((await call("/api/monetization", "PATCH", { checklist: { twoStep: true, adsense: false } })).status, 200);
const afterChecklist = await (await call("/api/monetization")).json();
assert.equal(afterChecklist.checklist.twoStep, true);
assert.equal((await call("/api/monetization", "PATCH", { revenueGoal: "abc" })).status, 400, "invalid revenue goal rejected");
assert.equal((await call("/api/monetization", "PATCH", { revenueGoal: "10000000" })).status, 200);

assert.equal((await call("/api/monetization/revenue", "POST", { month: "2026-13", amount: "1000" })).status, 400, "invalid month rejected");
assert.equal((await call("/api/monetization/revenue", "POST", { month: "2026-11", amount: "abc" })).status, 400, "invalid amount rejected");
const entryResponse = await call("/api/monetization/revenue", "POST", { month: "2026-11", amount: "2500000", source: "Quảng cáo", note: "Thử nghiệm" });
assert.equal(entryResponse.status, 201);
const entry = await entryResponse.json();
assert.equal((await call(`/api/monetization/revenue/${entry.id}`, "DELETE", undefined, second.cookie)).status, 404, "another workspace cannot delete revenue");
assert.equal((await call(`/api/monetization/revenue/${entry.id}`, "DELETE")).status, 200);
assert.equal((await call(`/api/strategy/pillars/${pillar.id}`, "DELETE")).status, 200);
console.log("PASS: pillars CRUD, idea generation, competitor validation, monetization eligibility, checklist, revenue log, and workspace isolation.");
