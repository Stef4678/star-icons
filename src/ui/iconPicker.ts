/**
 * Star Icons — the icon picker modal.
 *
 * Searchable, filterable, keyboard-navigable. Shows recents + favorites when
 * idle. Used for manual overrides, rules, file-type defaults, and copying.
 */

import { App, Menu, Modal, Notice, setIcon } from "obsidian";
import { getIcon } from "../data/icons";
import { IconStore } from "../core/iconStore";
import { IconDef, PackId } from "../types";
import { clamp, debounce } from "../utils";
import { emptyState, iconTile, renderIcon, shortName } from "./components";

export interface IconPickerOptions {
  title?: string;
  packFilter?: PackId | "all";
  /** Show a "No icon (Obsidian default)" option that resolves to null. */
  allowNone?: boolean;
  /** Called with null when the user picks "none". */
  onPick: (icon: IconDef | null) => void;
}

const PACK_CHIPS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lucide", label: "Lucide" },
  { value: "material", label: "Material" },
  { value: "star", label: "Star" },
];

export class IconPickerModal extends Modal {
  private store: IconStore;
  private query = "";
  private packFilter: PackId | "all";
  private showFavoritesOnly = false;
  private selectedIndex = 0;
  private gridEl!: HTMLElement;
  private footerNameEl!: HTMLElement;
  private footerIconEl!: HTMLElement;
  private results: IconDef[] = [];

  constructor(
    app: App,
    private storeProvider: () => IconStore,
    private opts: IconPickerOptions,
  ) {
    super(app);
    this.store = storeProvider();
    this.packFilter = opts.packFilter ?? "all";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("si-picker");

    const header = contentEl.createDiv({ cls: "si-picker-header" });
    header.createDiv({ cls: "si-picker-title", text: this.opts.title ?? "Pick an icon" });

    const searchRow = contentEl.createDiv({ cls: "si-search-row" });
    const searchWrap = searchRow.createDiv({ cls: "si-search" });
    const searchIcon = searchWrap.createSpan({ cls: "si-search-icon" });
    renderIcon(searchIcon, "search");
    const input = searchWrap.createEl("input", {
      cls: "si-search-input",
      attr: { placeholder: "Search icons… (try “folder”, “star”, “home”)", spellcheck: "false" },
    });
    searchRow.appendChild(searchWrap);

    const chips = contentEl.createDiv({ cls: "si-chips si-picker-chips" });
    for (const chip of PACK_CHIPS) {
      const btn = chips.createEl("button", {
        cls: "si-chip" + (chip.value === this.packFilter ? " is-active" : ""),
        attr: { type: "button" },
      });
      btn.createSpan({ text: chip.label });
      btn.addEventListener("click", () => {
        this.packFilter = chip.value as PackId | "all";
        chips.querySelectorAll(".si-chip").forEach((c) => c.removeClass("is-active"));
        btn.addClass("is-active");
        this.selectedIndex = 0;
        this.renderGrid();
      });
    }
    const favChip = chips.createEl("button", {
      cls: "si-chip" + (this.showFavoritesOnly ? " is-active" : ""),
      attr: { type: "button" },
    });
    const favIc = favChip.createSpan({ cls: "si-chip-icon" });
    setIcon(favIc, "star");
    favChip.createSpan({ text: "Favorites" });
    favChip.addEventListener("click", () => {
      this.showFavoritesOnly = !this.showFavoritesOnly;
      favChip.toggleClass("is-active", this.showFavoritesOnly);
      this.selectedIndex = 0;
      this.renderGrid();
    });

    if (this.opts.allowNone) {
      const noneChip = chips.createEl("button", { cls: "si-chip", attr: { type: "button" } });
      noneChip.createSpan({ text: "✕ No icon" });
      noneChip.addEventListener("click", () => {
        this.opts.onPick(null);
        this.close();
      });
    }

    this.gridEl = contentEl.createDiv({ cls: "si-picker-grid" });

    const footer = contentEl.createDiv({ cls: "si-picker-footer" });
    this.footerIconEl = footer.createSpan({ cls: "si-footer-icon" });
    this.footerNameEl = footer.createSpan({ cls: "si-footer-name", text: "No selection" });
    const actions = footer.createDiv({ cls: "si-footer-actions" });

    const copyName = actions.createEl("button", { cls: "si-btn", attr: { type: "button" } });
    copyName.createSpan({ text: "Copy name" });
    copyName.addEventListener("click", () => this.copySelected("name"));

    const copySvg = actions.createEl("button", { cls: "si-btn", attr: { type: "button" } });
    copySvg.createSpan({ text: "Copy SVG" });
    copySvg.addEventListener("click", () => this.copySelected("svg"));

    const selectBtn = actions.createEl("button", {
      cls: "si-btn si-btn-primary",
      attr: { type: "button" },
    });
    selectBtn.createSpan({ text: "Select" });
    selectBtn.addEventListener("click", () => {
      const icon = this.results[this.selectedIndex];
      if (icon) this.pick(icon);
    });

    const doSearch = debounce(() => {
      this.selectedIndex = 0;
      this.renderGrid();
    }, 120);
    input.addEventListener("input", () => {
      this.query = input.value;
      doSearch();
    });
    input.addEventListener("keydown", (ev) => this.onKey(ev, input));

    this.renderGrid();
    window.setTimeout(() => input.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private onKey(ev: KeyboardEvent, input: HTMLInputElement): void {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      const dir = ev.key === "ArrowDown" ? 1 : -1;
      this.selectedIndex = clamp(this.selectedIndex + dir, 0, Math.max(0, this.results.length - 1));
      this.highlight();
    } else if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      const dir = ev.key === "ArrowRight" ? 1 : -1;
      this.selectedIndex = clamp(this.selectedIndex + dir * 6, 0, Math.max(0, this.results.length - 1));
      this.highlight();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const icon = this.results[this.selectedIndex];
      if (icon) this.pick(icon);
    } else if (ev.key === "Escape") {
      this.close();
    }
    void input;
  }

