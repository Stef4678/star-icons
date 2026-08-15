/**
 * Star Icons — settings tab.
 *
 * General toggles, pack management, file-type defaults, the draggable rules
 * list, collections overview and data export/import/reset.
 */

import { App, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { StarIconsPlugin } from "../main";
import { getIcon, PACK_VERSIONS, TOTAL_ICON_COUNT } from "../data/icons";
import { PACK_LABELS, PackId, Rule } from "../types";
import { mergeSettings } from "../settings";
import { downloadJson, normalizeExt, uid } from "../utils";
import { iconTile, makeSortable, renderIcon } from "./components";
import { IconPickerModal } from "./iconPicker";
import { RuleEditModal } from "./ruleEditor";

export function summarizeRule(rule: Rule): string {
  if (rule.conditions.length === 0) return "matches everything";
  const parts = rule.conditions.map((c) => {
    switch (c.type) {
      case "time":
        const days = c.days?.length ? c.days.map((d) => "SMTWTFS"[d]).join("") + " " : "";
        return `time ${days}${c.from ?? "…"}–${c.to ?? "…"}`;
      case "property":
        return `property ${c.key} ${c.op} ${c.value ?? ""}`.trim();
      default:
        return `${c.type} ${c.op} “${c.value ?? ""}”`;
    }
  });
  return parts.join(rule.match === "all" ? " AND " : " OR ");
}

export class StarIconsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: StarIconsPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("si-settings");

    this.renderGeneral();
    this.renderPacks();
    this.renderFileTypes();
    this.renderRules();
    this.renderCollections();
    this.renderData();
  }

  /* --- general ------------------------------------------------------------ */

  private renderGeneral(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    new Setting(containerEl).setName("Where icons appear").setHeading();

    new Setting(containerEl)
      .setName("File explorer icons")
      .setDesc("Show resolved icons on files and folders in the sidebar.")
      .addToggle((t) => t.setValue(s.fileExplorerIcons).onChange(async (v) => {
        s.fileExplorerIcons = v;
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
      }));

    new Setting(containerEl)
      .setName("Tab icons")
      .setDesc("Show icons in the tab headers of open notes.")
      .addToggle((t) => t.setValue(s.tabIcons).onChange(async (v) => {
        s.tabIcons = v;
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
      }));

    new Setting(containerEl)
      .setName("Icon above note title")
      .setDesc("Show the resolved icon above the note title (reading view).")
      .addToggle((t) => t.setValue(s.inlineTitleIcons).onChange(async (v) => {
        s.inlineTitleIcons = v;
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
      }));

    new Setting(containerEl)
      .setName("…also in edit mode")
      .setDesc("Show the title icon in the editor too (inserted as non-editable content).")
      .setDisabled(!s.inlineTitleIcons)
      .addToggle((t) => t.setValue(s.inlineTitleEditMode).onChange(async (v) => {
        s.inlineTitleEditMode = v;
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
      }));

    new Setting(containerEl)
      .setName("Icon source tooltips")
      .setDesc("Hover a file to see which icon applies and which rule decided it.")
      .addToggle((t) => t.setValue(s.showSourceTooltips).onChange(async (v) => {
        s.showSourceTooltips = v;
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
      }));

    new Setting(containerEl)
      .setName("Status bar indicator")
      .setDesc("Show the active note's icon + source in the status bar.")
      .addToggle((t) => t.setValue(s.statusBarIndicator).onChange(async (v) => {
        s.statusBarIndicator = v;
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();
      }));

    new Setting(containerEl)
      .setName("Refresh icons")
      .setDesc("Re-apply icons everywhere (after Obsidian updates or UI glitches).")
      .addButton((b) => b.setButtonText("Refresh now").onClick(() => {
        this.plugin.refreshIcons();
        new Notice("Icons refreshed");
      }));
  }

  /* --- packs ---------------------------------------------------------------- */

  private renderPacks(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    new Setting(containerEl).setName("Icon packs").setHeading();
    containerEl.createDiv({
      cls: "setting-item-description",
      text: `${TOTAL_ICON_COUNT} icons bundled offline — no network needed.`,
    });

    const descriptions: Record<PackId, string> = {
      lucide: "The de-facto Obsidian icon set. 2025 icons, official tags.",
      material: "Google Material Symbols (curated subset, rounded weight).",
      star: "Original hand-crafted star icons — the Star Icons identity.",
    };

    for (const pack of ["lucide", "material", "star"] as PackId[]) {
      const setting = new Setting(containerEl)
        .setName(PACK_LABELS[pack])
        .setDesc(`${descriptions[pack]} v${PACK_VERSIONS[pack]}`)
        .addToggle((t) =>
          t.setValue(s.enabledPacks[pack] !== false).onChange(async (v) => {
            s.enabledPacks[pack] = v;
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
          }),
        );
      const preview = setting.settingEl.createDiv({ cls: "si-pack-preview" });
      const samples = ["home", "folder", "star", "heart", "settings", "file-text", "music", "cloud"];
      for (const name of samples) {
        const def = getIcon(`si-${pack}-${name}`);
        if (def) {
          const ic = preview.createSpan({ cls: "si-pack-sample" });
          renderIcon(ic, def.id, 16);
        }
      }
    }
  }

  /* --- file types ------------------------------------------------------------ */

  private renderFileTypes(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    new Setting(containerEl).setName("File type icons").setHeading();
    containerEl.createDiv({
      cls: "setting-item-description",
      text: "Fallback icons for file extensions (used when no rule matches). Priority: override > rules > this > default.",
    });

    const listEl = containerEl.createDiv({ cls: "si-filetype-list" });
    const render = () => {
      listEl.empty();

      const defaultRow = this.fileTypeRow(listEl, "*", s.defaultIcon ?? null, "Default icon");
      void defaultRow;

      for (const [ext, iconId] of Object.entries(s.fileTypeDefaults)) {
        this.fileTypeRow(listEl, ext, iconId, `.${ext} files`);
      }

      const addRow = listEl.createDiv({ cls: "si-filetype-add" });
      const input = addRow.createEl("input", {
        cls: "si-text-input",
        attr: { placeholder: "ext (e.g. md)", spellcheck: "false" },
      }) as HTMLInputElement;
      const pick = addRow.createEl("button", { cls: "si-btn", attr: { type: "button" } });
      pick.createSpan({ text: "Add" });
      pick.addEventListener("click", () => {
        const ext = normalizeExt(input.value);
        if (!ext) return;
        new IconPickerModal(this.app, () => this.plugin.store, {
          title: `Icon for .${ext} files`,
          onPick: (icon) => {
            if (!icon) return;
            s.fileTypeDefaults[ext] = icon.id;
            void this.plugin.saveSettings().then(() => {
              this.plugin.refreshIcons();
              render();
            });
          },
        }).open();
      });
    };
    render();
  }

  private fileTypeRow(
    listEl: HTMLElement,
    ext: string,
    iconId: string | null,
    label: string,
  ): void {
    const s = this.plugin.settings;
    const row = listEl.createDiv({ cls: "si-filetype-row" });
    const labelEl = row.createSpan({ cls: "si-filetype-label", text: label });
    void labelEl;
    const preview = row.createSpan({ cls: "si-filetype-icon" });
    if (iconId) renderIcon(preview, iconId, 18);
    else preview.setText("—");

    const change = row.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    change.createSpan({ text: "Change" });
    change.addEventListener("click", () => {
      new IconPickerModal(this.app, () => this.plugin.store, {
        title: `Icon for ${label}`,
        onPick: (icon) => {
          if (ext === "*") {
            s.defaultIcon = icon ? icon.id : null;
          } else if (icon) {
            s.fileTypeDefaults[ext] = icon.id;
          } else {
            delete s.fileTypeDefaults[ext];
          }
          void this.plugin.saveSettings().then(() => {
            this.plugin.refreshIcons();
            this.display();
          });
        },
      }).open();
    });

    if (ext !== "*") {
      const remove = row.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
      setIcon(remove, "x");
      remove.addEventListener("click", async () => {
        delete s.fileTypeDefaults[ext];
        await this.plugin.saveSettings();
        this.plugin.refreshIcons();
        this.display();
      });
    }
  }

  /* --- rules ----------------------------------------------------------------- */

  private renderRules(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    new Setting(containerEl).setName("Rules").setHeading();
    containerEl.createDiv({
      cls: "setting-item-description",
      text: "Rules run top-to-bottom; the first enabled match wins. Drag to reorder.",
    });

    const listEl = containerEl.createDiv({ cls: "si-rule-list" });
    const render = () => {
      listEl.empty();
      if (s.rules.length === 0) {
        listEl.createDiv({ cls: "si-empty", text: "No rules yet — add your first rule" });
      }
      s.rules.forEach((rule, index) => {
        const row = listEl.createDiv({
          cls: "si-rule-row",
          attr: { draggable: "true", "data-index": String(index) },
        });

        const handle = row.createSpan({ cls: "si-drag-handle" });
        setIcon(handle, "grip-vertical");

        const toggle = row.createEl("button", {
          cls: "si-toggle" + (rule.enabled ? " is-on" : ""),
          attr: { type: "button", "aria-label": "Enable rule" },
        });
        toggle.addEventListener("click", async () => {
          rule.enabled = !rule.enabled;
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          render();
        });

        const body = row.createDiv({ cls: "si-rule-body" });
        body.createDiv({ cls: "si-rule-name", text: rule.name });
        body.createDiv({ cls: "si-rule-summary", text: summarizeRule(rule) });

        const actionPreview = row.createSpan({ cls: "si-rule-action" });
        const action = rule.action;
        if (action.type === "icon") {
          renderIcon(actionPreview, action.iconId, 18);
        } else if (action.type === "random") {
          const col = s.collections.find((c) => c.id === action.collectionId);
          actionPreview.setText(`🎲 ${col?.name ?? "collection"}`);
        } else {
          actionPreview.setText("default");
        }

        const edit = row.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
        setIcon(edit, "pencil");
        edit.addEventListener("click", () => {
          new RuleEditModal(this.app, this.plugin.store, () => this.plugin.settings, async (r) => {
            const i = s.rules.findIndex((x) => x.id === r.id);
            if (i >= 0) s.rules[i] = r;
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
            render();
          }, rule).open();
        });

        const remove = row.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
        setIcon(remove, "trash");
        remove.addEventListener("click", async () => {
          s.rules = s.rules.filter((x) => x.id !== rule.id);
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          render();
        });

        row.appendChild(handle);
        row.appendChild(toggle);
        row.appendChild(body);
        row.appendChild(actionPreview);
        row.appendChild(edit);
        row.appendChild(remove);
      });

      makeSortable(listEl, {
        onReorder: async (from, to) => {
          const [moved] = s.rules.splice(from, 1);
          s.rules.splice(to, 0, moved);
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          render();
        },
      });
    };
    render();

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("＋ Add rule").setCta().onClick(() => {
        new RuleEditModal(this.app, this.plugin.store, () => this.plugin.settings, async (r) => {
          s.rules.push(r);
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          this.display();
        }).open();
      }),
    );
  }

  /* --- collections -------------------------------------------------------------- */

  private renderCollections(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    new Setting(containerEl).setName("Collections").setHeading();
    containerEl.createDiv({
      cls: "setting-item-description",
      text: "Curate icon sets here; drag & drop in the Icon Manager. Used by “random” rule actions.",
    });
    const list = containerEl.createDiv({ cls: "si-col-summary" });
    if (s.collections.length === 0) {
      list.createDiv({ cls: "si-empty", text: "No collections yet" });
    }
    for (const col of s.collections) {
      const row = list.createDiv({ cls: "si-col-summary-row" });
      const icon = row.createSpan({ cls: "si-side-item-icon" });
      renderIcon(icon, col.iconIds[0] ?? "si-lucide-folder");
      row.createSpan({ cls: "si-col-summary-name", text: col.name });
      row.createSpan({ cls: "si-col-summary-count", text: `${col.iconIds.length} icons` });
      const open = row.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
      open.createSpan({ text: "Manage" });
      open.addEventListener("click", () => void this.plugin.openManager());
    }
    new Setting(containerEl).addButton((b) =>
      b.setButtonText("Open Icon Manager").onClick(() => void this.plugin.openManager()),
    );
  }

  /* --- data ------------------------------------------------------------------------ */

  private renderData(): void {
    const { containerEl } = this;
    new Setting(containerEl).setName("Data").setHeading();

    new Setting(containerEl)
      .setName("Export")
      .setDesc("Download your overrides, rules, collections, favorites and tags as JSON.")
      .addButton((b) =>
        b.setButtonText("Export JSON").onClick(() => {
          downloadJson("star-icons-settings.json", this.plugin.settings);
        }),
      );

    new Setting(containerEl)
      .setName("Import")
      .setDesc("Restore from an exported JSON file.")
      .addButton((b) => {
        b.setButtonText("Import JSON").onClick(() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json";
          input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              this.plugin.settings = mergeSettings(JSON.parse(text));
              await this.plugin.saveSettings();
              this.plugin.refreshIcons();
              this.display();
              new Notice("Settings imported");
            } catch {
              new Notice("Could not parse that JSON file");
            }
          });
          input.click();
        });
      });

    new Setting(containerEl)
      .setName("Reset")
      .setDesc("Restore factory defaults (favorites, rules, collections…).")
      .addButton((b) =>
        b.setButtonText("Reset all").setWarning().onClick(async () => {
          const confirmed = window.confirm("Reset all Star Icons settings? This cannot be undone.");
          if (!confirmed) return;
          this.plugin.settings = mergeSettings(undefined);
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          this.display();
        }),
      );
  }
}
