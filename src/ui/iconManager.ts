/**
 * Star Icons — the Icon Manager view.
 *
 * The central hub: browse the full bundled library, filter by pack/tag,
 * manage collections (drag icons into them, reorder, rename, delete),
 * curate favorites and user tags, and apply icons to the active note.
 */

import { ItemView, Menu, Notice, setIcon, WorkspaceLeaf } from "obsidian";
import type { StarIconsPlugin } from "../main";
import { getIcon } from "../data/icons";
import { ALL_PACKS, Collection, IconDef, PackId, PACK_LABELS } from "../types";
import { emptyState, iconTile, makeSortable, renderIcon, segmentedControl } from "./components";
import { IconPickerModal } from "./iconPicker";

export const ICON_MANAGER_VIEW_TYPE = "star-icons-manager";

interface FilterState {
  pack: PackId | "all";
  tag: string | null;
  query: string;
}

export class IconManagerView extends ItemView {
  private filter: FilterState = { pack: "all", tag: null, query: "" };
  private selectedCollection: Collection | null = null;
  private selectedId: string | null = null;
  private unsub?: () => void;
  private resizeObserver?: ResizeObserver;

  private headerTitleEl!: HTMLElement;
  private searchEl!: HTMLInputElement;
  private packChipsEl!: HTMLElement;
  private sideEl!: HTMLElement;
  private mainEl!: HTMLElement;
  private detailEl!: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: StarIconsPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ICON_MANAGER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Star Icons";
  }

  getIcon(): string {
    return "si-star-sparkle";
  }

  async onOpen(): Promise<void> {
    this.buildDom();
    this.unsub = this.plugin.store.subscribe(() => this.render());
    this.render();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.contentEl);
    this.handleResize();
  }

  async onClose(): Promise<void> {
    this.unsub?.();
    this.resizeObserver?.disconnect();
    this.contentEl.empty();
  }

  /**
   * Tracks the manager's actual width and collapses chrome when the pane is
   * too narrow (the icon grid must never be squeezed out of existence).
   */
  private handleResize(): void {
    const width = this.contentEl.clientWidth;
    this.contentEl.toggleClass("is-narrow", width > 0 && width < 720);
  }

  /** Close the sidebar overlay on narrow panes after making a selection. */
  private closeSideIfNarrow(): void {
    if (this.contentEl.hasClass("is-narrow")) this.contentEl.removeClass("si-side-open");
  }

  /* --- DOM scaffold ------------------------------------------------------ */

  private buildDom(): void {
    const root = this.contentEl;
    root.addClass("si-manager");
    root.empty();

    const header = root.createDiv({ cls: "si-manager-header" });
    const titleWrap = header.createDiv({ cls: "si-manager-title" });
    const brand = titleWrap.createSpan({ cls: "si-manager-brand" });
    renderIcon(brand, "si-star-sparkle", 22);
    titleWrap.createSpan({ cls: "si-manager-name", text: "Star Icons" });
    this.headerTitleEl = titleWrap.createSpan({ cls: "si-manager-sub" });

    const searchWrap = header.createDiv({ cls: "si-search si-manager-search" });
    const searchIcon = searchWrap.createSpan({ cls: "si-search-icon" });
    renderIcon(searchIcon, "search");
    this.searchEl = searchWrap.createEl("input", {
      cls: "si-search-input",
      attr: { placeholder: "Search icons…", spellcheck: "false" },
    }) as HTMLInputElement;
    this.searchEl.addEventListener("input", () => {
      this.filter.query = this.searchEl.value;
      this.renderMain();
    });

    const toolbar = header.createDiv({ cls: "si-manager-toolbar" });
    this.packChipsEl = toolbar.createDiv({ cls: "si-chips" });
    const toolbarRight = toolbar.createDiv({ cls: "si-manager-toolbar-right" });
    const sideToggle = toolbarRight.createEl("button", {
      cls: "si-btn si-btn-small si-side-toggle",
      attr: { type: "button", "aria-label": "Toggle collections panel" },
    });
    renderIcon(sideToggle, "panel-left");
    sideToggle.addEventListener("click", () => {
      this.contentEl.classList.toggle("si-side-open");
    });
    const density = toolbarRight.createDiv({ cls: "si-manager-density" });
    density.appendChild(
      segmentedControl(
        [
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ],
        this.plugin.settings.iconGridDensity,
        (v) => {
          this.plugin.settings.iconGridDensity = v as "comfortable" | "compact";
          void this.plugin.saveSettings();
          this.renderMain();
        },
      ),
    );

    const body = root.createDiv({ cls: "si-manager-body" });
    this.sideEl = body.createDiv({ cls: "si-manager-side" });
    this.mainEl = body.createDiv({ cls: "si-manager-main" });
    this.detailEl = body.createDiv({ cls: "si-manager-detail" });
  }

  /* --- rendering ---------------------------------------------------------- */

  private render(): void {
    this.renderHeader();
    this.renderSidebar();
    this.renderMain();
    this.renderDetail();
  }

  private renderHeader(): void {
    const store = this.plugin.store;
    const total = store.totalCount();
    this.headerTitleEl.setText(`${total.toLocaleString()} icons · ${ALL_PACKS.length} packs · offline`);

    this.packChipsEl.empty();
    const chips: { value: string; label: string }[] = [
      { value: "all", label: `All (${total.toLocaleString()})` },
      ...ALL_PACKS.map((p) => ({ value: p, label: `${PACK_LABELS[p]} (${store.getPackCount(p).toLocaleString()})` })),
    ];
    for (const chip of chips) {
      const btn = this.packChipsEl.createEl("button", {
        cls: "si-chip" + (this.filter.pack === chip.value ? " is-active" : ""),
        attr: { type: "button" },
      });
      btn.createSpan({ text: chip.label });
      btn.addEventListener("click", () => {
        this.filter.pack = chip.value as PackId | "all";
        this.render();
      });
    }
  }

  private renderSidebar(): void {
    const side = this.sideEl;
    side.empty();
    const store = this.plugin.store;

    /* --- collections --- */
    const colSection = side.createDiv({ cls: "si-side-section" });
    const colHead = colSection.createDiv({ cls: "si-side-head" });
    colHead.createSpan({ cls: "si-side-title", text: "Collections" });
    const addCol = colHead.createEl("button", {
      cls: "si-icon-btn",
      attr: { type: "button", "aria-label": "New collection" },
    });
    setIcon(addCol, "plus");
    addCol.addEventListener("click", async () => {
      const name = await this.promptText("Collection name", "My icons");
      if (!name) return;
      const col = await store.createCollection(name);
      this.selectedCollection = col;
      this.filter = { ...this.filter, tag: null };
      this.closeSideIfNarrow();
      this.render();
    });
    colSection.appendChild(colHead);

    const colList = colSection.createDiv({ cls: "si-side-list" });
    if (this.plugin.settings.collections.length === 0) {
      colList.appendChild(emptyState("No collections yet", "Drag icons here or use +"));
    }
    for (const col of store.getSettings().collections) {
      const item = colList.createDiv({
        cls: "si-side-item" + (this.selectedCollection?.id === col.id ? " is-active" : ""),
        attr: { draggable: "false" },
      });
      const icon = item.createSpan({ cls: "si-side-item-icon" });
      renderIcon(icon, col.iconIds[0] ?? "si-lucide-folder");
      item.createSpan({ cls: "si-side-item-label", text: col.name });
      item.createSpan({ cls: "si-side-item-count", text: String(col.iconIds.length) });
      item.addEventListener("click", () => {
        this.selectedCollection = col;
        this.selectedId = null;
        this.closeSideIfNarrow();
        this.render();
      });
      item.addEventListener("dragover", (ev) => ev.preventDefault());
      item.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer?.getData("text/plain");
        if (id && getIcon(id)) void store.addToCollection(col.id, id);
      });
      item.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        new Menu()
          .addItem((i) => {
            i.setTitle("Rename").setIcon("pencil").onClick(async () => {
              const name = await this.promptText("Rename collection", col.name);
              if (name) void store.renameCollection(col.id, name);
            });
          })
          .addItem((i) => {
            i.setTitle("Delete").setIcon("trash").onClick(() => void store.deleteCollection(col.id));
          })
          .showAtMouseEvent(ev);
      });
    }

    /* --- tags --- */
    const tagSection = side.createDiv({ cls: "si-side-section" });
    const tagHead = tagSection.createDiv({ cls: "si-side-head" });
    tagHead.createSpan({ cls: "si-side-title", text: "Tags" });
    const tagList = tagSection.createDiv({ cls: "si-side-list" });
    const allTags = store.allUserTags();
    if (allTags.length === 0) {
      tagList.appendChild(emptyState("No user tags", "Tag icons from the detail panel"));
    }
    for (const tag of allTags) {
      const item = tagList.createDiv({
        cls: "si-side-item" + (this.filter.tag === tag ? " is-active" : ""),
      });
      const icon = item.createSpan({ cls: "si-side-item-icon" });
      renderIcon(icon, "tag");
      item.createSpan({ cls: "si-side-item-label", text: tag });
      item.addEventListener("click", () => {
        this.filter.tag = this.filter.tag === tag ? null : tag;
        this.selectedCollection = null;
        this.closeSideIfNarrow();
        this.render();
      });
    }

    /* --- packs info --- */
    const packSection = side.createDiv({ cls: "si-side-section" });
    packSection.createDiv({ cls: "si-side-title", text: "Packs" });
    const packSampleIcon: Record<PackId, string> = {
      star: "star-sparkle",
      lucide: "sparkles",
      material: "home",
      tabler: "layout-grid",
      "tabler-filled": "home",
      unicons: "apps",
      remix: "home-line",
      phosphor: "house",
      bootstrap: "house",
      boxicons: "home",
      heroicons: "home",
      openmoji: "grinning-face",
      animals: "dog",
      nature: "rose",
      science: "microscope",
    };
    for (const pack of ALL_PACKS) {
      const row = packSection.createDiv({ cls: "si-side-item si-side-static" });
      const ic = row.createSpan({ cls: "si-side-item-icon" });
      renderIcon(ic, `si-${pack}-${packSampleIcon[pack]}`);
      row.createSpan({ cls: "si-side-item-label", text: `${PACK_LABELS[pack]} v${this.plugin.store.getPackVersion(pack)}` });
      row.createSpan({ cls: "si-side-item-count", text: String(this.plugin.store.getPackCount(pack)) });
    }
  }

  private renderMain(): void {
    const main = this.mainEl;
    main.empty();
    const store = this.plugin.store;

    if (this.selectedCollection) {
      this.renderCollectionDetail(main, this.selectedCollection);
      return;
    }

    const icons = this.collectIcons();
    const grid = main.createDiv({ cls: "si-grid " + this.plugin.settings.iconGridDensity });
    if (icons.length === 0) {
      main.appendChild(emptyState("No icons match", "Clear the search or switch packs."));
      return;
    }
    for (const icon of icons) {
      grid.appendChild(this.buildTile(icon));
    }
    makeSortable(grid, {
      handleSelector: null,
      onReorder: () => {
        /* browse mode has no ordering */
      },
    });
    // prevent default drag inside browse grid (no reorder target)
    grid.addEventListener("dragstart", (ev) => {
      ev.dataTransfer?.setData("text/plain", (ev.target as HTMLElement).closest?.(".si-tile")?.getAttribute("data-icon-id") ?? "");
    });
  }

  private renderCollectionDetail(main: HTMLElement, col: Collection): void {
    const store = this.plugin.store;
    const head = main.createDiv({ cls: "si-col-head" });
    const back = head.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    back.createSpan({ text: "← All icons" });
    back.addEventListener("click", () => {
      this.selectedCollection = null;
      this.render();
    });
    const title = head.createDiv({ cls: "si-col-title" });
    title.createSpan({ text: col.name });
    title.createSpan({ cls: "si-col-count", text: `${col.iconIds.length} icons` });
    const addIcon = head.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    addIcon.createSpan({ text: "+ Add icon" });
    addIcon.addEventListener("click", () => {
      new IconPickerModal(this.app, () => store, {
        title: `Add to “${col.name}”`,
        onPick: (icon) => {
          if (icon) void store.addToCollection(col.id, icon.id);
        },
      }).open();
    });
    head.appendChild(addIcon);

    const list = main.createDiv({ cls: "si-col-list" });
    if (col.iconIds.length === 0) {
      list.appendChild(emptyState("Collection is empty", "Click “+ Add icon” or drag tiles from the grid onto a collection."));
    }
    col.iconIds.forEach((id, index) => {
      const def = getIcon(id);
      const row = list.createDiv({ cls: "si-col-item", attr: { draggable: "true", "data-index": String(index) } });
      const handle = row.createSpan({ cls: "si-drag-handle" });
      setIcon(handle, "grip-vertical");
      const ic = row.createSpan({ cls: "si-col-item-icon" });
      if (def) renderIcon(ic, def.id);
      const name = row.createSpan({ cls: "si-col-item-name", text: def ? def.id : id });
      void name;
      const remove = row.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
      setIcon(remove, "x");
      remove.addEventListener("click", () => void store.removeFromCollection(col.id, id));
      list.appendChild(row);
    });
    makeSortable(list, {
      onReorder: (from, to) => void store.moveInCollection(col.id, from, to),
    });
  }

  private collectIcons(): IconDef[] {
    const store = this.plugin.store;
    let icons = store.availableIcons();
    if (this.filter.pack !== "all") icons = icons.filter((i) => i.pack === this.filter.pack);
    if (this.filter.tag) {
      const tag = this.filter.tag;
      icons = icons.filter((i) => store.userTagsFor(i.id).includes(tag));
    }
    if (this.filter.query.trim()) {
      const q = this.filter.query.trim().toLowerCase();
      icons = icons.filter(
        (i) =>
          i.name.includes(q) ||
          i.tags.some((t) => t.includes(q)) ||
          i.id.includes(q),
      );
    }
    return icons.slice(0, 600);
  }

  private buildTile(icon: IconDef): HTMLElement {
    const store = this.plugin.store;
    const tile = iconTile(icon, {
      selected: this.selectedId === icon.id,
      onPick: (i) => {
        this.selectedId = this.selectedId === i.id ? null : i.id;
        this.renderDetail();
        this.renderMain();
      },
      onStar: (i) => void store.toggleFavorite(i.id),
      onContext: (i, ev) => {
        ev.preventDefault();
        new Menu()
          .addItem((item) => {
            item
              .setTitle(store.isFavorite(i.id) ? "Remove from favorites" : "Add to favorites")
              .setIcon("star")
              .onClick(() => void store.toggleFavorite(i.id));
          })
          .addItem((item) => {
            item.setTitle("Add to collection…").setIcon("folder-plus").onClick(() => this.showAddToCollection(i, ev));
          })
          .addItem((item) => {
            item.setTitle("Copy icon name").onClick(() => void navigator.clipboard.writeText(i.id));
          })
          .addItem((item) => {
            item.setTitle("Copy SVG").onClick(() => void navigator.clipboard.writeText(i.svg));
          })
          .showAtMouseEvent(ev);
      },
    });
    return tile;
  }

  private showAddToCollection(icon: IconDef, ev: MouseEvent): void {
    const store = this.plugin.store;
    const menu = new Menu();
    for (const col of store.getSettings().collections) {
      menu.addItem((item) => {
        item
          .setTitle(col.iconIds.includes(icon.id) ? `${col.name} ✓` : col.name)
          .setIcon(col.iconIds.includes(icon.id) ? "check" : "folder")
          .onClick(() => void store.addToCollection(col.id, icon.id));
      });
    }
    menu.addItem((item) => {
      item.setTitle("＋ New collection…").setIcon("plus").onClick(async () => {
        const name = await this.promptText("Collection name", "My icons");
        if (!name) return;
        const col = await store.createCollection(name);
        void store.addToCollection(col.id, icon.id);
      });
    });
    menu.showAtMouseEvent(ev);
  }

  private renderDetail(): void {
    const detail = this.detailEl;
    detail.empty();
    const store = this.plugin.store;
    const id = this.selectedId;
    if (!id) {
      detail.addClass("is-empty");
      const hint = detail.createDiv({ cls: "si-detail-hint" });
      renderIcon(hint, "si-star-sparkle", 40);
      hint.createEl("div", { cls: "si-detail-hint-text", text: "Select an icon" });
      return;
    }
    detail.removeClass("is-empty");
    const def = getIcon(id);
    if (!def) {
      this.selectedId = null;
      return;
    }

    const detailHead = detail.createDiv({ cls: "si-detail-head" });
    detailHead.createSpan({ cls: "si-detail-head-title", text: "Icon details" });
    const closeBtn = detailHead.createEl("button", {
      cls: "si-icon-btn",
      attr: { type: "button", "aria-label": "Close details" },
    });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.selectedId = null;
      this.renderDetail();
      this.renderMain();
    });

    const preview = detail.createDiv({ cls: "si-detail-preview" });
    renderIcon(preview, def.id, 56);
    detail.createDiv({ cls: "si-detail-name", text: def.name });
    detail.createDiv({ cls: "si-detail-id" }).setText(def.id);

    const actions = detail.createDiv({ cls: "si-detail-actions" });
    const favBtn = actions.createEl("button", {
      cls: "si-btn" + (store.isFavorite(id) ? " is-active" : ""),
      attr: { type: "button" },
    });
    setIcon(favBtn, store.isFavorite(id) ? "star" : "star");
    favBtn.createSpan({ text: store.isFavorite(id) ? "Favorited" : "Favorite" });
    favBtn.addEventListener("click", () => {
      void store.toggleFavorite(id);
      this.renderDetail();
      this.renderMain();
    });
    const applyBtn = actions.createEl("button", { cls: "si-btn si-btn-primary", attr: { type: "button" } });
    applyBtn.createSpan({ text: "Apply to active note" });
    applyBtn.addEventListener("click", () => {
      void this.plugin.setOverrideForActiveFile(id);
    });

    const copyRow = detail.createDiv({ cls: "si-detail-copy" });
    const copyName = copyRow.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    copyName.createSpan({ text: "Copy name" });
    copyName.addEventListener("click", () => void navigator.clipboard.writeText(def.id));
    const copySvg = copyRow.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    copySvg.createSpan({ text: "Copy SVG" });
    copySvg.addEventListener("click", () => void navigator.clipboard.writeText(def.svg));

    /* tags */
    const tagsSection = detail.createDiv({ cls: "si-detail-section" });
    tagsSection.createDiv({ cls: "si-detail-section-title", text: "Tags" });
    const tagWrap = tagsSection.createDiv({ cls: "si-tag-wrap" });
    const packTags = def.tags.slice(0, 8);
    for (const t of packTags) {
      tagWrap.createSpan({ cls: "si-tag is-pack", text: t });
    }
    for (const t of store.userTagsFor(id)) {
      const chip = tagWrap.createSpan({ cls: "si-tag" });
      chip.createSpan({ text: t });
      const x = chip.createSpan({ cls: "si-tag-x" });
      setIcon(x, "x");
      x.addEventListener("click", () => void store.removeUserTag(id, t));
    }
    const addInput = tagsSection.createEl("input", {
      cls: "si-text-input",
      attr: { placeholder: "add tag…", spellcheck: "false" },
    }) as HTMLInputElement;
    addInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && addInput.value.trim()) {
        void store.addUserTag(id, addInput.value);
        addInput.value = "";
      }
    });

    /* collections membership */
    const colSection = detail.createDiv({ cls: "si-detail-section" });
    colSection.createDiv({ cls: "si-detail-section-title", text: "Collections" });
    const colWrap = colSection.createDiv({ cls: "si-detail-cols" });
    for (const col of store.getSettings().collections) {
      const inCol = col.iconIds.includes(id);
      const item = colWrap.createEl("button", {
        cls: "si-btn si-btn-small" + (inCol ? " is-active" : ""),
        attr: { type: "button" },
      });
      item.createSpan({ text: `${inCol ? "✓ " : ""}${col.name}` });
      item.addEventListener("click", () => {
        void (inCol ? store.removeFromCollection(col.id, id) : store.addToCollection(col.id, id));
      });
    }
  }

  private async promptText(placeholder: string, fallback: string): Promise<string | null> {
    const value = window.prompt(placeholder, fallback);
    return value?.trim() ? value.trim() : null;
  }
}
