/**
 * Star Icons — applies resolved icons to Obsidian UI surfaces:
 *   • File explorer (patching FileExplorerView.getIcon/getFolderIcon)
 *   • Tab headers (patching WorkspaceLeaf.prototype.updateHeaderIcon)
 *   • Note title (optional icon above the inline title)
 *   • Source tooltips (why this icon?)
 */

import {
  App,
  MarkdownView,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import type { StarIconsPlugin } from "../main";
import { getIcon } from "../data/icons";
import { Resolution } from "../types";
import { buildFileContext, resolveIcon } from "./ruleEngine";

type ExplorerLike = {
  fileItems?: Record<string, { file?: TAbstractFile; selfEl?: HTMLElement }>;
  getIcon?: (file: TFile) => string | undefined;
  getFolderIcon?: (folder: TFolder) => string | undefined;
  isIconVisible?: () => boolean;
};

export class IconApplier {
  private patchedViews = new Set<ExplorerLike>();
  private leafProtoPatched = false;
  private originalUpdateHeaderIcon: (() => unknown) | null = null;

  constructor(
    private plugin: StarIconsPlugin,
    private app: App,
  ) {}

  /* --- public ---------------------------------------------------------- */

  /** Re-apply icons everywhere. Cheap; safe to call often. */
  refreshAll(): void {
    if (this.plugin.settings.fileExplorerIcons) this.patchExplorers();
    else this.unpatchExplorers();

    if (this.plugin.settings.tabIcons) this.patchLeafPrototype();
    this.updateTabs();
    this.updateInlineTitle();
  }

  /** Remove every patch/injection (plugin unload). */
  dispose(): void {
    this.unpatchExplorers();
    if (this.originalUpdateHeaderIcon && this.leafProtoPatched) {
      (WorkspaceLeaf.prototype as unknown as Record<string, unknown>).updateHeaderIcon =
        this.originalUpdateHeaderIcon;
      this.leafProtoPatched = false;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      (leaf.view as MarkdownView).contentEl
        .querySelectorAll(".si-inline-icon")
        .forEach((el) => el.remove());
    }
    this.updateTabs();
  }

  /** Resolve the icon for a file/folder (used by menus & status bar too). */
  resolve(file: TAbstractFile | null | undefined): Resolution {
    if (!file) return { iconId: null, source: "none", detail: "No file" };
    const ctx = buildFileContext(file, this.app);
    return resolveIcon(this.plugin.settings, ctx, this.plugin.getDataviewResults());
  }

  /* --- file explorer ---------------------------------------------------- */

  private patchExplorers(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view as unknown as ExplorerLike;
      if (!view || this.patchedViews.has(view)) continue;
      this.patchedViews.add(view);

      const origGetIcon = view.getIcon;
      const origGetFolderIcon = view.getFolderIcon;
      const origIsIconVisible = view.isIconVisible;

      (view as unknown as Record<string, unknown>).__siOriginals = {
        getIcon: origGetIcon,
        getFolderIcon: origGetFolderIcon,
        isIconVisible: origIsIconVisible,
      };

      view.getIcon = (file: TFile) => {
        const res = this.resolve(file);
        return res.iconId ?? (origGetIcon ? origGetIcon(file) : undefined);
      };
      if (typeof view.getFolderIcon === "function") {
        view.getFolderIcon = (folder: TFolder) => {
          const res = this.resolve(folder);
          return res.iconId ?? (origGetFolderIcon ? origGetFolderIcon(folder) : undefined);
        };
      }
      view.isIconVisible = () => true;
      void origIsIconVisible;
    }
    this.refreshExplorerDom();
  }

  private unpatchExplorers(): void {
    for (const view of this.patchedViews) {
      if (!view) continue;
      // Restoring methods requires the saved originals; we stored them on the
      // view object itself so re-patching after re-enable is idempotent.
      const saved = (view as unknown as Record<string, unknown>).__siOriginals as
        | { getIcon?: unknown; getFolderIcon?: unknown; isIconVisible?: unknown }
        | undefined;
      if (saved) {
        if (saved.getIcon !== undefined) view.getIcon = saved.getIcon as ExplorerLike["getIcon"];
        if (saved.getFolderIcon !== undefined)
          view.getFolderIcon = saved.getFolderIcon as ExplorerLike["getFolderIcon"];
        if (saved.isIconVisible !== undefined)
          view.isIconVisible = saved.isIconVisible as ExplorerLike["isIconVisible"];
      }
    }
    this.patchedViews.clear();
  }

  /** Directly refresh the DOM icons so changes show instantly. */
  private refreshExplorerDom(): void {
    if (!this.plugin.settings.fileExplorerIcons) return;
    const showTooltips = this.plugin.settings.showSourceTooltips;
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view as unknown as ExplorerLike;
      const items = view.fileItems;
      if (!items) continue;
      for (const key of Object.keys(items)) {
        const item = items[key];
        const file = item?.file;
        if (!file) continue;
        const iconEl = item.selfEl?.querySelector(".tree-item-icon") as HTMLElement | undefined;
        if (!iconEl) continue;
        const res = this.resolve(file);
        if (res.iconId) {
          try {
            setIcon(iconEl, res.iconId);
          } catch {
            /* icon not registered (pack disabled) — leave default */
          }
        }
        IconApplier.applyResolutionColor(iconEl, res.iconId ? res.color : null);
        if (showTooltips && item.selfEl) {
          const label = res.iconId ? prettyIconName(res.iconId) : "Default icon";
          item.selfEl.title = `${label} — ${res.detail}`;
        } else if (item.selfEl) {
          item.selfEl.title = "";
        }
      }
    }
  }

  /* --- tabs -------------------------------------------------------------- */

  private patchLeafPrototype(): void {
    if (this.leafProtoPatched) return;
    const proto = WorkspaceLeaf.prototype as unknown as Record<string, unknown>;
    const updateHeaderIcon = proto.updateHeaderIcon as (() => unknown) | undefined;
    if (typeof updateHeaderIcon !== "function") return;

    this.leafProtoPatched = true;
    this.originalUpdateHeaderIcon = updateHeaderIcon;

    const plugin = this.plugin;
    proto.updateHeaderIcon = function (this: WorkspaceLeaf) {
      const result = updateHeaderIcon.call(this);
      try {
        IconApplier.applyToLeaf(plugin, this);
      } catch {
        /* never let icon injection break Obsidian */
      }
      return result;
    };
  }

  /**
   * Apply the resolved icon to a single tab header. Static so the patched
   * prototype method can call it without aliasing `this` (which would rebind
   * to the leaf inside the patched function).
   */
  private static applyToLeaf(plugin: StarIconsPlugin, leaf: WorkspaceLeaf): void {
    if (!plugin.settings.tabIcons) return;
    const view = leaf.view as { file?: TAbstractFile } | null;
    if (!view) return;
    const file = view.file;
    if (!(file instanceof TFile) && !(file instanceof TFolder)) return;
    const iconEl = (leaf as unknown as { tabHeaderInnerIconEl?: HTMLElement }).tabHeaderInnerIconEl;
    if (!iconEl) return;
    const res = plugin.applier.resolve(file);
    if (res.iconId) {
      try {
        setIcon(iconEl, res.iconId);
      } catch {
        /* ignore */
      }
      IconApplier.applyResolutionColor(iconEl, res.color);
      if (plugin.settings.showSourceTooltips) {
        iconEl.title = `${prettyIconName(res.iconId)} — ${res.detail}`;
      }
    } else {
      IconApplier.applyResolutionColor(iconEl, null);
    }
  }

  private updateTabs(): void {
    const workspace = this.app.workspace as unknown as {
      getLeaves?: () => WorkspaceLeaf[];
    };
    const leaves: WorkspaceLeaf[] =
      typeof workspace.getLeaves === "function"
        ? workspace.getLeaves()
        : this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      if (!this.plugin.settings.tabIcons) {
        // leave default icons alone
        continue;
      }
      IconApplier.applyToLeaf(this.plugin, leaf);
    }
  }

  /* --- inline title ------------------------------------------------------ */

  private updateInlineTitle(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;

    // Remove icons from all other markdown views.
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const other = leaf.view as MarkdownView;
      if (other !== view) {
        other.contentEl.querySelectorAll(".si-inline-icon").forEach((el) => el.remove());
      }
    }

    const titleEl = view.contentEl.querySelector<HTMLElement>(".inline-title");
    if (!titleEl) return;

    const inSource = view.getMode() === "source";
    const enabled = this.plugin.settings.inlineTitleIcons &&
      (!inSource || this.plugin.settings.inlineTitleEditMode);

    let iconEl = titleEl.querySelector<HTMLElement>(":scope > .si-inline-icon");
    if (!enabled) {
      iconEl?.remove();
      return;
    }
    const res = this.resolve(view.file);
    if (!res.iconId) {
      iconEl?.remove();
      return;
    }
    if (!iconEl) {
      iconEl = titleEl.createSpan({ cls: "si-inline-icon" });
      iconEl.setAttribute("contenteditable", "false");
      titleEl.prepend(iconEl);
    }
    try {
      setIcon(iconEl, res.iconId);
    } catch {
      /* ignore */
    }
    IconApplier.applyResolutionColor(iconEl, res.color);
    if (this.plugin.settings.showSourceTooltips) {
      iconEl.title = `${prettyIconName(res.iconId)} — ${res.detail}`;
    }
  }

  /**
   * Tint an icon container with the resolved color (or reset it to the theme
   * default). Icons use `currentColor`, so setting `color` on the container
   * recolors stroke/fill-based packs; full-color packs ignore it.
   */
  private static applyResolutionColor(el: HTMLElement, color?: string | null): void {
    el.style.color = color ?? "";
  }
}

/** "si-lucide-home" -> "lucide · home" */
export function prettyIconName(id: string): string {
  const def = getIcon(id);
  if (!def) return id;
  return `${def.pack} · ${def.name}`;
}
