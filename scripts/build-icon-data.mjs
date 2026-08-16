/**
 * Star Icons — icon data generator.
 *
 * Reads icon packs from node_modules and emits compact JSON data files
 * under src/data/generated/ that are bundled into the plugin (zero network
 * requests at runtime, offline-first).
 *
 *   - Lucide   : every icon from `lucide-static/icons/*.svg` + official tags.json
 *   - Material : a hand-curated subset from `@material-symbols/svg-400/rounded`
 *
 * Usage: node scripts/build-icon-data.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "data", "generated");

function probe(pkg, ...relCandidates) {
  for (const rel of relCandidates) {
    const dir = join(root, "node_modules", pkg, rel);
    if (existsSync(dir)) return dir;
  }
  return null;
}

function pkgVersion(pkg) {
  try {
    const p = JSON.parse(
      readFileSync(join(root, "node_modules", pkg, "package.json"), "utf8"),
    );
    return p.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Parse an .svg file's inner markup + viewBox, stripping comments/xml decls. */
function parseSvg(file) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
  if (!m) return null;
  const attrs = m[1];
  const vb = /viewBox\s*=\s*["']([^"']+)["']/.exec(attrs);
  return {
    inner: m[2].trim(),
    viewBox: vb ? vb[1] : "0 0 24 24",
  };
}

/* ------------------------------------------------------------------ */
/* Lucide                                                              */
/* ------------------------------------------------------------------ */

