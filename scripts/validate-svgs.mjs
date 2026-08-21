/** Structural validation of generated icon SVG content. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const pack of ["lucide", "material", "material-outlined", "material-sharp", "tabler", "tabler-filled", "unicons", "unicons-solid", "unicons-monochrome", "unicons-thinline", "remix", "phosphor", "phosphor-bold", "phosphor-fill", "phosphor-light", "phosphor-thin", "phosphor-duotone", "bootstrap", "boxicons", "boxicons-solid", "boxicons-logos", "heroicons", "heroicons-solid", "fontawesome", "simple-icons", "ionicons", "antd", "line-awesome", "eva", "octicons", "openmoji", "openmoji-black", "twemoji", "fluent"]) {
  const data = JSON.parse(readFileSync(path.join(root, "src", "data", "generated", `${pack}.json`), "utf8"));
  let malformed = 0;
  let control = 0;
  let nonSelfClosing = 0;
  for (const ic of data.icons) {
    const s = ic.svg;
    // count open tags (<path etc), close tags (</path), self-closing (/>)
    const opens = (s.match(/<[a-zA-Z][^>]*>/g) || []);
    const closes = (s.match(/<\/[a-zA-Z]+>/g) || []);
    const selfClosing = opens.filter((t) => t.endsWith("/>"));
    if (opens.length !== closes.length + selfClosing.length) {
      malformed++;
      if (malformed <= 3) console.log("MALFORMED", pack, ic.name);
    }
    if (opens.some((t) => !t.endsWith("/>") && !t.startsWith("</"))) nonSelfClosing++;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(s)) control++;
  }
  console.log(`${pack}: ${data.icons.length} icons, malformed=${malformed}, nonSelfClosing=${nonSelfClosing}, controlChars=${control}`);
}

// star pack
const { STAR_ICONS } = await import(
  pathToFileURL(path.join(root, "src", "data", "packs", "star.ts")).href
);
console.log(`star: ${STAR_ICONS.length} icons`);
for (const ic of STAR_ICONS) {
  const s = ic.svg;
  const opens = s.match(/<[a-zA-Z][^>]*>/g) || [];
  const closes = s.match(/<\/[a-zA-Z]+>/g) || [];
  const selfClosing = opens.filter((t) => t.endsWith("/>"));
  if (opens.length !== closes.length + selfClosing.length) {
    console.log("MALFORMED star:", ic.name);
  }
}
console.log("star structural check done");
