/**
 * Star Icons — plugin entry point.
 *
 * Wires the icon store, the applier, the Icon Manager view, commands,
 * menus, events, ribbon, status bar and settings tab together.
 */

import { Menu, Notice, Plugin, TAbstractFile, TFile, TFolder, setIcon } from "obsidian";
import { IconApplier, prettyIconName } from "./core/applier";
import { queryDataviewIcons } from "./core/dataview";
import { IconStore } from "./core/iconStore";
import { SoundscapeController } from "./core/soundscape";
import { brandIconId } from "./ui/components";
import { openColorModal } from "./ui/colorPicker";
import { confirmDialog, promptSize } from "./ui/promptModal";
import { ReportBugModal, obsidianVersion } from "./ui/reportBugModal";
import { ICON_MANAGER_VIEW_TYPE, IconManagerView } from "./ui/iconManager";
import { IconPickerModal } from "./ui/iconPicker";
import { GalaxyViewModal } from "./ui/galaxyView";
import { StarIconsSettingTab } from "./ui/settingsTab";
import { mergeSettings } from "./settings";
import { IconDef, StarIconsSettings } from "./types";
import { ALL_PACKS, DEFAULT_REPORT_URL } from "./types";
import { debounce, svgForClipboard } from "./utils";

export class StarIconsPlugin extends Plugin {
  settings!: StarIconsSettings;
  store!: IconStore;
  applier!: IconApplier;
  soundscape!: SoundscapeController;
  private statusBarEl: HTMLElement | null = null;
  /** Dataview collection id -> cached icon id list (rules read this). */
  private dataviewIcons: Record<string, string[]> = {};
  private dataviewRefreshTimer: number | null = null;
  /** Path -> last resolved icon id (transition-sound detection). */
  private lastIconByPath = new Map<string, string | null>();
  private lastTransitionAt = 0;
  private suppressTransitionNext = false;

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.store = new IconStore(
      this.app,
      () => this.manifest,
      () => this.settings,
      () => this.saveSettings(),
    );
    this.store.registerIcons();
    this.store.mountUserIcons();
    this.applier = new IconApplier(this, this.app);
    this.soundscape = new SoundscapeController(() => this.settings, this.app);
    // Load any custom sound files (no-op when none are configured).
    void this.soundscape.preloadCustom();

    this.registerView(ICON_MANAGER_VIEW_TYPE, (leaf) => new IconManagerView(leaf, this));

    this.ensureRibbonIcon();

    this.registerCommands();
    this.registerMenus();
    this.registerEvents();
    this.addSettingTab(new StarIconsSettingTab(this.app, this));

    if (this.settings.statusBarIndicator) this.initStatusBar();

    // Load pack metadata + enabled packs in the background — onload returns
    // immediately so Obsidian never waits on the icon data.
    void this.store
      .loadManifest()
      .then(() => this.store.loadEnabledPacks())
      .then(() => this.refreshIcons())
      .catch((err) => console.warn("[Star Icons] background pack load failed", err));

    // Warm the Dataview-backed collections (no-op when Dataview is absent).
    void this.refreshDataviewNow();

