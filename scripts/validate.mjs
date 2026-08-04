#!/usr/bin/env node
// Validates manifest.json and icons/*.svg. Zero dependencies — run with `node scripts/validate.mjs`.
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = join(ROOT, "icons");
const MAX_SVG_BYTES = 6 * 1024;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CATEGORIES = new Set(["device", "player", "media", "area"]);
const SOURCE_SETS = new Set(["custom", "lucide", "tabler"]);

const errors = [];
const fail = (msg) => errors.push(msg);

// --- manifest (the contract: ids + fallback) --------------------------------
const manifest = JSON.parse(await readFile(join(ROOT, "manifest.json"), "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) {
  fail(`manifest: version "${manifest.version}" is not a semver string`);
}

const ids = new Set();
for (const id of manifest.icons ?? []) {
  if (!KEBAB.test(id ?? "")) fail(`icon "${id}": id is not kebab-case`);
  if (ids.has(id)) fail(`icon "${id}": duplicate id`);
  ids.add(id);
}
if (!ids.has(manifest.fallback)) {
  fail(`manifest: fallback "${manifest.fallback}" is not a known icon id`);
}

// --- meta.json (non-normative, but must stay complete and well-formed) ------
const meta = JSON.parse(await readFile(join(ROOT, "meta.json"), "utf8"));

for (const id of ids) {
  const entry = meta.icons?.[id];
  const ctx = `meta "${id}"`;
  if (!entry) {
    fail(`${ctx}: missing meta.json entry`);
    continue;
  }
  if (!entry.name) fail(`${ctx}: missing name`);
  if (!CATEGORIES.has(entry.category)) {
    fail(`${ctx}: unknown category "${entry.category}"`);
  }
  if (!SOURCE_SETS.has(entry.source?.set)) {
    fail(`${ctx}: unknown source set "${entry.source?.set}"`);
  } else if (entry.source.set !== "custom" && !entry.source.name) {
    fail(`${ctx}: non-custom source requires source.name`);
  }
  if (!Array.isArray(entry.keywords)) fail(`${ctx}: keywords must be an array`);
}
for (const id of Object.keys(meta.icons ?? {})) {
  if (!ids.has(id)) fail(`meta "${id}": not a manifest.json id`);
}

// --- icons/ <-> manifest sync ----------------------------------------------
const svgFiles = (await readdir(ICONS_DIR)).filter((f) => f.endsWith(".svg"));
const svgIds = new Set(svgFiles.map((f) => f.replace(/\.svg$/, "")));

for (const id of ids) {
  if (!svgIds.has(id)) fail(`icon "${id}": missing icons/${id}.svg`);
}
for (const id of svgIds) {
  if (!ids.has(id)) fail(`icons/${id}.svg: not declared in manifest.json`);
}

// --- SVG content ------------------------------------------------------------
for (const file of svgFiles) {
  const ctx = `icons/${file}`;
  const raw = await readFile(join(ICONS_DIR, file), "utf8");
  const bytes = Buffer.byteLength(raw);

  if (bytes > MAX_SVG_BYTES) {
    fail(`${ctx}: ${bytes} bytes exceeds the ${MAX_SVG_BYTES} byte budget`);
  }
  if (!raw.trimStart().startsWith("<svg")) fail(`${ctx}: must start with <svg>`);
  if (!raw.includes('xmlns="http://www.w3.org/2000/svg"')) {
    fail(`${ctx}: missing SVG xmlns`);
  }
  if (!raw.includes('viewBox="0 0 24 24"')) {
    fail(`${ctx}: viewBox must be "0 0 24 24"`);
  }
  if (!raw.includes("currentColor")) {
    fail(`${ctx}: must paint with currentColor so clients can theme it`);
  }
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(raw)) {
    fail(`${ctx}: hardcoded colors are not allowed — use currentColor`);
  }
  if (/<script|<image|href=|url\(/.test(raw)) {
    fail(`${ctx}: scripts, embedded images and external references are not allowed`);
  }
}

// --- result -------------------------------------------------------------
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ manifest v${manifest.version}: ${ids.size} icons, all checks passed`);
