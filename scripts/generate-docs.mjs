#!/usr/bin/env node
// Generates docs/preview.svg, docs/index.html and the README icon table from
// manifest.json. Zero dependencies — run with `node scripts/generate-docs.mjs`.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(ROOT, "docs");
const REPO_URL = "https://github.com/music-assistant/shared-icons";
const CATEGORIES = ["device", "player", "media", "area"];

const manifest = JSON.parse(await readFile(join(ROOT, "manifest.json"), "utf8"));
const byCategory = CATEGORIES.map((cat) => [
  cat,
  manifest.icons.filter((i) => i.category === cat),
]);

const svgById = new Map();
for (const icon of manifest.icons) {
  const raw = await readFile(join(ROOT, "icons", `${icon.id}.svg`), "utf8");
  svgById.set(icon.id, raw.replace(/<!--[\s\S]*?-->\n?/g, "").trim());
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

/** Re-root an icon SVG so it can be nested inside another SVG at (x, y). */
function embedIcon(id, x, y, size) {
  return svgById
    .get(id)
    .replace(/\s+width="24"\s+height="24"/, "")
    .replace(/^<svg/, `<svg x="${x}" y="${y}" width="${size}" height="${size}"`);
}

// --- docs/preview.svg (works on GitHub in both light and dark theme) --------
const GRAY = "#848d97";
const COLS = 8;
const CELL_W = 92;
const CELL_H = 74;
const ICON = 32;
const PAD = 20;
const WIDTH = PAD * 2 + COLS * CELL_W;

let y = PAD;
const parts = [];
parts.push(
  `<text class="v" x="${WIDTH - PAD}" y="${y + 12}">v${manifest.version} · ${manifest.icons.length} icons</text>`,
);
for (const [cat, list] of byCategory) {
  parts.push(`<text class="h" x="${PAD}" y="${y + 12}">${capitalize(cat)}</text>`);
  const gridTop = y + 26;
  list.forEach((icon, i) => {
    const cellX = PAD + (i % COLS) * CELL_W;
    const iconY = gridTop + Math.floor(i / COLS) * CELL_H;
    parts.push(embedIcon(icon.id, cellX + (CELL_W - ICON) / 2, iconY, ICON));
    parts.push(
      `<text class="l" x="${cellX + CELL_W / 2}" y="${iconY + ICON + 16}">${icon.id}</text>`,
    );
  });
  y = gridTop + Math.ceil(list.length / COLS) * CELL_H + 10;
}
const HEIGHT = y + PAD - 10;

const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="system-ui, sans-serif">
<style>
  text { fill: ${GRAY}; }
  .h { font-size: 15px; font-weight: 600; }
  .l { font-size: 11px; text-anchor: middle; }
  .v { font-size: 12px; text-anchor: end; }
</style>
<g color="${GRAY}">
${parts.join("\n")}
</g>
</svg>
`;

// --- docs/index.html (the GitHub Pages gallery) -----------------------------
const sections = byCategory
  .map(([cat, list]) => {
    const cards = list
      .map((icon) => {
        const search = [
          icon.id,
          icon.name,
          icon.category,
          ...icon.keywords,
          ...icon.aliases,
          icon.mdi,
        ]
          .join(" ")
          .toLowerCase();
        const aliases = icon.aliases.length
          ? `<span class="aliases">aka ${icon.aliases.join(", ")}</span>`
          : "";
        return `<div class="card" data-search="${search}">
  ${svgById.get(icon.id)}
  <code>${icon.id}</code>
  <span class="name">${icon.name}</span>
  ${aliases}
</div>`;
      })
      .join("\n");
    return `<section>
<h2>${capitalize(cat)}</h2>
<div class="grid">
${cards}
</div>
</section>`;
  })
  .join("\n");

const indexHtml = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Music Assistant icons</title>
<style>
  :root { --bg: #ffffff; --card: #f6f8fa; --text: #1f2328; --muted: #656d76; --border: #d1d9e0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --card: #161b22; --text: #e6edf3; --muted: #8b949e; --border: #30363d; }
  }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 1080px; padding: 40px 24px 64px; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  h1 small { font-size: 15px; font-weight: 400; color: var(--muted); }
  .sub { margin: 0 0 24px; color: var(--muted); }
  .sub a { color: inherit; }
  #q { width: 100%; max-width: 420px; margin-bottom: 28px; padding: 10px 14px; font: inherit; color: var(--text); background: var(--card); border: 1px solid var(--border); border-radius: 8px; outline: none; }
  h2 { margin: 28px 0 12px; font-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 8px 14px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; text-align: center; }
  .card svg { width: 32px; height: 32px; margin-bottom: 6px; }
  .card code { font-size: 12px; }
  .card .name, .card .aliases { font-size: 11px; color: var(--muted); }
  .empty { color: var(--muted); }
  footer { margin-top: 48px; font-size: 13px; color: var(--muted); }
  footer a { color: inherit; }
</style>
<h1>Music Assistant icons <small>v${manifest.version}</small></h1>
<p class="sub">The shared icon set used by every Music Assistant client — one stable id per icon, rendered identically everywhere. <a href="${REPO_URL}">Repository</a></p>
<input id="q" type="search" placeholder="Filter by id, name, alias or keyword…" autofocus>
${sections}
<p class="empty" hidden>No icons match.</p>
<footer>Unknown ids fall back to <code>${manifest.fallback}</code>. Apache-2.0; vendored icons remain under their upstream licenses — see <a href="${REPO_URL}/blob/main/ATTRIBUTION.md">attribution</a>.</footer>
<script>
  const q = document.getElementById("q");
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    let any = false;
    for (const card of document.querySelectorAll(".card")) {
      const hit = !term || card.dataset.search.includes(term);
      card.hidden = !hit;
      any = any || hit;
    }
    for (const section of document.querySelectorAll("section")) {
      section.hidden = !section.querySelector(".card:not([hidden])");
    }
    document.querySelector(".empty").hidden = any;
  });
</script>
`;

// --- README table between the GENERATED markers ------------------------------
const tableRows = manifest.icons.map((icon) => {
  const aliases = icon.aliases.map((a) => `\`${a}\``).join(", ") || "—";
  return `| \`${icon.id}\` | ${icon.name} | ${icon.category} | ${aliases} | \`${icon.mdi}\` |`;
});
const generated = `<!-- GENERATED:START — do not edit by hand; run \`node scripts/generate-docs.mjs\` -->
![All icons in the set](docs/preview.svg)

| Id | Name | Category | Aliases | MDI fallback |
| --- | --- | --- | --- | --- |
${tableRows.join("\n")}
<!-- GENERATED:END -->`;

const readmePath = join(ROOT, "README.md");
const readme = await readFile(readmePath, "utf8");
const markers = /<!-- GENERATED:START[\s\S]*?<!-- GENERATED:END -->/;
if (!markers.test(readme)) {
  console.error("✗ README.md is missing the GENERATED:START/END markers");
  process.exit(1);
}

await mkdir(DOCS_DIR, { recursive: true });
await writeFile(join(DOCS_DIR, "preview.svg"), previewSvg);
await writeFile(join(DOCS_DIR, "index.html"), indexHtml);
await writeFile(readmePath, readme.replace(markers, generated));
console.log(
  `✓ generated docs/preview.svg, docs/index.html and the README table (${manifest.icons.length} icons)`,
);
