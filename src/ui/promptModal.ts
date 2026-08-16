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
        if (opts.danger) btn.setWarning();
        else btn.setCta();
        btn.onClick(() => {
          modal.close();
          resolve(true);
        });
      });
    modal.open();
  });
}
