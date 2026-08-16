/**
 * Star Icons — small reusable DOM pieces shared across the UI.
 */

import { getIcon as obsGetIcon, setIcon } from "obsidian";
import { IconDef } from "../types";

/**
 * The brand icon id, verified against Obsidian's live icon registry.
 * Falls back to the guaranteed built-in "star" if the custom star-sparkle
 * icon ever fails to register (ribbon, tab, status bar must never be empty).
 */
export function brandIconId(): string {
  try {
    return obsGetIcon("si-star-sparkle") ? "si-star-sparkle" : "star";
  } catch {
    return "star";
  }
}

/** Safely render an icon (registered or built-in) into an element. */
export function renderIcon(el: HTMLElement, iconId: string, size?: number): void {
  try {
    setIcon(el, iconId);
  } catch {
    el.empty();
    return;
  }
  const svg = el.querySelector("svg");
  if (svg && size) {
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
  }
}

/** "si-lucide-home" -> "home" */
export function shortName(id: string): string {
  const m = /^si-[a-z]+-(.+)$/.exec(id);
  return m ? m[1] : id;
}

export function packOf(id: string): string {
  const m = /^si-([a-z]+)-/.exec(id);
  return m ? m[1] : "?";
}

export function emptyState(text: string, hint = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = "si-empty";
  el.createEl("div", { cls: "si-empty-icon" }).textContent = "✦";
  el.createEl("div", { cls: "si-empty-text", text });
  if (hint) el.createEl("div", { cls: "si-empty-hint", text: hint });
  return el;
}

/** Build an icon tile (button). */
export function iconTile(
  icon: IconDef,
  opts: {
    selected?: boolean;
    onPick?: (icon: IconDef) => void;
    onStar?: (icon: IconDef, ev: MouseEvent) => void;
    onContext?: (icon: IconDef, ev: MouseEvent) => void;
  } = {},
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "si-tile" + (opts.selected ? " is-selected" : "");
  btn.setAttribute("data-icon-id", icon.id);
  btn.type = "button";

  const iconWrap = btn.createDiv({ cls: "si-tile-icon" });
  renderIcon(iconWrap, icon.id);
  btn.createDiv({ cls: "si-tile-name" }).textContent = icon.name;

  if (opts.onPick) btn.addEventListener("click", () => opts.onPick?.(icon));
  if (opts.onStar) {
    const star = btn.createDiv({ cls: "si-tile-star", attr: { "aria-label": "Favorite" } });
    setIcon(star, "star");
    star.addEventListener("click", (ev) => {
      ev.stopPropagation();
      opts.onStar?.(icon, ev);
    });
  }
  if (opts.onContext) {
    btn.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      opts.onContext?.(icon, ev);
    });
  }
  return btn;
}

/** A row of filter chips; returns the container. */
export function chipRow(
  options: { value: string; label: string; icon?: string }[],
  current: string,
  onChange: (value: string) => void,
  cls = "si-chips",
): HTMLElement {
  const row = document.createElement("div");
  row.className = cls;
  for (const opt of options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "si-chip" + (opt.value === current ? " is-active" : "");
    if (opt.icon) {
      const ic = chip.createSpan({ cls: "si-chip-icon" });
      renderIcon(ic, opt.icon);
    }
    chip.createSpan({ text: opt.label });
    chip.addEventListener("click", () => onChange(opt.value));
    row.appendChild(chip);
  }
  return row;
}

export function segmentedControl(
  options: { value: string; label: string }[],
  current: string,
  onChange: (value: string) => void,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "si-segmented";
  const buttons: HTMLButtonElement[] = [];
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "si-seg" + (opt.value === current ? " is-active" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      // Move the active state onto the clicked segment so the UI always
      // reflects the current value (fixes "button doesn't respond").
      for (const b of buttons) b.classList.remove("is-active");
      btn.classList.add("is-active");
      onChange(opt.value);
    });
    wrap.appendChild(btn);
    buttons.push(btn);
  }
  return wrap;
}

export interface SortableOptions {
  onReorder: (from: number, to: number) => void;
  handleSelector?: string | null;
  dragClass?: string;
}

/**
 * Make a list element sortable via HTML5 drag & drop.
 * Children must be direct elements; their index is captured on dragstart.
 */
export function makeSortable(listEl: HTMLElement, opts: SortableOptions): void {
  let dragIndex = -1;
  const handleSel = opts.handleSelector ?? ".si-drag-handle";
  const dragClass = opts.dragClass ?? "is-dragging";

  listEl.addEventListener("dragstart", (ev) => {
    const target = (ev.target as HTMLElement).closest?.("[data-index]") as HTMLElement | null;
    if (!target) return;
    if (handleSel) {
      const handle = (ev.target as HTMLElement).closest?.(handleSel);
      if (!handle) {
        ev.preventDefault();
        return;
      }
    }
    dragIndex = parseInt(target.dataset.index ?? "-1", 10);
    ev.dataTransfer?.setData("text/plain", String(dragIndex));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    target.classList.add(dragClass);
  });

  listEl.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    const target = (ev.target as HTMLElement).closest?.("[data-index]") as HTMLElement | null;
    if (!target) return;
    const overIndex = parseInt(target.dataset.index ?? "-1", 10);
    if (overIndex === dragIndex) return;
    target.classList.add("is-drag-over");
  });

  listEl.addEventListener("dragleave", (ev) => {
    const target = (ev.target as HTMLElement).closest?.("[data-index]") as HTMLElement | null;
    target?.classList.remove("is-drag-over");
  });

  listEl.addEventListener("drop", (ev) => {
    ev.preventDefault();
    const target = (ev.target as HTMLElement).closest?.("[data-index]") as HTMLElement | null;
    target?.classList.remove("is-drag-over");
    if (dragIndex < 0 || !target) return;
    const to = parseInt(target.dataset.index ?? "-1", 10);
    if (to >= 0 && to !== dragIndex) opts.onReorder(dragIndex, to);
    dragIndex = -1;
  });

  listEl.addEventListener("dragend", () => {
    dragIndex = -1;
    listEl.querySelectorAll(".is-dragging, .is-drag-over").forEach((el) => {
      el.classList.remove("is-dragging", "is-drag-over");
    });
  });
}
