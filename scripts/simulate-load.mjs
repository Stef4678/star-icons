/**
 * Simulates Obsidian loading the built plugin (main.js) with stub APIs,
 * to surface load-time errors before the user's vault does.
 * Usage: node scripts/simulate-load.mjs
 */

import Module from "node:module";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* --- minimal DOM element shim (Obsidian's HTMLElement extensions) ------ */
function el() {
  const node = {
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      },
    },
    style: {},
    dataset: {},
    attributes: {},
    textContent: "",
    innerHTML: "",
    title: "",
    setAttribute(k, v) {
      this.attributes[k] = v;
    },
    getAttribute(k) {
      return this.attributes[k] ?? null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    addEventListener() {},
    removeEventListener() {},
    remove() {},
    empty() {},
    // Obsidian DOM helpers
    addClass() {},
    removeClass() {},
    toggleClass() {},
    setText(t) {
      this.textContent = t;
    },
    createEl(_tag, opts = {}) {
      const c = el();
      if (opts.text !== undefined) c.textContent = opts.text;
      if (opts.cls) c.className = opts.cls;
      if (opts.attr) for (const [k, v] of Object.entries(opts.attr)) c.setAttribute(k, v);
      this.appendChild(c);
      return c;
    },
    createDiv(opts = {}) {
      return this.createEl("div", opts);
    },
    createSpan(opts = {}) {
      return this.createEl("span", opts);
    },
    setAttr() {},
  };
  return node;
}

/* --- obsidian module stubs --------------------------------------------- */
class StubTAbstractFile {
  constructor(name, path, parent) {
    this.name = name;
    this.path = path;
    this.parent = parent ?? null;
  }
}
class StubTFile extends StubTAbstractFile {}
class StubTFolder extends StubTAbstractFile {}

const obsidianStubs = {
  App: class {},
  Plugin: class {
    constructor(app, manifest) {
      this.app = app;
      this.manifest = manifest;
    }
    async loadData() {
      return null;
    }
    async saveData() {
      return null;
    }
    addRibbonIcon() {
      return el();
    }
    addCommand() {}
    registerView() {}
    addSettingTab() {}
    addStatusBarItem() {
      return el();
    }
    registerEvent() {}
  },
  WorkspaceLeaf: class {},
  MarkdownView: class {},
  TAbstractFile: StubTAbstractFile,
  TFile: StubTFile,
  TFolder: StubTFolder,
  Menu: class {},
  Notice: class {},
  Modal: class {},
  ItemView: class {},
  PluginSettingTab: class {},
  Setting: class {},
  Platform: class {},
  addIcon() {},
  setIcon() {},
  getIcon() {
    return null;
  },
  normalizePath: (p) => p,
};

/* --- fake app with realistic fixtures ----------------------------------- */
const eventRef = { unref() {} };

const fakeFile = new obsidianStubs.TFile("note.md", "note.md", null);
fakeFile.extension = "md";
fakeFile.basename = "note";

const explorerView = {
  fileItems: {
    "note.md": { file: fakeFile, selfEl: el() },
  },
  getIcon: () => "file",
  getFolderIcon: () => "folder",
  isIconVisible: () => true,
};
const explorerLeaf = { view: explorerView };

const markdownView = {
  file: fakeFile,
  contentEl: el(),
  getMode: () => "preview",
};
const markdownLeaf = {
  view: markdownView,
  tabHeaderInnerIconEl: el(),
};

const fakeApp = {
  workspace: {
    on: () => eventRef,
    getLeavesOfType: (type) => (type === "file-explorer" ? [explorerLeaf] : type === "markdown" ? [markdownLeaf] : []),
    getLeaves: () => [explorerLeaf, markdownLeaf],
    getActiveViewOfType: () => markdownView,
    getActiveFile: () => fakeFile,
    getRightLeaf: () => null,
    revealLeaf: () => {},
    detachLeavesOfType: () => {},
    onLayoutReady: (cb) => cb(),
  },
  vault: {
    on: () => eventRef,
    getFiles: () => [fakeFile],
    configDir: ".obsidian",
    // Reads the real packs/ directory shipped next to main.js.
    adapter: {
      read: async (p) => {
        const rel = String(p).replace(/\\/g, "/").replace(/^\.obsidian\/plugins\/star-icons\//, "");
        const file = path.join(root, rel);
        return readFileSync(file, "utf8");
      },
    },
  },
  metadataCache: {
    on: () => eventRef,
    getFileCache: () => null,
  },
};

/* --- globals Obsidian provides (browser context) ------------------------- */
// main.js runs inside Obsidian's renderer, so it may touch `window`/`document`
// (ribbon icons, Galaxy View's requestAnimationFrame, focus timers). Node has
// neither, so the simulation would die with "window is not defined" before it
// could check anything about the plugin. These are the minimum globals needed
// to reach the assertions below.
globalThis.document = {
  createElement: () => el(),
  createElementNS: () => el(),
  body: el(),
  head: el(),
  documentElement: { style: {} },
  querySelector: () => null,
  addEventListener() {},
};
globalThis.window = globalThis;
window.requestAnimationFrame = () => 0;
window.cancelAnimationFrame = () => {};
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
window.devicePixelRatio = 1;
window.WebGLRenderingContext = function WebGLRenderingContext() {};

/* --- intercept require("obsidian") --------------------------------------- */
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return obsidianStubs;
  return originalLoad.apply(this, arguments);
};

