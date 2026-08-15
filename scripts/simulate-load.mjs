/**
 * Simulates Obsidian loading the built plugin (main.js) with stub APIs,
 * to surface load-time errors before the user's vault does.
 * Usage: node scripts/simulate-load.mjs
 */

import Module from "node:module";
import path from "node:path";
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
  },
  metadataCache: {
    on: () => eventRef,
    getFileCache: () => null,
  },
};

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
