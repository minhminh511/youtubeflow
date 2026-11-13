import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
await page.goto(process.env.TEST_URL || "http://localhost:3000", { waitUntil: "networkidle" });
let passed = 0;
async function audit(label) {
  await page.waitForTimeout(250);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const failures = result.violations.map((violation) => ({ rule: violation.id, targets: violation.nodes.map((node) => node.target) }));
  assert.deepEqual(failures, [], `${label} should have no WCAG A/AA violations`);
  passed++;
}
await audit("Connection overview");
await page.getByRole("button", { name: "Hướng dẫn thao tác", exact: true }).click();
await expect(page.getByRole("dialog")).toBeVisible();
await audit("Guided setup dialog");
await page.keyboard.press("Escape");
await expect(page.getByRole("dialog")).toBeHidden();
await page.getByRole("tab", { name: "Quyền truy cập" }).click();
await audit("Data permissions");
for (const name of ["Tổng quan", "YouTube Studio", "Ý tưởng & chiến lược", "Kiếm tiền", "Edit Video/Image", "Lịch nội dung", "Kho ý tưởng", "Phân tích", "Cài đặt"]) {
  await page.locator(".sidebar .nav-item").filter({ hasText: new RegExp(`^${name}$`) }).click();
  await audit(name);
}
await page.getByRole("button", { name: "Trung tâm trợ giúp", exact: true }).click();
await audit("Help dialog");
await page.getByRole("button", { name: "Câu hỏi thường gặp", exact: true }).click();
await audit("Troubleshooting");
await page.getByRole("button", { name: "Bảo mật", exact: true }).click();
await audit("Privacy information");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
await page.locator(".sidebar .nav-item").filter({ hasText: "Kết nối kênh" }).click();
await audit("Mobile connection overview");
await page.locator(".connect-button").click();
await audit("Missing OAuth configuration dialog");
await browser.close();
console.log(`PASS: ${passed} screens and dialog states have no detected WCAG A/AA violations.`);
