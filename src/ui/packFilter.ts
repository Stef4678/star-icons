/**
 * Star Icons — compact pack filter dropdown.
 *
 * Replaces the row of pack chips (which wrapped into many rows with 39 packs)
 * with a single button + searchable popover listing every pack grouped by
 * category. Each row has an enable/disable checkbox; clicking the row body
 * selects the pack as the active filter (auto-enabling it if it was off).
 */

import { setIcon } from "obsidian";
import { IconStore } from "../core/iconStore";
import { ALL_PACKS, PACK_GROUPS, PACK_LABELS, PACK_SAMPLE_ICON, PackId } from "../types";
import { fitPopoverToPane, renderIcon } from "./components";

export interface PackFilterOptions {
  store: IconStore;
  /** Live getter for the currently selected pack filter. */
  getCurrent: () => PackId | "all";
  onSelect: (pack: PackId | "all") => void;
}

export class PackFilterControl {
  private root: HTMLElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private popover: HTMLElement | null = null;
  private search = "";
  private searchInput: HTMLInputElement | null = null;

  constructor(private opts: PackFilterOptions) {}

  /** Mount into a container; returns the root element. */
  mount(container: HTMLElement): HTMLElement {
    this.root = container.createDiv({ cls: "si-pack-filter" });
    this.btn = this.root.createEl("button", {
      cls: "si-pack-filter-btn",
      attr: { type: "button", "aria-label": "Filter by pack" },
    });
    this.btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.toggle();
    });
    this.updateLabel();
    return this.root;
  }

  /** Refresh button label and (if open) the popover list. */
  update(): void {
    this.updateLabel();
    if (this.popover) this.renderPopover();
  }

  close(): void {
    this.popover?.remove();
    this.popover = null;
    document.removeEventListener("mousedown", this.onDocMouseDown);
    document.removeEventListener("keydown", this.onKeyDown);
  }

  /* --- internals -------------------------------------------------------- */

  private updateLabel(): void {
    if (!this.btn) return;
    this.btn.empty();
    const store = this.opts.store;
    const pack = this.opts.getCurrent();
    const ic = this.btn.createSpan({ cls: "si-pack-filter-icon" });
    if (pack === "all") {
      renderIcon(ic, "layers");
      this.btn.createSpan({ text: `All packs · ${store.totalCount().toLocaleString()}` });
    } else {
      renderIcon(ic, `si-${pack}-${PACK_SAMPLE_ICON[pack] ?? "home"}`);
      this.btn.createSpan({ text: PACK_LABELS[pack] ?? pack });
    }
    const chev = this.btn.createSpan({ cls: "si-pack-filter-chev" });
    setIcon(chev, "chevron-down");
  }

  private toggle(): void {
    if (this.popover) this.close();
    else this.open();
  }

  private open(): void {
    if (!this.root || !this.btn) return;
    this.popover = this.root.createDiv({ cls: "si-pack-filter-pop" });
    // Keep the popover inside the pane: open rightward when possible, else
    // leftward (right-anchored) so it's never clipped in a narrow sidebar.
    const manager = this.root.closest(".si-manager") as HTMLElement | null;
    if (manager) fitPopoverToPane(this.popover, this.btn, manager);

    const head = this.popover.createDiv({ cls: "si-pf-head" });
    head.createSpan({ cls: "si-pf-title", text: "Packs" });
    const closeBtn = head.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => this.close());

    const searchWrap = this.popover.createDiv({ cls: "si-search si-pf-search" });
    const searchIcon = searchWrap.createSpan({ cls: "si-search-icon" });
    renderIcon(searchIcon, "search");
    this.searchInput = searchWrap.createEl("input", {
      cls: "si-search-input",
      attr: { placeholder: "Search packs…", spellcheck: "false" },
    }) as HTMLInputElement;
    this.searchInput.addEventListener("input", () => {
      this.search = this.searchInput?.value ?? "";
      if (this.popover) this.renderPopover();
    });

    const list = this.popover.createDiv({ cls: "si-pf-list" });
    void list;
    this.renderPopover();

    document.addEventListener("mousedown", this.onDocMouseDown);
    document.addEventListener("keydown", this.onKeyDown);
    window.setTimeout(() => this.searchInput?.focus(), 30);
  }

  private renderPopover(): void {
    if (!this.popover) return;
    const list = this.popover.querySelector(".si-pf-list") as HTMLElement | null;
    if (!list) return;
    list.empty();
    const q = this.search.trim().toLowerCase();

    const renderRow = (pack: PackId) => {
      if (q && !((PACK_LABELS[pack] ?? pack).toLowerCase().includes(q))) return;
      const store = this.opts.store;
      const enabled = store.packEnabled(pack);
      const row = list.createDiv({
        cls: "si-pf-row" + (this.opts.getCurrent() === pack ? " is-current" : "") + (enabled ? "" : " is-off"),
      });
      const cb = row.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
      cb.checked = enabled;
      cb.addEventListener("change", (ev) => {
        ev.stopPropagation();
        void (async () => {
          if (cb.checked) await store.enablePack(pack);
          else await store.disablePack(pack);
          this.update();
        })();
      });
      const ic = row.createSpan({ cls: "si-pf-icon" });
      renderIcon(ic, `si-${pack}-${PACK_SAMPLE_ICON[pack] ?? "home"}`);
      row.createSpan({ cls: "si-pf-label", text: PACK_LABELS[pack] ?? pack });
      row.createSpan({ cls: "si-pf-count", text: store.getPackCount(pack).toLocaleString() });
      row.addEventListener("click", () => {
        if (!enabled) void store.enablePack(pack);
        this.opts.onSelect(pack);
        this.close();
      });
    };

    const renderAll = () => {
      const row = list.createDiv({ cls: "si-pf-row" + (this.opts.getCurrent() === "all" ? " is-current" : "") });
      const ic = row.createSpan({ cls: "si-pf-icon" });
      renderIcon(ic, "layers");
      row.createSpan({ cls: "si-pf-label", text: "All packs" });
      row.createSpan({ cls: "si-pf-count", text: this.opts.store.totalCount().toLocaleString() });
      row.addEventListener("click", () => {
        this.opts.onSelect("all");
        this.close();
      });
    };

    if (q) {
      for (const pack of ALL_PACKS) renderRow(pack);
    } else {
      renderAll();
      const userCount = this.opts.store.userIcons().length;
      if (userCount > 0) {
        list.createDiv({ cls: "si-pf-group-title", text: `My icons (${userCount})` });
        renderRow("user");
      }
      for (const group of PACK_GROUPS) {
        const title = list.createDiv({ cls: "si-pf-group-title", text: group.title });
        void title;
        for (const pack of group.packs) renderRow(pack);
      }
    }
    if (list.children.length === 0) {
      list.createDiv({ cls: "si-empty", text: "No packs match" });
    }
  }

  private onDocMouseDown = (ev: MouseEvent): void => {
    if (this.root && !this.root.contains(ev.target as Node)) this.close();
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") this.close();
  };
}
