/**
 * Star Icons — plugin entry point.
 *
 * Wires the icon store, the applier, the Icon Manager view, commands,
 * menus, events, ribbon, status bar and settings tab together.
 */

import { Menu, Notice, Plugin, TAbstractFile, TFile, TFolder, setIcon } from "obsidian";
import { IconApplier, prettyIconName } from "./core/applier";
import { IconStore } from "./core/iconStore";
import { brandIconId } from "./ui/components";
import { confirmDialog } from "./ui/promptModal";
import { ICON_MANAGER_VIEW_TYPE, IconManagerView } from "./ui/iconManager";
import { IconPickerModal } from "./ui/iconPicker";
import { StarIconsSettingTab } from "./ui/settingsTab";
import { mergeSettings } from "./settings";
import { StarIconsSettings } from "./types";
import { debounce } from "./utils";

export class StarIconsPlugin extends Plugin {
  settings!: StarIconsSettings;
  store!: IconStore;
  applier!: IconApplier;
  private statusBarEl: HTMLElement | null = null;

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

    this.app.workspace.onLayoutReady(() => this.refreshIcons());
  }

  onunload(): void {
    this.applier.dispose();
    this.app.workspace.detachLeavesOfType(ICON_MANAGER_VIEW_TYPE);
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
    setTimeout(() => attempt(), 1500);
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
  }

  async openManager(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(ICON_MANAGER_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("Could not open the Icon Manager.");
      return;
    }
    await leaf.setViewState({ type: ICON_MANAGER_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async setOverrideForActiveFile(iconId: string): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active file.");
      return;
    }
    this.settings.overrides[file.path] = iconId;
    await this.saveSettings();
    this.refreshIcons();
    new Notice(`Icon set for “${file.basename}”`);
  }

  async pickIconFor(file: TAbstractFile): Promise<void> {
    const hasOverride = !!this.settings.overrides[file.path];
    new IconPickerModal(this.app, () => this.store, {
      title: `Icon for “${file.name}”`,
      allowNone: hasOverride,
      onPick: async (icon) => {
        if (icon) this.settings.overrides[file.path] = icon.id;
        else delete this.settings.overrides[file.path];
        await this.saveSettings();
        this.refreshIcons();
      },
    }).open();
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
          onPick: async (icon) => {
            if (!icon) return;
            await navigator.clipboard.writeText(icon.id);
            new Notice(`Copied ${icon.id}`);
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
        if (this.settings.overrides[file.path]) {
          menu.addItem((item) =>
            item
              .setTitle("Remove icon override")
              .setIcon("trash")
              .onClick(async () => {
                delete this.settings.overrides[file.path];
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
    const refresh = debounce(() => this.refreshIcons(), 200);

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
