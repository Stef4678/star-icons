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
/* Material Symbols (curated subset, rounded weight)                   */
/* ------------------------------------------------------------------ */

const MATERIAL_SUBSET = [
  "account_balance", "account_balance_wallet", "account_circle", "add", "alarm",
  "apps", "archive", "article", "attach_file", "attach_money", "autorenew",
  "badge", "bar_chart", "beach_access", "biotech", "bolt", "book", "bookmark",
  "bookmark_added", "border_color", "brush", "business_center", "cached",
  "cake", "calendar_month", "call", "call_made", "call_received", "call_split",
  "camera_outdoor", "celebration", "chat", "check", "checklist", "close", "cloud",
  "cloud_done", "cloud_download", "cloud_upload", "code", "collections_bookmark",
  "commute", "compare_arrows", "computer", "credit_card",
  "currency_exchange", "dashboard", "data_object", "database",
  "date_range", "delete", "description", "devices", "directions_car",
  "download", "drafts", "eco", "edit", "edit_off", "emoji_nature",
  "engineering", "enhanced_encryption", "error", "event",
  "fact_check", "face", "fast_forward", "fast_rewind", "favorite",
  "filter_list", "find_in_page", "fingerprint", "flag",
  "flight", "folder", "folder_open", "folder_shared", "format_align_center",
  "format_align_justify", "format_align_left", "format_align_right",
  "format_bold", "format_italic", "format_list_bulleted", "format_list_numbered",
  "format_paint", "format_quote", "format_strikethrough", "format_underlined",
  "forum", "gamepad", "grid_view", "group", "groups", "headphones",
  "help", "highlight", "history", "hourglass_empty", "image", "import_contacts",
  "inbox", "info", "inventory_2", "key",
  "label", "laptop_mac", "leaderboard", "library_books", "library_music", "lightbulb",
  "link", "list", "local_cafe", "local_mall", "lock", "lock_open",
  "mail", "manage_search", "mark_email_read", "medical_services",
  "menu", "menu_book", "monitoring", "mood", "mood_bad", "more_vert",
  "move_to_inbox", "movie", "music_note", "note_add", "notifications", "outbox",
  "palette", "park", "pause", "payments", "person", "person_add",
  "pets", "photo", "photo_camera", "photo_library", "pie_chart", "play_arrow",
  "playlist_play", "price_change", "psychology", "qr_code", "query_stats",
  "receipt_long", "redo", "refresh", "replay", "restaurant", "rocket_launch",
  "rule", "save", "savings", "schedule", "school", "science", "search",
  "search_off", "security", "sell", "send", "sentiment_satisfied",
  "sentiment_very_dissatisfied", "sentiment_very_satisfied", "settings",
  "share", "shield", "shopping_bag", "shopping_basket", "shopping_cart",
  "show_chart", "skip_next", "skip_previous", "sms", "sort",
  "speaker", "sports_esports", "star", "star_half",
  "sticky_note_2", "stop", "storage", "storefront", "swap_horiz", "swap_vert",
  "sync", "table_chart", "tablet", "tag", "task_alt", "terminal", "text_fields",
  "theaters", "thumb_down", "thumb_up", "timer", "today",
  "train", "trending_down", "trending_up", "tune", "unarchive", "undo",
  "update", "upload", "verified_user", "video_library", "videocam",
  "view_column", "view_list", "view_module", "visibility", "volume_up",
  "vpn_key", "wallet", "warning", "watch", "widgets", "work",
];

function buildMaterial() {
  const dir =
    probe("@material-symbols/svg-400", "rounded", "outlined", "sharp") ??
    probe("@material-symbols/svg-400", "rounded/400", "outlined/400", "sharp/400");
  if (!dir) {
    console.warn("[material] directory not found — skipping");
    return null;
  }
  const icons = [];
  const missing = [];
  for (const name of MATERIAL_SUBSET) {
    const file = join(dir, `${name}.svg`);
    if (!existsSync(file)) {
      missing.push(name);
      continue;
    }
    const parsed = parseSvg(file);
    if (!parsed) continue;
    icons.push({ name, svg: parsed.inner, viewBox: parsed.viewBox, tags: [] });
  }
  if (missing.length) console.warn(`[material] missing ${missing.length}: ${missing.join(", ")}`);

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
      if (!f.endsWith("-line.svg")) continue;
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
  // Balanced curation: caps per group, no skin-tone variants, no flags.
  const GROUPS = [
    ["smileys-emotion", 90],
    ["animals-nature", 90],
    ["food-drink", 80],
    ["travel-places", 80],
    ["activities", 50],
    ["objects", 120],
    ["symbols", 90],
  ];
  const usedNames = new Set();
  const icons = [];
  for (const [group, cap] of GROUPS) {
    let taken = 0;
    for (const entry of data) {
      if (entry.group !== group) continue;
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
      taken++;
      if (taken >= cap) break;
    }
  }
  return {
    pack: "openmoji",
    version: pkgVersion("openmoji"),
    count: icons.length,
    icons,
  };
}

/* ------------------------------------------------------------------ */

const lucide = buildLucide();
const material = buildMaterial();
const tabler = buildTabler();
const unicons = buildUnicons();
const remix = buildRemix();
const phosphor = buildPhosphor();
const bootstrap = buildBootstrap();
const boxicons = buildBoxicons();
const heroicons = buildHeroicons();
const openmoji = buildOpenMoji();

for (const data of [lucide, material, tabler, unicons, remix, phosphor, bootstrap, boxicons, heroicons, openmoji]) {
  if (!data) continue;
  const file = join(outDir, `${data.pack}.json`);
  writeFileSync(file, JSON.stringify(data));
  console.log(`wrote ${file} (${Math.round(JSON.stringify(data).length / 1024)} KB, ${data.count} icons)`);
}

console.log("Star Icons — icon data generation complete");
console.log(`  lucide   : ${lucide ? lucide.count + " icons (v" + lucide.version + ")" : "SKIPPED"}`);
console.log(`  material : ${material ? material.count + " icons (v" + material.version + ")" : "SKIPPED"}`);
console.log(`  tabler   : ${tabler ? tabler.count + " icons (v" + tabler.version + ")" : "SKIPPED"}`);
console.log(`  unicons  : ${unicons ? unicons.count + " icons (v" + unicons.version + ")" : "SKIPPED"}`);
console.log(`  remix    : ${remix ? remix.count + " icons (v" + remix.version + ")" : "SKIPPED"}`);
console.log(`  phosphor : ${phosphor ? phosphor.count + " icons (v" + phosphor.version + ")" : "SKIPPED"}`);
console.log(`  bootstrap: ${bootstrap ? bootstrap.count + " icons (v" + bootstrap.version + ")" : "SKIPPED"}`);
console.log(`  boxicons : ${boxicons ? boxicons.count + " icons (v" + boxicons.version + ")" : "SKIPPED"}`);
console.log(`  heroicons: ${heroicons ? heroicons.count + " icons (v" + heroicons.version + ")" : "SKIPPED"}`);
console.log(`  openmoji : ${openmoji ? openmoji.count + " colored icons (v" + openmoji.version + ")" : "SKIPPED"}`);

/* --- manifest: version + count per external pack (no icon data) ------ */

const manifestPacks = {};
for (const data of [lucide, material, tabler, unicons, remix, phosphor, bootstrap, boxicons, heroicons, openmoji]) {
  if (!data) continue;
  manifestPacks[data.pack] = { version: data.version, count: data.count };
}
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({ packs: manifestPacks }, null, 2),
);
console.log(`wrote src/data/generated/manifest.json (${Object.keys(manifestPacks).length} packs)`);
