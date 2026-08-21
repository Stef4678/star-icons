import esbuild from "esbuild";
import process from "process";
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Static banner (no timestamp) so builds are reproducible — the released
// main.js must be bit-identical to a fresh build from source.
const banner = `/*
Star Icons for Obsidian — built from source
MIT License
*/`;

const prod = process.argv[2] === "production";

/**
 * Copy the generated pack data (JSON) into the plugin's packs/ directory.
 * Packs are loaded at runtime on demand — they are NOT bundled into main.js,
 * keeping the initial parse cost flat no matter how many packs we ship.
 */
function copyPacks() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.join(root, "src", "data", "generated");
  const outDir = path.join(root, "packs");
  if (!existsSync(srcDir)) {
    console.warn("  [packs] no generated data found — run `npm run build:icons` first");
    return;
  }
  mkdirSync(outDir, { recursive: true });
  let copied = 0;
  for (const f of readdirSync(srcDir)) {
    if (f.endsWith(".json")) {
      cpSync(path.join(srcDir, f), path.join(outDir, f));
      copied++;
    }
  }
  console.log(`  [packs] copied ${copied} pack data files -> packs/`);
}

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  minify: prod,
  treeShaking: true,
  outfile: "main.js",
});

copyPacks();

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
