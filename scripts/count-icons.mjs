/** Compute the exact total icon count from the built data. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifest = JSON.parse(readFileSync(path.join(root, "packs", "manifest.json"), "utf8"));
let external = 0;
const rows = [];
for (const [pack, info] of Object.entries(manifest.packs)) {
  external += info.count;
  rows.push(`${pack.padEnd(20)}: ${info.count}`);
}

const emoji = readFileSync(path.join(root, "src", "data", "packs", "emoji.ts"), "utf8");
const countSection = (name) => {
  const start = emoji.indexOf(`export const ${name}`);
  const next = emoji.indexOf("\nexport const", start + 10);
  const section = emoji.slice(start, next > 0 ? next : emoji.length);
  return (section.match(/\{ name: "/g) || []).length;
};
const starSrc = readFileSync(path.join(root, "src", "data", "packs", "star.ts"), "utf8");
// star.ts entries span multiple lines: `{` then `name: "…"` — count name lines.
const star = (starSrc.match(/name: "[a-z0-9-]+",/g) || []).length;
const core = star + countSection("ANIMALS_ICONS") + countSection("NATURE_ICONS") + countSection("SCIENCE_ICONS");

rows.sort();
console.log(rows.join("\n"));
console.log("-----------------------------------------");
console.log(`external packs: ${external} (${Object.keys(manifest.packs).length} packs)`);
console.log(`core (bundled): ${core} (star ${star}, animals ${countSection("ANIMALS_ICONS")}, nature ${countSection("NATURE_ICONS")}, science ${countSection("SCIENCE_ICONS")})`);
console.log(`GRAND TOTAL:    ${external + core}`);