try {
  const require = createRequire(import.meta.url);
  const mod = require(path.join(root, "main.js"));
  // Obsidian's loader instantiates the DEFAULT export of main.js.
  const StarIconsPlugin = mod.default ?? mod.StarIconsPlugin;
  if (typeof StarIconsPlugin !== "function") {
    console.error(
      `FAIL: main.js default export is not a constructor (got ${typeof StarIconsPlugin}) — Obsidian would throw "h is not a constructor"`,
    );
    process.exit(1);
  }
  const manifest = JSON.parse(
    (await import("node:fs")).readFileSync(path.join(root, "manifest.json"), "utf8"),
  );
  const plugin = new StarIconsPlugin(fakeApp, manifest);
  await plugin.onload();
  console.log("OK: plugin onload() completed without throwing");

  // The plugin loads packs in the background; wait for them so the
  // resolution assertions below exercise the real mounted registry.
  await plugin.store.loadManifest();
  await plugin.store.loadEnabledPacks();
  const mounted = plugin.store.isPackLoaded("lucide") && plugin.store.isPackLoaded("openmoji");
  if (!mounted) {
    console.error("FAIL: expected packs to be loaded from packs/ directory");
    process.exit(1);
  }
  console.log(
    `OK: packs loaded on demand (${plugin.store.totalCount().toLocaleString()} icons available)`,
  );

  // The pack inventory is optional at runtime: a community install only receives
  // main.js, manifest.json and styles.css, so packs/manifest.json exists only
  // after the CDN fetch succeeds — and never exists if that fetch fails or the
  // packs/ folder is cleared. Versions and counts must still be right; they used
  // to render as "v?" and "0 icons" for every external pack. (requestUrl is not
  // stubbed here, so a failed local read cannot silently fall back to the CDN.)
  const generated = JSON.parse(
    readFileSync(path.join(root, "src", "data", "generated", "manifest.json"), "utf8"),
  ).packs;
  const beforeVersion = plugin.store.getPackVersion("solar");
  const beforeCount = plugin.store.getPackCount("solar");
  if (beforeVersion !== generated.solar.version || beforeCount !== generated.solar.count) {
    console.error(
      `FAIL: bundled pack metadata not used before packs/manifest.json loads (got ${beforeVersion}/${beforeCount}, expected ${generated.solar.version}/${generated.solar.count})`,
    );
    process.exit(1);
  }
  const realRead = fakeApp.vault.adapter.read;
  fakeApp.vault.adapter.read = async (p) => {
    if (String(p).endsWith("manifest.json")) throw new Error("simulated: pack manifest missing");
    return realRead(p);
  };
  await plugin.store.loadManifest();
  const afterVersion = plugin.store.getPackVersion("solar");
  const afterCount = plugin.store.getPackCount("solar");
  const afterTotal = plugin.store.totalCount();
  fakeApp.vault.adapter.read = realRead;
  if (afterVersion !== generated.solar.version || afterCount !== generated.solar.count) {
    console.error(
      `FAIL: pack metadata lost when packs/manifest.json is unreadable (got ${afterVersion}/${afterCount})`,
    );
    process.exit(1);
  }
  if (afterTotal !== 26932) {
    console.error(
      `FAIL: icon total collapsed when packs/manifest.json is unreadable (got ${afterTotal}, expected 26932)`,
    );
    process.exit(1);
  }
  console.log(
    `OK: pack metadata survives a missing packs/manifest.json (solar ${afterVersion}, ${afterCount.toLocaleString()} icons, ${afterTotal.toLocaleString()} total)`,
  );

  // Opt-in path: enabling a new pack in settings loads it on the spot.
  plugin.settings.enabledPacks["twemoji"] = true;
  await plugin.store.loadPack("twemoji");
  if (!plugin.store.isPackLoaded("twemoji")) {
    console.error("FAIL: opt-in pack (twemoji) did not load on demand");
    process.exit(1);
  }
  console.log(`OK: opt-in pack loads on demand (now ${plugin.store.totalCount().toLocaleString()} icons)`);

  // Iconify-sourced pack: loads from packs/, mounts and resolves by id.
  plugin.settings.enabledPacks["mdi"] = true;
  await plugin.store.loadPack("mdi");
  const mdiCount = plugin.store.search("", "mdi", 5).length;
  const mdiTotal = plugin.store.totalCount();
  if (!plugin.store.isPackLoaded("mdi") || mdiCount === 0) {
    console.error("FAIL: Iconify pack (mdi) did not load/mount on demand");
    process.exit(1);
  }
  if (mdiTotal !== 26932 + 4009 + 7638) {
    console.error(
      `FAIL: mdi did not add its icons to the total (got ${mdiTotal}, expected ${26932 + 4009 + 7638})`,
    );
    process.exit(1);
  }
  const mdiHome = plugin.store.search("home", "mdi", 5)[0];
  if (!mdiHome || !mdiHome.svg.startsWith("<svg ") || !mdiHome.id.startsWith("si-mdi-")) {
    console.error(`FAIL: mdi icons are not registered as expected (${mdiHome?.id})`);
    process.exit(1);
  }
  console.log(
    `OK: Iconify pack loads on demand (mdi: ${mdiTotal.toLocaleString()} icons total, e.g. ${mdiHome.id})`,
  );

  // A second-batch pack, with a non-24×24 viewBox (Solar is 24×24 but ships
  // six style suffixes; Pepicons is 20×20, Logos up to 256×256).
  plugin.settings.enabledPacks["solar"] = true;
  await plugin.store.loadPack("solar");
  const solarTotal = plugin.store.totalCount();
  if (!plugin.store.isPackLoaded("solar") || solarTotal !== mdiTotal + 8425) {
    console.error(
      `FAIL: second-batch pack (solar) did not load/mount (got ${solarTotal}, expected ${mdiTotal + 8425})`,
    );
    process.exit(1);
  }
  const solarHome = plugin.store.search("home", "solar", 200).find((i) => i.name === "home-2-bold");
  if (!solarHome || !solarHome.svg.includes('viewBox="0 0 24 24"')) {
    console.error(`FAIL: solar icons are not registered as expected (${solarHome?.id})`);
    process.exit(1);
  }
  plugin.settings.enabledPacks["pepicons-pop"] = true;
  await plugin.store.loadPack("pepicons-pop");
  const pep = plugin.store.search("house", "pepicons-pop", 200).find((i) => i.name === "house");
  if (!pep || !pep.svg.includes('viewBox="0 0 20 20"')) {
    console.error(`FAIL: pepicons-pop icons lost their 20x20 viewBox (${pep?.id})`);
    process.exit(1);
  }
  console.log(
    `OK: second-batch pack loads on demand (solar: ${solarHome.id}, pepicons: ${pep.id})`,
  );
  plugin.settings.enabledPacks["solar"] = false;
  plugin.settings.enabledPacks["pepicons-pop"] = false;
  plugin.settings.enabledPacks["mdi"] = false;
  plugin.settings.enabledPacks["twemoji"] = false;
  const afterDisable = plugin.store.totalCount();
  if (afterDisable !== 26932) {
    console.error(`FAIL: disabling a pack did not update the total (got ${afterDisable}, expected 26932)`);
    process.exit(1);
  }
  console.log("OK: disabling a pack updates the total count");

  // User icons: add -> mounted -> remove -> unmounted.
  const added = await plugin.store.addUserIcons([{ name: "my-logo", svg: "<svg viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\"/></svg>" }]);
  if (added !== 1 || !plugin.store.isPackLoaded("user")) {
    console.error("FAIL: user icon was not added/mounted");
    process.exit(1);
  }
  await plugin.store.removeUserIcon("si-user-my-logo");
  if (plugin.store.isPackLoaded("user")) {
    console.error("FAIL: user icon was not removed");
    process.exit(1);
  }
  console.log("OK: user icons add/remove cycle works");

  // Exercise the icon application paths with realistic fixtures.
  plugin.settings.overrides["note.md"] = "si-lucide-home";
  plugin.refreshIcons();
  console.log("OK: refreshIcons() with explorer + tab fixtures completed");
  const resolved = explorerView.getIcon(fakeFile);
  if (resolved !== "si-lucide-home") {
    console.error(`FAIL: explorer getIcon did not resolve override (got ${resolved})`);
    process.exit(1);
  }
  console.log("OK: file explorer getIcon resolves overrides");
  if (explorerView.isIconVisible() !== true) {
    console.error("FAIL: isIconVisible not forced");
    process.exit(1);
  }
  console.log("OK: isIconVisible forced true");
  plugin.onunload();
  console.log("OK: plugin onunload() completed without throwing");
} catch (err) {
  console.error("FAIL: load error ->", err && err.stack ? err.stack : err);
  process.exit(1);
}