function buildLucide() {
  const dir = probe("lucide-static", "icons", "svg", "dist/icons");
  if (!dir) {
    console.warn("[lucide] icons directory not found — skipping");
    return null;
  }
  const tags = (() => {
    try {
      const t = JSON.parse(readFileSync(join(root, "node_modules", "lucide-static", "tags.json"), "utf8"));
      return t;
    } catch {
      return {};
    }
  })();

  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const name = f.slice(0, -4);
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: tags[name] ?? [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "lucide",
    version: pkgVersion("lucide-static"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Material Symbols (FULL rounded set)                                 */
/* ------------------------------------------------------------------ */

function buildMaterial() {
  const dir =
    probe("@material-symbols/svg-400", "rounded", "outlined", "sharp") ??
    probe("@material-symbols/svg-400", "rounded/400", "outlined/400", "sharp/400");
  if (!dir) {
    console.warn("[material] directory not found — skipping");
    return null;
  }
  // Full set: every SVG in the rounded weight (base + -fill variants).
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));

  return {
    pack: "material",
    version: pkgVersion("@material-symbols/svg-400"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Tabler Icons (outline, full pack + official tags/categories)        */
/* ------------------------------------------------------------------ */

function buildTabler() {
  const dir = probe("@tabler/icons", "icons/outline");
  if (!dir) {
    console.warn("[tabler] icons directory not found — skipping");
    return null;
  }
  let meta = {};
  try {
    meta = JSON.parse(
      readFileSync(join(root, "node_modules", "@tabler", "icons", "icons.json"), "utf8"),
    );
  } catch {
    /* metadata is optional */
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const name = f.slice(0, -4);
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    const m = meta[name] ?? {};
    const tags = [
      ...(Array.isArray(m.tags) ? m.tags.map(String) : []),
      typeof m.category === "string" ? m.category : "",
    ].filter(Boolean);
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "tabler",
    version: pkgVersion("@tabler/icons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Tabler Filled (separate pack; same names as outline)                */
/* ------------------------------------------------------------------ */

function buildTablerFilled() {
  const dir = probe("@tabler/icons", "icons/filled");
  if (!dir) {
    console.warn("[tabler-filled] icons directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "tabler-filled",
    version: pkgVersion("@tabler/icons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Unicons (line variant, full pack)                                   */
/* ------------------------------------------------------------------ */

function buildUnicons() {
  const dir = probe("@iconscout/unicons", "svg/line", "svg/outline");
  if (!dir) {
    console.warn("[unicons] line directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const name = f.slice(0, -4);
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "unicons",
    version: pkgVersion("@iconscout/unicons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Remix Icon (line variant; category folders become search tags)      */
/* ------------------------------------------------------------------ */

function buildRemix() {
  const rootDir = join(root, "node_modules", "remixicon", "icons");
  if (!existsSync(rootDir)) {
    console.warn("[remix] icons directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const category = entry.name;
    const dir = join(rootDir, category);
    for (const f of readdirSync(dir)) {
      // Both variants: home-line.svg and home-fill.svg (distinct names).
      if (!f.endsWith("-line.svg") && !f.endsWith("-fill.svg")) continue;
      const parsed = parseSvg(join(dir, f));
      if (!parsed) continue;
      icons.push({
        name: f.slice(0, -4),
        svg: parsed.inner,
        viewBox: parsed.viewBox,
        tags: [category],
      });
    }
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "remix",
    version: pkgVersion("remixicon"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Phosphor Icons (regular weight)                                     */
/* ------------------------------------------------------------------ */

function buildPhosphor() {
  const dir = probe("@phosphor-icons/core", "assets/regular", "assets");
  if (!dir) {
    console.warn("[phosphor] regular directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "phosphor",
    version: pkgVersion("@phosphor-icons/core"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Bootstrap Icons (full pack)                                         */
/* ------------------------------------------------------------------ */

function buildBootstrap() {
  const dir = probe("bootstrap-icons", "icons");
  if (!dir) {
    console.warn("[bootstrap] icons directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "bootstrap",
    version: pkgVersion("bootstrap-icons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Boxicons (regular, full pack; filenames are prefixed "bx-")         */
/* ------------------------------------------------------------------ */

function buildBoxicons() {
  const dir = probe("boxicons", "svg/regular");
  if (!dir) {
    console.warn("[boxicons] regular directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    const name = f.slice(3, -4); // strip the "bx-" prefix
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "boxicons",
    version: pkgVersion("boxicons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Heroicons (v2 outline, full pack)                                   */
/* ------------------------------------------------------------------ */

function buildHeroicons() {
  const dir = probe("heroicons", "24/outline", "outline");
  if (!dir) {
    console.warn("[heroicons] outline directory not found — skipping");
    return null;
  }
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return {
    pack: "heroicons",
    version: pkgVersion("heroicons"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* OpenMoji Color — curated full-color emoji SVGs (CC BY-SA 4.0)       */
/* ------------------------------------------------------------------ */

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildOpenMoji() {
  const svgDir = join(root, "node_modules", "openmoji", "color", "svg");
  const dataFile = join(root, "node_modules", "openmoji", "data", "openmoji.json");
  if (!existsSync(svgDir) || !existsSync(dataFile)) {
    console.warn("[openmoji] color svg or metadata not found — skipping");
    return null;
  }
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  // FULL set: every group (smileys, people, animals, food, travel,
  // activities, objects, symbols, flags, extras) except skin-tone
  // variants and the "component" group.
  const usedNames = new Set();
  const icons = [];
  for (const entry of data) {
    if (entry.group === "component") continue;
    if (entry.skintone || entry.skintone_combination) continue;
    if (!/^[0-9A-F]+$/.test(entry.hexcode)) continue;
    const svgFile = join(svgDir, `${entry.hexcode}.svg`);
    if (!existsSync(svgFile)) continue;
    const parsed = parseSvg(svgFile);
    if (!parsed) continue;
    let name = slugify(entry.annotation) || entry.hexcode.toLowerCase();
    if (usedNames.has(name)) name = `${name}-${entry.hexcode.toLowerCase()}`;
    usedNames.add(name);
    const tags = (entry.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags });
  }
  return {
    pack: "openmoji",
    version: pkgVersion("openmoji"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */
/* Tier 2: Font Awesome Free (solid + regular, no brands)              */
/* ------------------------------------------------------------------ */

function buildFontAwesome() {
  const icons = [];
  for (const [variant, rel] of [["solid", "svgs/solid"], ["regular", "svgs/regular"]]) {
    const dir = probe("@fortawesome/fontawesome-free", rel);
    if (!dir) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      const parsed = parseSvg(join(dir, f));
      if (!parsed) continue;
      icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [variant] });
    }
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "fontawesome", version: pkgVersion("@fortawesome/fontawesome-free"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Simple Icons (brand logos, CC0)                                     */
/* ------------------------------------------------------------------ */

function buildSimpleIcons() {
  const dir = probe("simple-icons", "icons");
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: ["brand", "logo"] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "simple-icons", version: pkgVersion("simple-icons"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Ionicons (v8: base + outline + sharp variants)                      */
/* ------------------------------------------------------------------ */

function buildIonicons() {
  const dir = probe("ionicons", "dist/svg", "svg");
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "ionicons", version: pkgVersion("ionicons"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Ant Design Icons (outlined/filled/twotone folders share basenames)  */
/* ------------------------------------------------------------------ */

function buildAntd() {
  const icons = [];
  for (const variant of ["outlined", "filled", "twotone"]) {
    const dir = probe("@ant-design/icons-svg", `inline-svg/${variant}`, variant);
    if (!dir) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      const parsed = parseSvg(join(dir, f));
      if (!parsed) continue;
      icons.push({ name: `${f.slice(0, -4)}-${variant}`, svg: parsed.inner, viewBox: parsed.viewBox, tags: [variant] });
    }
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "antd", version: pkgVersion("@ant-design/icons-svg"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Line Awesome (full pack)                                            */
/* ------------------------------------------------------------------ */

function buildLineAwesome() {
  const dir = probe("line-awesome", "svg", "dist/svg");
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "line-awesome", version: pkgVersion("line-awesome"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Eva Icons (outline + fill, names already carry the suffix)          */
/* ------------------------------------------------------------------ */

function buildEva() {
  const icons = [];
  for (const variant of ["outline", "fill"]) {
    const dir = probe("eva-icons", `${variant}/svg`);
    if (!dir) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      const parsed = parseSvg(join(dir, f));
      if (!parsed) continue;
      icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [variant] });
    }
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "eva", version: pkgVersion("eva-icons"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Octicons (all size variants)                                        */
/* ------------------------------------------------------------------ */

function buildOcticons() {
  const dir = probe("@primer/octicons", "build/svg", "svg");
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "octicons", version: pkgVersion("@primer/octicons"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* CSS.gg                                                              */
/* ------------------------------------------------------------------ */

function buildCssgg() {
  const dir = probe("css.gg", "icons/svg", "icons");
  if (!dir) return null;
  const icons = [];
  const scan = (scanDir) => {
    let entries;
    try {
      entries = readdirSync(scanDir);
    } catch {
      return;
    }
    for (const f of entries) {
      const p = join(scanDir, f);
      if (!f.endsWith(".svg")) {
        try {
          if (readdirSync(p)) scan(p);
        } catch {
          /* not a directory */
        }
        continue;
      }
      const parsed = parseSvg(p);
      if (!parsed) continue;
      icons.push({ name: f.slice(0, -4), svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
    }
  };
  scan(dir);
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "cssgg", version: pkgVersion("css.gg"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Generic flat-pack builder (one directory of SVGs)                   */
/* ------------------------------------------------------------------ */

function buildFlatPack(pack, pkg, rels, styleTags = []) {
  const dir = probe(pkg, ...rels);
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    const name = f.slice(0, -4);
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: [...styleTags] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack, version: pkgVersion(pkg), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Tier 1: extra weights/variants of already-installed packs           */
/* ------------------------------------------------------------------ */

function buildMaterialWeight(pack, rel) {
  return buildFlatPack(pack, "@material-symbols/svg-400", [rel]);
}

function buildPhosphorWeight(pack, rel) {
  return buildFlatPack(pack, "@phosphor-icons/core", [`assets/${rel}`]);
}

function buildUniconsVariant(pack, rel) {
  return buildFlatPack(pack, "@iconscout/unicons", [`svg/${rel}`]);
}

function buildBoxiconsVariant(pack, rel) {
  const dir = probe("boxicons", `svg/${rel}`);
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    // strip bx- (3), bxs- (4) or bxl- (4) prefix
    const name = f.replace(/^bxs?-|^bxl-/, "").slice(0, -4);
    if (!name) continue;
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack, version: pkgVersion("boxicons"), count: icons.length, icons };
}

function buildOpenMojiVariant(pack, rel, styleTags) {
  const svgDir = join(root, "node_modules", "openmoji", rel);
  const dataFile = join(root, "node_modules", "openmoji", "data", "openmoji.json");
  if (!existsSync(svgDir) || !existsSync(dataFile)) return null;
  const data = JSON.parse(readFileSync(dataFile, "utf8"));
  const byHex = new Map();
  for (const entry of data) byHex.set(entry.hexcode, entry);
  const usedNames = new Set();
  const icons = [];
  for (const f of readdirSync(svgDir)) {
    if (!f.endsWith(".svg")) continue;
    const hex = f.slice(0, -4);
    if (!/^[0-9A-F]+$/.test(hex)) continue;
    const parsed = parseSvg(join(svgDir, f));
    if (!parsed) continue;
    const meta = byHex.get(hex);
    let name = meta ? slugify(meta.annotation) : hex.toLowerCase();
    if (usedNames.has(name)) name = `${name}-${hex.toLowerCase()}`;
    usedNames.add(name);
    const tags = [...styleTags];
    if (meta) {
      tags.push(...(meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean));
    }
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack, version: pkgVersion("openmoji"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Tier 3: full-color emoji SVGs (twemoji + fluent)                    */
/* ------------------------------------------------------------------ */

function buildTwemoji() {
  const dir = probe("twemoji-svg", "dist", "svg");
  if (!dir) return null;
  const dataFile = join(root, "node_modules", "openmoji", "data", "openmoji.json");
  const byHex = new Map();
  try {
    for (const entry of JSON.parse(readFileSync(dataFile, "utf8"))) byHex.set(entry.hexcode, entry);
  } catch {
    /* names fall back to hex */
  }
  const usedNames = new Set();
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const hex = f.slice(0, -4).toUpperCase();
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    const meta = byHex.get(hex);
    let name = meta ? slugify(meta.annotation) : hex.toLowerCase();
    if (usedNames.has(name)) name = `${name}-${hex.toLowerCase()}`;
    usedNames.add(name);
    const tags = ["color", "emoji"];
    if (meta) {
      tags.push(...(meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean));
    }
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "twemoji", version: pkgVersion("twemoji-svg"), count: icons.length, icons };
}

function buildFluent() {
  const dir = probe("fluentui-emoji", "icons/flat", "icons");
  if (!dir) return null;
  const icons = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".svg")) continue;
    const parsed = parseSvg(join(dir, f));
    if (!parsed) continue;
    icons.push({
      name: f.slice(0, -4).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      svg: parsed.inner,
      viewBox: parsed.viewBox,
      tags: ["color", "emoji"],
    });
  }
  icons.sort((a, b) => a.name.localeCompare(b.name));
  return { pack: "fluent", version: pkgVersion("fluentui-emoji"), count: icons.length, icons };
}

/* ------------------------------------------------------------------ */
/* Style tags: make 50k+ searchable without feeling like duplicates    */
/* ------------------------------------------------------------------ */

const STYLE_TAGS = {
  lucide: ["outline", "stroke"],
  material: null, // name-based (fill vs outline)
  tabler: ["outline"],
  "tabler-filled": ["filled"],
  unicons: ["line", "outline"],
  remix: null, // name-based
  phosphor: ["regular", "outline"],
  bootstrap: ["filled"],
  boxicons: ["filled"],
  heroicons: ["outline"],
  openmoji: ["color", "emoji"],
  "material-outlined": ["outline"],
  "material-sharp": ["sharp"],
  "phosphor-bold": ["bold"],
  "phosphor-fill": ["fill", "filled"],
  "phosphor-light": ["light"],
  "phosphor-thin": ["thin"],
  "phosphor-duotone": ["duotone", "color"],
  "unicons-solid": ["solid", "filled"],
  "unicons-monochrome": ["monochrome"],
  "unicons-thinline": ["thinline"],
  "boxicons-solid": ["solid", "filled"],
  "boxicons-logos": ["brand", "logo"],
  "heroicons-solid": ["solid", "filled"],
  "openmoji-black": ["monochrome", "emoji"],
  fontawesome: null, // name-based via solid/regular tags already applied
  "simple-icons": ["brand", "logo", "monochrome"],
  ionicons: null, // name-based
  antd: null, // name-based
  "line-awesome": ["line", "outline"],
  eva: null, // name-based
  octicons: ["filled"],
  cssgg: ["outline", "stroke"],
  twemoji: ["color", "emoji"],
  fluent: ["color", "emoji"],
};

function applyStyles(data) {
  if (!data) return data;
  const styles = STYLE_TAGS[data.pack];
  if (styles) {
    for (const icon of data.icons) {
      icon.tags = Array.from(new Set([...icon.tags, ...styles]));
    }
  }
  // name-suffix style tagging for mixed-style packs
  for (const icon of data.icons) {
    if (/material/.test(data.pack)) icon.tags.push(icon.name.endsWith("-fill") ? "filled" : "outline");
    if (data.pack === "remix") icon.tags.push(icon.name.endsWith("-fill") ? "filled" : "line");
    if (data.pack === "antd") {
      icon.tags.push(
        icon.name.endsWith("-outlined") ? "outline" : icon.name.endsWith("-twotone") ? "twotone" : "filled",
      );
    }
    if (data.pack === "eva") icon.tags.push(icon.name.endsWith("-outline") ? "outline" : "filled");
    if (data.pack === "ionicons") {
      icon.tags.push(icon.name.endsWith("-outline") ? "outline" : icon.name.endsWith("-sharp") ? "sharp" : "filled");
    }
    icon.tags = Array.from(new Set(icon.tags));
  }
  return data;
}

/* ------------------------------------------------------------------ */

const ALL_BUILT = [
  buildLucide(),
  buildMaterial(),
  buildTabler(),
  buildTablerFilled(),
  buildUnicons(),
  buildRemix(),
  buildPhosphor(),
  buildBootstrap(),
  buildBoxicons(),
  buildHeroicons(),
  buildOpenMoji(),
  // Tier 1 — weight/style variants of installed packs
  buildMaterialWeight("material-outlined", "outlined"),
  buildMaterialWeight("material-sharp", "sharp"),
  buildPhosphorWeight("phosphor-bold", "bold"),
  buildPhosphorWeight("phosphor-fill", "fill"),
  buildPhosphorWeight("phosphor-light", "light"),
  buildPhosphorWeight("phosphor-thin", "thin"),
  buildPhosphorWeight("phosphor-duotone", "duotone"),
  buildUniconsVariant("unicons-solid", "solid"),
  buildUniconsVariant("unicons-monochrome", "monochrome"),
  buildUniconsVariant("unicons-thinline", "thinline"),
  buildBoxiconsVariant("boxicons-solid", "solid"),
  buildBoxiconsVariant("boxicons-logos", "logos"),
  buildFlatPack("heroicons-solid", "heroicons", ["24/solid", "solid"], ["solid", "filled"]),
  buildOpenMojiVariant("openmoji-black", "black/svg", ["monochrome", "emoji"]),
  // Tier 2 — new installable packs
  buildFontAwesome(),
  buildFlatPack("simple-icons", "simple-icons", ["icons"], ["brand", "logo"]),
  buildIonicons(),
  buildAntd(),
  buildFlatPack("line-awesome", "line-awesome", ["svg", "dist/svg"], ["line", "outline"]),
  buildEva(),
  buildFlatPack("octicons", "@primer/octicons", ["build/svg", "svg"], ["filled"]),
  buildCssgg(),
  // Tier 3 — full-color emoji SVGs
  buildTwemoji(),
  buildFluent(),
].map(applyStyles);

for (const data of ALL_BUILT) {
  if (!data) continue;
  const file = join(outDir, `${data.pack}.json`);
  writeFileSync(file, JSON.stringify(data));
  console.log(`wrote ${file} (${Math.round(JSON.stringify(data).length / 1024)} KB, ${data.count} icons)`);
}

const grandTotal = ALL_BUILT.reduce((sum, d) => sum + (d ? d.count : 0), 0);
console.log(`\nStar Icons — icon data generation complete (${grandTotal.toLocaleString()} icons across ${ALL_BUILT.filter(Boolean).length} packs)`);
for (const data of ALL_BUILT) {
  if (!data) continue;
  console.log(`  ${data.pack.padEnd(20)}: ${data.count} icons (v${data.version})`);
}

/* --- manifest: version + count per external pack (no icon data) ------ */

const manifestPacks = {};
for (const data of ALL_BUILT) {
  if (!data) continue;
  manifestPacks[data.pack] = { version: data.version, count: data.count };
}
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({ packs: manifestPacks }, null, 2),
);
console.log(`wrote src/data/generated/manifest.json (${Object.keys(manifestPacks).length} packs)`);
