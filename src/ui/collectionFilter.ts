/**
 * Star Icons — compact collections dropdown.
 *
 * Makes collections reachable from the manager header (the sidebar list is
 * easy to miss, especially on narrow panes). Same popover pattern as the
 * pack filter: click the button to see every collection with its icon and
 * size, pick one to browse it, or create a new collection.
 */

import { setIcon } from "obsidian";
import { IconStore } from "../core/iconStore";
import { Collection } from "../types";
import { renderIcon } from "./components";

export interface CollectionFilterOptions {
  store: IconStore;
  getCurrent: () => Collection | null;
  /** null clears the collection filter (browse all icons). */
  onSelect: (col: Collection | null) => void;
  /** Creates a collection and returns it (or null if cancelled). */
  onCreate: () => Promise<Collection | null>;
}

export class CollectionFilterControl {
  private root: HTMLElement | null = null;
  private btn: HTMLButtonElement | null = null;
  private popover: HTMLElement | null = null;

  constructor(private opts: CollectionFilterOptions) {}

  mount(container: HTMLElement): HTMLElement {
    this.root = container.createDiv({ cls: "si-pack-filter" });
    this.btn = this.root.createEl("button", {
      cls: "si-pack-filter-btn",
      attr: { type: "button", "aria-label": "Browse collections" },
    });
    this.btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.toggle();
    });
    this.updateLabel();
    return this.root;
  }

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
    const current = this.opts.getCurrent();
    const ic = this.btn.createSpan({ cls: "si-pack-filter-icon" });
    if (current) {
      renderIcon(ic, current.iconIds[0] ?? "si-lucide-folder");
      this.btn.createSpan({ text: current.name });
    } else {
      renderIcon(ic, "folder");
      this.btn.createSpan({ text: "Collections" });
    }
    const chev = this.btn.createSpan({ cls: "si-pack-filter-chev" });
    setIcon(chev, "chevron-down");
  }

  private toggle(): void {
    if (this.popover) this.close();
    else this.open();
  }

  private open(): void {
    if (!this.root) return;
    this.popover = this.root.createDiv({ cls: "si-pack-filter-pop" });

    const head = this.popover.createDiv({ cls: "si-pf-head" });
    head.createSpan({ cls: "si-pf-title", text: "Collections" });
    const closeBtn = head.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", () => this.close());

    const list = this.popover.createDiv({ cls: "si-pf-list" });
    this.renderPopover();

    document.addEventListener("mousedown", this.onDocMouseDown);
    document.addEventListener("keydown", this.onKeyDown);
  }

  private renderPopover(): void {
    if (!this.popover) return;
    const list = this.popover.querySelector(".si-pf-list") as HTMLElement | null;
    if (!list) return;
    list.empty();
    const store = this.opts.store;
    const current = this.opts.getCurrent();

    const renderRow = (label: string, iconId: string, count: string | null, isCurrent: boolean, onClick: () => void) => {
      const row = list.createDiv({ cls: "si-pf-row" + (isCurrent ? " is-current" : "") });
      const ic = row.createSpan({ cls: "si-pf-icon" });
      renderIcon(ic, iconId);
      row.createSpan({ cls: "si-pf-label", text: label });
      if (count !== null) row.createSpan({ cls: "si-pf-count", text: count });
      row.addEventListener("click", onClick);
    };

    renderRow("All icons", "layers", null, current === null, () => {
      this.opts.onSelect(null);
      this.close();
    });

    const collections = store.getSettings().collections;
    if (collections.length === 0) {
      list.createDiv({ cls: "si-empty", text: "No collections yet" });
    }
    for (const col of collections) {
      renderRow(col.name, col.iconIds[0] ?? "si-lucide-folder", String(col.iconIds.length), current?.id === col.id, () => {
        this.opts.onSelect(col);
        this.close();
      });
    }

    const newRow = list.createDiv({ cls: "si-pf-row si-pf-new" });
    const ic = newRow.createSpan({ cls: "si-pf-icon" });
    renderIcon(ic, "plus");
    newRow.createSpan({ cls: "si-pf-label", text: "New collection…" });
    newRow.addEventListener("click", () => {
      void (async () => {
        const col = await this.opts.onCreate();
        if (col) {
          this.opts.onSelect(col);
          this.close();
        }
      })();
    });
  }

  private onDocMouseDown = (ev: MouseEvent): void => {
    if (this.root && !this.root.contains(ev.target as Node)) this.close();
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") this.close();
  };
}
