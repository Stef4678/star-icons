/** Count emoji icons per pack from the source. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "packs", "emoji.ts"),
  "utf8",
);

function countSection(name) {
  const start = src.indexOf(`export const ${name}`);
  const next = src.indexOf("\nexport const", start + 10);
  const section = src.slice(start, next > 0 ? next : src.length);
  return (section.match(/\{ name: "/g) || []).length;
}

const animals = countSection("ANIMALS_ICONS");
const nature = countSection("NATURE_ICONS");
const science = countSection("SCIENCE_ICONS");
console.log(`animals: ${animals}`);
console.log(`nature:  ${nature}`);
console.log(`science: ${science}`);
console.log(`total:   ${animals + nature + science}`);