  private pick(icon: IconDef): void {
    void this.store.pushRecent(icon.id);
    this.opts.onPick(icon);
    this.close();
  }

  private copySelected(kind: "name" | "svg"): void {
    const icon = this.results[this.selectedIndex];
    if (!icon) return;
    navigator.clipboard.writeText(kind === "name" ? icon.id : icon.svg).then(() => {
      new Notice("Copied " + (kind === "name" ? icon.id : "SVG") + " to clipboard");
    });
  }

  private highlight(): void {
    this.gridEl.querySelectorAll(".si-tile.is-selected").forEach((el) => el.removeClass("is-selected"));
    const tiles = this.gridEl.querySelectorAll(".si-tile");
    const tile = tiles[this.selectedIndex] as HTMLElement | undefined;
    tile?.addClass("is-selected");
    tile?.scrollIntoView({ block: "nearest" });
    this.updateFooter();
  }

  private updateFooter(): void {
    const icon = this.results[this.selectedIndex];
    if (!icon) {
      this.footerIconEl.empty();
      this.footerNameEl.setText("No selection");
      return;
    }
    renderIcon(this.footerIconEl, icon.id, 18);
    this.footerNameEl.setText(`${icon.id}  ·  ${icon.tags.slice(0, 4).join(", ")}`);
  }

  private renderGrid(): void {
    this.gridEl.empty();

    const icons =
      this.showFavoritesOnly
        ? this.store.favoriteIcons()
        : this.store.search(this.query, this.packFilter, 400);

    const sections: { title: string; icons: IconDef[] }[] = [];
    if (!this.query.trim() && !this.showFavoritesOnly) {
      const recents = this.store.recentIcons().filter((i) => this.packFilter === "all" || i.pack === this.packFilter);
      if (recents.length) sections.push({ title: "Recent", icons: recents.slice(0, 18) });
      const favs = this.store.favoriteIcons().filter((i) => this.packFilter === "all" || i.pack === this.packFilter);
      if (favs.length) sections.push({ title: "Favorites", icons: favs.slice(0, 24) });
      sections.push({ title: "All icons", icons });
    } else {
      sections.push({ title: this.query.trim() ? `Results (${icons.length})` : "Icons", icons });
    }

    this.results = sections.flatMap((s) => s.icons);

    if (this.results.length === 0) {
      this.gridEl.appendChild(emptyState("No icons found", "Try a different search or pack."));
      return;
    }

    let tileIndex = 0;
    for (const section of sections) {
      if (section.icons.length === 0) continue;
      const head = this.gridEl.createDiv({ cls: "si-section-title", text: section.title });
      void head;
      const grid = this.gridEl.createDiv({ cls: "si-grid" });
      for (const icon of section.icons) {
        const idx = tileIndex++;
        const isFav = this.store.isFavorite(icon.id);
        const tile = iconTile(icon, {
          selected: idx === this.selectedIndex,
          onPick: (i) => this.pick(i),
          onStar: (i) => void this.store.toggleFavorite(i.id),
          onContext: (i, ev) => {
            ev.preventDefault();
            this.selectedIndex = idx;
            this.highlight();
            new Menu().addItem((item) => {
              item.setTitle(isFav ? "Remove from favorites" : "Add to favorites").setIcon("star").onClick(() => {
                void this.store.toggleFavorite(i.id);
                this.renderGrid();
              });
            }).addItem((item) => {
              item.setTitle("Copy icon name").onClick(() => {
                navigator.clipboard.writeText(i.id);
              });
            }).addItem((item) => {
              item.setTitle("Copy SVG").onClick(() => {
                navigator.clipboard.writeText(i.svg);
              });
            }).showAtMouseEvent(ev);
          },
        });
        if (idx === this.selectedIndex) tile.addClass("is-selected");
        grid.appendChild(tile);
      }
    }
    this.updateFooter();
  }
}

