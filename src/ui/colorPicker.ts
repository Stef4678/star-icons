/**
 * Star Icons — color palette UI.
 *
 * A small reusable palette: an "Auto" (theme default) swatch, preset
 * swatches from ICON_COLOR_PALETTE, and a native color input for custom
 * values. Used everywhere an applied icon's color can be changed — settings,
 * rules, file-type defaults, manual overrides.
 */

import { App, Modal, Setting } from "obsidian";
import { ICON_COLOR_PALETTE } from "../types";

export interface ColorPickerOptions {
  /** Currently selected color; null/undefined = theme default. */
  value: string | null | undefined;
  /** Called with the new color, or null for "Auto" (theme default). */
  onChange: (color: string | null) => void;
  /** Optional label rendered above the swatches. */
  label?: string;
}

/**
 * Render a color palette into `container`. The active swatch tracks `value`;
 * picking a swatch (or the native input) calls `onChange`.
 */
export function renderColorPicker(container: HTMLElement, opts: ColorPickerOptions): void {
  const current = opts.value || null;
  const isCustom = current !== null && !ICON_COLOR_PALETTE.includes(current);

  const wrap = container.createDiv({ cls: "si-color-picker" });
  if (opts.label) wrap.createSpan({ cls: "si-color-label", text: opts.label });

  const swatches = wrap.createDiv({ cls: "si-color-swatches" });

  const auto = swatches.createEl("button", {
    cls: "si-color-swatch si-color-auto" + (current === null ? " is-active" : ""),
    attr: { type: "button", "aria-label": "Auto — theme default color" },
    title: "Auto (theme default)",
  });
  auto.createSpan({ text: "A" });
  auto.addEventListener("click", () => opts.onChange(null));

  for (const color of ICON_COLOR_PALETTE) {
    const swatch = swatches.createEl("button", {
      cls: "si-color-swatch" + (current === color ? " is-active" : ""),
      attr: { type: "button", "aria-label": color },
      title: color,
    });
    swatch.style.background = color;
    swatch.addEventListener("click", () => opts.onChange(color));
    swatches.appendChild(swatch);
  }

  // Custom color: a native color input styled like a swatch. Shows the
  // current custom color, or a rainbow hint when none is set.
  const custom = swatches.createEl("label", {
    cls: "si-color-swatch si-color-custom" + (isCustom ? " is-active" : ""),
    attr: { title: "Custom color…", "aria-label": "Custom color…" },
  });
  const plus = custom.createSpan({ cls: "si-color-custom-plus", text: "+" });
  void plus;
  const input = custom.createEl("input", {
    cls: "si-color-input",
    attr: { type: "color" },
  });
  if (isCustom) {
    custom.style.background = current;
  } else {
    custom.style.background =
      "conic-gradient(#e93147, #f5b301, #98c379, #40c4ff, #a78bfa, #e93147)";
  }
  input.addEventListener("input", () => {
    custom.style.background = input.value;
    opts.onChange(input.value);
  });
  swatches.appendChild(custom);
}

/** Result of the color modal: null = dismissed, { color } = chosen. */
export interface ColorModalResult {
  /** Chosen CSS color, or null for "Auto" (theme default). */
  color: string | null;
}

/**
 * A small modal wrapping the palette. Resolves:
 *   • null        — cancelled (Escape / Cancel)
 *   • { color }   — a color was picked; color may be null for "Auto"
 */
export function openColorModal(
  app: App,
  opts: { title: string; initial?: string | null },
): Promise<ColorModalResult | null> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(opts.title);
    let color: string | null = opts.initial ?? null;

    const box = modal.contentEl.createDiv({ cls: "si-color-modal" });
    renderColorPicker(box, {
      value: color,
      onChange: (c) => {
        color = c;
      },
    });
    box.createDiv({
      cls: "si-hint",
      text: "Colors tint stroke/fill icons (Lucide, Tabler, Material…). Full-color packs (emoji) keep their own colors.",
    });

    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          modal.close();
          resolve(null);
        }),
      )
      .addButton((b) =>
        b.setButtonText("OK").setCta().onClick(() => {
          modal.close();
          resolve({ color });
        }),
      );

    modal.open();
  });
}