    this.app.workspace.onLayoutReady(() => this.refreshIcons());
  }

  onunload(): void {
    // Don't detach the manager's leaves: that would reset them to their
    // default location on the next load even if the user moved them.
    if (this.dataviewRefreshTimer !== null) {
      window.clearTimeout(this.dataviewRefreshTimer);
      this.dataviewRefreshTimer = null;
    }
    this.applier.dispose();
  }

  /* --- ribbon ------------------------------------------------------------- */

  private ribbonAdded = false;

  /**
   * Add the plugin icon to the ribbon, verifying the button actually got
   * attached to the DOM and retrying with built-in icons until one sticks.
   * (Obsidian can silently skip an icon if the ribbon isn't ready yet.)
   */
  private ensureRibbonIcon(): void {
    const tryAdd = (icon: string): boolean => {
      try {
        const el = this.addRibbonIcon(icon, "Star Icons — open the Icon Manager", () => {
          void this.openManager();
        });
        if (el && !el.isConnected) {
          // Obsidian didn't attach the button — drop it and try another icon.
          el.remove();
          return false;
        }
        this.ribbonAdded = true;
        return true;
      } catch {
        return false;
      }
    };

    const attempt = (): void => {
      if (this.ribbonAdded) return;
      const icons = [brandIconId(), "star", "sparkles", "settings"];
      for (const icon of icons) {
        if (tryAdd(icon)) return;
      }
    };

    attempt();

    // Retry once the workspace is fully laid out (and once shortly after),
    // in case the ribbon wasn't ready during onload.
    this.app.workspace.onLayoutReady(() => attempt());
    window.setTimeout(() => attempt(), 1500);
  }

  /* --- persistence ------------------------------------------------------- */

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /* --- actions ----------------------------------------------------------- */

  /** Re-apply icons to the explorer, tabs, titles and status bar. */
  refreshIcons(): void {
    this.applier.refreshAll();
    this.updateStatusBar();
    this.detectActiveIconTransition();
  }

  /**
   * Play the transition sound when the *active note's* icon changes on its
   * own (rules re-evaluated, vault events, dataview collections shifting).
   * Manual overrides set the icon through the picker (which already sounds),
   * so they set `suppressTransitionNext` to avoid a double blip.
   */
  private detectActiveIconTransition(): void {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const id = this.applier.resolve(file).iconId ?? null;
    const seen = this.lastIconByPath.has(file.path);
    const prev = this.lastIconByPath.get(file.path) ?? null;
    if (this.suppressTransitionNext) {
      this.suppressTransitionNext = false;
    } else if (seen && id !== null && id !== prev) {
      const now = Date.now();
      if (now - this.lastTransitionAt > 2000) {
        this.lastTransitionAt = now;
        this.soundscape?.transition();
      }
    }
    this.lastIconByPath.set(file.path, id);
  }

  /* --- Dataview-backed dynamic collections ------------------------------- */

  /** Cached icon lists for Dataview collections (read by the applier). */
  getDataviewResults(): Record<string, string[]> {
    return this.dataviewIcons;
  }

  hasDataviewCollections(): boolean {
    return this.settings.dataviewCollections.some((c) => c.query?.trim());
  }

  /**
   * Re-run every configured Dataview query and refresh the cache. Only
   * triggers a re-render when the results actually changed, so steady-state
   * resolution stays stable (and no refresh loop can form).
   */
  async refreshDataviewNow(): Promise<void> {
    const cols = this.settings.dataviewCollections.filter((c) => c.query?.trim());
    if (!cols.length) {
      if (Object.keys(this.dataviewIcons).length) {
        this.dataviewIcons = {};
        this.refreshIcons();
      }
      return;
    }
    const next: Record<string, string[]> = {};
    await Promise.all(
      cols.map(async (c) => {
        next[c.id] = await queryDataviewIcons(this.app, c.query, c.iconProperty || "icon");
      }),
    );
    if (JSON.stringify(next) !== JSON.stringify(this.dataviewIcons)) {
      this.dataviewIcons = next;
      this.refreshIcons();
    }
  }

  /** Debounced variant used by vault events (avoids query spam while typing). */
  private scheduleDataviewRefresh(): void {
    if (this.dataviewRefreshTimer !== null) return;
    this.dataviewRefreshTimer = window.setTimeout(() => {
      this.dataviewRefreshTimer = null;
      void this.refreshDataviewNow();
    }, 3000);
  }

  async openManager(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(ICON_MANAGER_VIEW_TYPE);
    if (existing.length > 0) {
      // revealLeaf (not setActiveLeaf): it also uncollapses the sidebar, so
      // the manager is visible even when the right sidebar was collapsed.
      await this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("Could not open the Icon Manager.");
      return;
    }
    await leaf.setViewState({ type: ICON_MANAGER_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  /** Open the 3D Icon Galaxy; star selections sync to the Manager. */
  openGalaxy(): void {
    new GalaxyViewModal(this.app, this.store, {
      onSelect: (iconId) => {
        for (const leaf of this.app.workspace.getLeavesOfType(ICON_MANAGER_VIEW_TYPE)) {
          const view = leaf.view as IconManagerView;
          if (typeof view.selectIcon === "function") view.selectIcon(iconId);
        }
      },
    }).open();
  }

  async setOverrideForActiveFile(iconId: string, color?: string | null): Promise<void> {
    const file = this.lastActiveFile();
    if (!file) {
      new Notice("No active file.");
      return;
    }
    this.settings.overrides[file.path] = iconId;
    if (color) this.settings.overrideColors[file.path] = color;
    else delete this.settings.overrideColors[file.path];
    this.suppressTransitionNext = true;
    await this.saveSettings();
    this.refreshIcons();
    new Notice(`Icon set for “${file.basename}”`);
  }

  /**
   * The file the user is actually working on. When triggered from the Icon
   * Manager (right sidebar) the manager itself is the active leaf, so
   * getActiveFile() returns null — fall back to the most recently opened file.
   */
  private lastActiveFile(): TFile | null {
    const active = this.app.workspace.getActiveFile();
    if (active) return active;
    for (const path of this.app.workspace.getLastOpenFiles()) {
      const file = this.app.vault.getFileByPath(path);
      if (file) return file;
    }
    return null;
  }

  /** Soundscape hooks for icon pickers (hover/pick sounds). */
  private pickerSound(): { hover: (icon: IconDef) => void; pick: (icon: IconDef) => void } {
    return {
      hover: (icon: IconDef) => this.soundscape?.hover(icon),
      pick: (icon: IconDef) => this.soundscape?.pick(icon),
    };
  }

  async pickIconFor(file: TAbstractFile): Promise<void> {
    const hasOverride = !!this.settings.overrides[file.path];
    new IconPickerModal(this.app, () => this.store, {
      title: `Icon for “${file.name}”`,
      allowNone: hasOverride,
      allowColor: true,
      color: this.settings.overrideColors[file.path] ?? null,
      sound: this.pickerSound(),
      onPick: (icon, color) => {
        if (icon) {
          this.settings.overrides[file.path] = icon.id;
          if (color) this.settings.overrideColors[file.path] = color;
          else delete this.settings.overrideColors[file.path];
        } else {
          delete this.settings.overrides[file.path];
          delete this.settings.overrideColors[file.path];
        }
        this.suppressTransitionNext = true;
        void this.saveSettings();
        this.refreshIcons();
      },
    }).open();
  }

  /** Change only the color of a file's icon override (palette modal). */
  async pickColorFor(file: TAbstractFile): Promise<void> {
    const result = await openColorModal(this.app, {
      title: `Icon color for “${file.name}”`,
      initial: this.settings.overrideColors[file.path] ?? null,
    });
    if (result === null) return; // cancelled
    if (result.color) this.settings.overrideColors[file.path] = result.color;
    else delete this.settings.overrideColors[file.path];
    await this.saveSettings();
    this.refreshIcons();
  }

  /** Color palette for the active note's override (Icon Manager detail). */
  async pickColorForActiveFile(): Promise<void> {
    const file = this.lastActiveFile();
    if (!file) {
      new Notice("No active file.");
      return;
    }
    await this.pickColorFor(file);
  }

  async copyIconName(file: TAbstractFile): Promise<void> {
    const res = this.applier.resolve(file);
    const id = res.iconId ?? "default";
    await navigator.clipboard.writeText(id);
    new Notice(`Copied ${id}`);
  }

  /* --- status bar -------------------------------------------------------- */

  private initStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("si-status");
    this.statusBarEl.setAttribute("aria-label", "Star Icons — click to open manager");
    this.statusBarEl.addEventListener("click", () => void this.openManager());
    this.updateStatusBar();
  }

  updateStatusBar(): void {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();
    const file = this.app.workspace.getActiveFile();
    if (file) {
      const res = this.applier.resolve(file);
      if (res.iconId) {
        const iconEl = this.statusBarEl.createSpan({ cls: "si-status-icon" });
        try {
          setIcon(iconEl, res.iconId);
        } catch {
          /* ignore */
        }
        iconEl.style.color = res.color ?? "";
        iconEl.querySelector("svg")?.setAttribute("width", "14");
        iconEl.querySelector("svg")?.setAttribute("height", "14");
        this.statusBarEl.createSpan({ cls: "si-status-text", text: res.detail });
        this.statusBarEl.title = `${prettyIconName(res.iconId)} — ${res.detail}`;
        return;
      }
    }
    const iconEl = this.statusBarEl.createSpan({ cls: "si-status-icon" });
    try {
      setIcon(iconEl, brandIconId());
    } catch {
      /* ignore */
    }
    iconEl.querySelector("svg")?.setAttribute("width", "14");
    iconEl.querySelector("svg")?.setAttribute("height", "14");
    this.statusBarEl.createSpan({ cls: "si-status-text", text: "Star Icons" });
  }

  /* --- registration ------------------------------------------------------ */

  private registerCommands(): void {
    this.addCommand({
      id: "open-manager",
      name: "Open the Icon Manager",
      callback: () => void this.openManager(),
    });

    this.addCommand({
      id: "open-galaxy-view",
      name: "Open Galaxy View (3D)",
      callback: () => this.openGalaxy(),
    });

    this.addCommand({
      id: "set-icon-active-file",
      name: "Set icon for the active file…",
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) void this.pickIconFor(file);
      },
    });

    this.addCommand({
      id: "remove-icon-active-file",
      name: "Remove icon from the active file",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return;
        delete this.settings.overrides[file.path];
        delete this.settings.overrideColors[file.path];
        await this.saveSettings();
        this.refreshIcons();
      },
    });

    this.addCommand({
      id: "copy-icon-name-active-file",
      name: "Copy the active file's icon name",
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) void this.copyIconName(file);
      },
    });

    this.addCommand({
      id: "pick-and-copy-icon",
      name: "Pick an icon and copy its name",
      callback: () => {
        new IconPickerModal(this.app, () => this.store, {
          title: "Copy an icon name",
          sound: this.pickerSound(),
          onPick: (icon) => {
            if (!icon) return;
            void navigator.clipboard.writeText(icon.id).then(() => {
              new Notice(`Copied ${icon.id}`);
            });
          },
        }).open();
      },
    });

    this.addCommand({
      id: "refresh-icons",
      name: "Refresh icons everywhere",
      callback: () => {
        this.refreshIcons();
        new Notice("Icons refreshed");
      },
    });

    this.addCommand({
      id: "insert-icon-at-cursor",
      name: "Insert an icon at the cursor",
      editorCallback: (editor) => {
        new IconPickerModal(this.app, () => this.store, {
          title: "Insert an icon",
          sound: this.pickerSound(),
          onPick: (icon) => {
            if (!icon) return;
            void promptSize(this.app, { title: `Insert “${icon.name}”` }).then((size) => {
              if (size) editor.replaceSelection(svgForClipboard(icon.svg, size));
            });
          },
        }).open();
      },
    });

    this.addCommand({
      id: "report-bug",
      name: "Report a bug…",
      callback: () => {
        new ReportBugModal(this.app, {
          pluginVersion: this.manifest.version,
          appVersion: obsidianVersion(this.app),
          packs: ALL_PACKS.length,
          enabledPacks: ALL_PACKS.filter((p) => this.settings.enabledPacks[p] !== false).length,
          icons: this.store.totalCount(),
          reportUrl: this.settings.reportUrl || DEFAULT_REPORT_URL,
        }).open();
      },
    });

    this.addCommand({
      id: "delete-all-user-tags",
      name: "Delete all user tags",
      callback: async () => {
        const ok = await confirmDialog(this.app, {
          title: "Delete all user tags?",
          message: "Every custom tag will be removed from all icons.",
          confirmLabel: "Delete all",
          danger: true,
        });
        if (ok) await this.store.clearAllUserTags();
      },
    });
  }

  private registerMenus(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        if (!(file instanceof TFile) && !(file instanceof TFolder)) return;
        menu.addSeparator();
        menu.addItem((item) =>
          item
            .setTitle("Set icon…")
            .setIcon(brandIconId())
            .onClick(() => void this.pickIconFor(file)),
        );
        menu.addItem((item) =>
          item
            .setTitle("Copy icon name")
            .setIcon("copy")
            .onClick(() => void this.copyIconName(file)),
        );
        menu.addItem((item) =>
          item
            .setTitle("Set icon color…")
            .setIcon("palette")
            .onClick(() => void this.pickColorFor(file)),
        );
        if (this.settings.overrides[file.path]) {
          menu.addItem((item) =>
            item
              .setTitle("Remove icon override")
              .setIcon("trash")
              .onClick(async () => {
                delete this.settings.overrides[file.path];
                delete this.settings.overrideColors[file.path];
                await this.saveSettings();
                this.refreshIcons();
              }),
          );
        }
        if (this.settings.overrideColors[file.path]) {
          menu.addItem((item) =>
            item
              .setTitle("Remove color override")
              .setIcon("undo")
              .onClick(async () => {
                delete this.settings.overrideColors[file.path];
                await this.saveSettings();
                this.refreshIcons();
              }),
          );
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return;
        menu.addItem((item) =>
          item
            .setTitle("Set icon for this note…")
            .setIcon(brandIconId())
            .onClick(() => void this.pickIconFor(file)),
        );
      }),
    );
  }

  private registerEvents(): void {
    const refresh = debounce(() => {
      this.refreshIcons();
      // Dataview queries inspect the vault — keep dynamic collections fresh,
      // but on their own (slower) schedule so typing never blocks rendering.
      if (this.hasDataviewCollections()) this.scheduleDataviewRefresh();
    }, 200);

    this.registerEvent(this.app.workspace.on("layout-change", refresh));
    this.registerEvent(this.app.workspace.on("file-open", refresh));
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
  }
}

// Obsidian's plugin loader instantiates the DEFAULT export of main.js.
export default StarIconsPlugin;
