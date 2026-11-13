import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import preparation from "../scripts/prepare-assets.cjs";

const { preparePublicAssets, checkPublicAssets, validWoff2 } = preparation;
const temporary = await mkdtemp(path.join(tmpdir(), "tubeflow-assets-"));
const root = process.cwd();
async function copyShell(output) {
  await mkdir(output, { recursive: true });
  for (const file of ["offline.html", "offline.css", "offline.js", "sw.js"]) await copyFile(path.join(root, "public", file), path.join(output, file));
}
try {
  const output = path.join(temporary, "restored-public");
  await copyShell(output);
  const restored = await preparePublicAssets({ root, publicDir: output });
  assert.equal(restored.fonts.length, 2);
  assert.equal(restored.restored.length, 6, "four icons and two fonts recover from text-only sources");
  for (const name of restored.fonts) {
    const actual = await readFile(path.join(output, "fonts", name));
    assert.ok(validWoff2(actual));
    assert.deepEqual(actual, await readFile(path.join(root, "public/fonts", name)));
  }
  for (const [file, size] of [["icons/icon-192.png", 192], ["icons/icon-512.png", 512], ["icons/maskable-512.png", 512], ["apple-touch-icon.png", 180]]) {
    const info = await sharp(path.join(output, file)).metadata();
    assert.equal(info.format, "png"); assert.equal(info.width, size); assert.equal(info.height, size);
  }
  assert.equal((await checkPublicAssets({ publicDir: output })).ok, true);
  const cssFile = path.join(output, "fonts/font-faces.css");
  const before = (await stat(cssFile)).mtimeMs;
  assert.equal((await preparePublicAssets({ root, publicDir: output })).restored.length, 0);
  assert.equal((await stat(cssFile)).mtimeMs, before, "valid resources are not rewritten each build");
  await writeFile(path.join(output, "fonts/inter-latin.woff2"), "invalid-font");
  await writeFile(path.join(output, "icons/icon-192.png"), "<html>not a PNG</html>");
  const repaired = await preparePublicAssets({ root, publicDir: output });
  assert.ok(repaired.restored.includes("fonts/inter-latin.woff2"));
  assert.ok(repaired.restored.includes("icons/icon-192.png"));
  assert.equal((await checkPublicAssets({ publicDir: output })).ok, true);
  const fallback = path.join(temporary, "fallback-public");
  const missingSources = path.join(temporary, "missing-font-sources");
  await mkdir(missingSources, { recursive: true });
  await copyShell(fallback);
  const fallbackResult = await preparePublicAssets({ root, publicDir: fallback, fontsDir: missingSources });
  assert.equal(fallbackResult.fonts.length, 0);
  assert.equal(fallbackResult.warnings.length, 2);
  const fallbackCss = await readFile(path.join(fallback, "fonts/font-faces.css"), "utf8");
  assert.ok(!fallbackCss.includes("@font-face"), "missing optional fonts are not referenced");
  const checked = await checkPublicAssets({ publicDir: fallback });
  assert.equal(checked.ok, true);
  assert.equal(checked.usesSystemFonts, true);
  console.log("PASS: text-only export recovery, WOFF2 integrity, PNG sizes, corrupt-asset repair, stable writes, and system-font fallback without missing requests.");
} finally { await rm(temporary, { recursive: true, force: true }); }
