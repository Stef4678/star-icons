/**
 * Star Icons — native-dialog replacements.
 *
 * Obsidian blocks window.prompt / window.confirm, so plugins must use their
 * own modals. These helpers provide a text-input prompt and a confirm dialog
 * using the Obsidian Modal API.
 */

import { App, Modal, Setting } from "obsidian";

export interface PromptOptions {
  title: string;
  placeholder?: string;
  initial?: string;
  okLabel?: string;
}

/** Ask for a single line of text; resolves null when cancelled/empty. */
export function promptText(app: App, opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(opts.title);
    let value = opts.initial ?? "";

    new Setting(modal.contentEl).addText((t) => {
      t.setPlaceholder(opts.placeholder ?? "");
      t.setValue(value);
      t.onChange((v) => (value = v));
      window.setTimeout(() => t.inputEl.focus(), 30);
      t.inputEl.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          modal.close();
          resolve(value.trim() || null);
        }
      });
    });

    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          modal.close();
          resolve(null);
        }),
      )
      .addButton((b) =>
        b.setButtonText(opts.okLabel ?? "OK").setCta().onClick(() => {
          modal.close();
          resolve(value.trim() || null);
        }),
      );

    modal.open();
  });
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** Ask yes/no; resolves the boolean. */
export function confirmDialog(app: App, opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(opts.title);
    if (opts.message) {
      modal.contentEl.createDiv({ cls: "setting-item-description", text: opts.message });
    }
    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          modal.close();
          resolve(false);
        }),
      )
      .addButton((b) => {
        const btn = b.setButtonText(opts.confirmLabel ?? "Confirm");
        if (opts.danger) btn.setDestructive();
        else btn.setCta();
        btn.onClick(() => {
          modal.close();
          resolve(true);
        });
      });
    modal.open();
  });
}

export interface TextAreaOptions {
  title: string;
  placeholder?: string;
  okLabel?: string;
}

/** Ask for a multi-line block of text (e.g. pasted SVG code). */
export function promptTextArea(app: App, opts: TextAreaOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(opts.title);
    let value = "";

    const textarea = modal.contentEl.createEl("textarea", {
      cls: "si-textarea",
      attr: { placeholder: opts.placeholder ?? "", spellcheck: "false", rows: "8" },
    });
    textarea.addEventListener("input", () => (value = textarea.value));
    textarea.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        modal.close();
        resolve(value.trim() || null);
      }
    });
    window.setTimeout(() => textarea.focus(), 30);

    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          modal.close();
          resolve(null);
        }),
      )
      .addButton((b) =>
        b.setButtonText(opts.okLabel ?? "OK").setCta().onClick(() => {
          modal.close();
          resolve(value.trim() || null);
        }),
      );

    modal.open();
  });
}

export interface SizeOptions {
  title?: string;
  presets?: number[];
  initial?: number;
}

/** Pick a size for an inserted icon (preset chips + custom number input). */
export function promptSize(app: App, opts: SizeOptions = {}): Promise<number | null> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(opts.title ?? "Icon size");
    const presets = opts.presets ?? [16, 24, 32, 48, 64, 96];
    let size = opts.initial ?? 24;

    const chips = modal.contentEl.createDiv({ cls: "si-chips si-size-picker" });
    const buttons: HTMLButtonElement[] = [];
    for (const p of presets) {
      const btn = chips.createEl("button", {
        cls: "si-chip" + (p === size ? " is-active" : ""),
        attr: { type: "button" },
      });
      btn.createSpan({ text: `${p}px` });
      btn.addEventListener("click", () => {
        size = p;
        input.value = String(p);
        buttons.forEach((b) => b.removeClass("is-active"));
        btn.addClass("is-active");
      });
      buttons.push(btn);
    }

    const customRow = modal.contentEl.createDiv({ cls: "si-size-custom" });
    customRow.createSpan({ cls: "si-label", text: "Custom" });
    const input = customRow.createEl("input", {
      cls: "si-text-input",
      attr: { type: "number", min: "1", max: "512", placeholder: "24" },
    });
    input.value = String(size);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const v = parseInt(input.value, 10);
        modal.close();
        resolve(!isNaN(v) && v > 0 ? v : null);
      }
    });
    window.setTimeout(() => input.select(), 30);

    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("Cancel").onClick(() => {
          modal.close();
          resolve(null);
        }),
      )
      .addButton((b) =>
        b.setButtonText("Insert").setCta().onClick(() => {
          const v = parseInt(input.value, 10);
          modal.close();
          resolve(!isNaN(v) && v > 0 ? v : null);
        }),
      );

    modal.open();
  });
}
