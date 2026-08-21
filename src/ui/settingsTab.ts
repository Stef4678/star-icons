/**
 * Star Icons — settings tab.
 *
 * Uses Obsidian's declarative settings API (1.13.0+): getSettingDefinitions()
 * returns searchable definitions, with `render` callbacks hosting the complex
 * sections (pack list, file-type rows, draggable rules, collections, data).
 */

import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  SettingDefinition,
  SettingDefinitionItem,
  setIcon,
} from "obsidian";
import type { StarIconsPlugin } from "../main";
import { getIcon } from "../data/icons";
import { PACK_GROUPS, PACK_LABELS, PackId, Rule, ALL_PACKS, DEFAULT_REPORT_URL } from "../types";
import { mergeSettings } from "../settings";
import { downloadJson, normalizeExt } from "../utils";
import { makeSortable, renderIcon } from "./components";
import { IconPickerModal } from "./iconPicker";
import { RuleEditModal } from "./ruleEditor";
import { confirmDialog } from "./promptModal";
import { ReportBugModal, obsidianVersion } from "./reportBugModal";

export function summarizeRule(rule: Rule): string {
  if (rule.conditions.length === 0) return "matches everything";
  const parts = rule.conditions.map((c) => {
    switch (c.type) {
      case "time": {
        const days = c.days?.length ? c.days.map((d) => "SMTWTFS"[d]).join("") + " " : "";
        return `time ${days}${c.from ?? "…"}–${c.to ?? "…"}`;
      }
      case "property":
        return `property ${c.key} ${c.op} ${c.value ?? ""}`.trim();
      default:
        return `${c.type} ${c.op} “${c.value ?? ""}”`;
    }
  });
  return parts.join(rule.match === "all" ? " AND " : " OR ");
}

export class StarIconsSettingTab extends PluginSettingTab {
  private packDescriptions: Partial<Record<PackId, string>> = {
    lucide: "The de-facto Obsidian icon set. 2,025 icons, official tags.",
    material: "Google Material Symbols — full rounded set (base + fill variants).",
    "material-outlined": "The same Material set in the outlined weight.",
    "material-sharp": "The same Material set in the sharp weight.",
    star: "Original hand-crafted star icons — the Star Icons identity.",
    tabler: "Tabler outline — 5,130 clean, modern icons with categories.",
    "tabler-filled": "Tabler filled — 1,054 solid versions of the outline set.",
    unicons: "Iconscout Unicons (line style) — 1,215 playful icons.",
    "unicons-solid": "Unicons in the solid style.",
    "unicons-monochrome": "Unicons in the monochrome style.",
    "unicons-thinline": "Unicons in the thinline style.",
    remix: "Remix Icon — 3,078 icons (line + fill) across 20 categories.",
    phosphor: "Phosphor (regular weight) — 1,512 geometric icons.",
    "phosphor-bold": "Phosphor in the bold weight.",
    "phosphor-fill": "Phosphor in the fill weight.",
    "phosphor-light": "Phosphor in the light weight.",
    "phosphor-thin": "Phosphor in the thin weight.",
    "phosphor-duotone": "Phosphor in the duotone weight (two-tone).",
    bootstrap: "Bootstrap Icons — 2,078 crisp, rounded icons.",
    boxicons: "Boxicons — 814 filled, rounded web icons.",
    "boxicons-solid": "Boxicons in the solid style.",
    "boxicons-logos": "Boxicons brand logos.",
    heroicons: "Heroicons — 324 outline icons by the Tailwind team.",
    "heroicons-solid": "Heroicons in the solid style.",
    fontawesome: "Font Awesome Free — 2,274 solid + regular icons (CC BY 4.0).",
    "simple-icons": "Simple Icons — 3,453 brand logos (CC0).",
    ionicons: "Ionicons — 1,357 icons (base + outline + sharp).",
    antd: "Ant Design Icons — outlined/filled/twotone variants.",
    "line-awesome": "Line Awesome — 1,544 line-style icons (includes brands).",
    eva: "Eva Icons — 490 outline + fill icons.",
    octicons: "Octicons — 743 GitHub-style icons (all sizes).",
    openmoji: "OpenMoji Color — 1,718 full-color emoji SVGs (CC BY-SA 4.0).",
    "openmoji-black": "OpenMoji monochrome — 1,860 line-drawn emoji.",
    twemoji: "Twemoji — 4,009 full-color emoji SVGs (CC BY 4.0).",
    fluent: "Fluent Emoji — 3,145 full-color flat emoji (MIT).",
    animals: "Emoji animals — pets & wildlife, rendered with your system emoji font.",
    nature: "Emoji flowers & plants — from your system emoji font.",
    science: "Emoji science & space — from your system emoji font.",
  };

  constructor(
    app: App,
    private plugin: StarIconsPlugin,
  ) {
    super(app, plugin);
  }

  /**
   * Declarative settings — rendered by Obsidian 1.13+ and indexed in the
   * settings search. Simple toggles are real control definitions; complex
   * sections mount their imperative UI through `render` callbacks.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;

    const toggle = (
      name: string,
      desc: string,
      get: () => boolean,
      apply: (v: boolean) => void,
    ): SettingDefinition => ({
      name,
      desc,
      render: (setting) => {
        setting.addToggle((t) =>
          t.setValue(get()).onChange((v) => apply(v)),
        );
      },
    });

    return [
      /* --- General --- */
      {
        type: "group",
        heading: "General",
        items: [
          toggle("File explorer icons", "Show resolved icons on files and folders in the sidebar.",
            () => s.fileExplorerIcons, (v) => {
              s.fileExplorerIcons = v;
              void this.plugin.saveSettings();
              this.plugin.refreshIcons();
            }),
          toggle("Tab icons", "Show icons in the tab headers of open notes.",
            () => s.tabIcons, (v) => {
              s.tabIcons = v;
              void this.plugin.saveSettings();
              this.plugin.refreshIcons();
            }),
          toggle("Icon above note title", "Show the resolved icon above the note title (reading view).",
            () => s.inlineTitleIcons, (v) => {
              s.inlineTitleIcons = v;
              void this.plugin.saveSettings();
              this.plugin.refreshIcons();
            }),
          {
            name: "…also in edit mode",
            desc: "Show the title icon in the editor too (inserted as non-editable content).",
            render: (setting) => {
              setting.addToggle((t) =>
                t
                  .setValue(s.inlineTitleEditMode)
                  .setDisabled(!s.inlineTitleIcons)
                  .onChange((v) => {
                    s.inlineTitleEditMode = v;
                    void this.plugin.saveSettings();
                    this.plugin.refreshIcons();
                  }),
              );
            },
          },
          toggle("Icon source tooltips", "Hover a file to see which icon applies and which rule decided it.",
            () => s.showSourceTooltips, (v) => {
              s.showSourceTooltips = v;
              void this.plugin.saveSettings();
              this.plugin.refreshIcons();
            }),
          toggle("Status bar indicator", "Show the active note's icon + source in the status bar.",
            () => s.statusBarIndicator, (v) => {
              s.statusBarIndicator = v;
              void this.plugin.saveSettings();
              this.plugin.updateStatusBar();
            }),
          {
            name: "Refresh icons",
            desc: "Re-apply icons everywhere (after Obsidian updates or UI glitches).",
            render: (setting) => {
              setting.addButton((b) =>
                b.setButtonText("Refresh now").onClick(() => {
                  this.plugin.refreshIcons();
                  new Notice("Icons refreshed");
                }),
              );
            },
          },
        ],
      },

      /* --- Packs --- */
      {
        name: `${this.plugin.store.totalCount().toLocaleString()} icons available`,
        desc: "Packs load on demand when enabled (downloaded once if missing, then cached locally).",
      },
      ...PACK_GROUPS.map((group) => ({
        type: "group" as const,
        heading: group.title,
        items: group.packs.map((pack) => this.packSetting(pack)),
      })),

      /* --- Complex sections (mounted imperatively) --- */
      {
        name: "File type icons",
        desc: "Fallback icons for file extensions (used when no rule matches). Priority: override > rules > this > default.",
        render: (setting) => this.mountSection(setting, (el) => this.renderFileTypes(el)),
      },
      {
        name: "Rules",
        desc: "Rules run top-to-bottom; the first enabled match wins. Drag to reorder.",
        render: (setting) => this.mountSection(setting, (el) => this.renderRules(el)),
      },
      {
        name: "Collections",
        desc: "Curate icon sets here; drag & drop in the Icon Manager. Used by “random” rule actions.",
        render: (setting) => this.mountSection(setting, (el) => this.renderCollections(el)),
      },
      {
        name: "Data",
        desc: "Export, import, reset and diagnostics.",
        render: (setting) => this.mountSection(setting, (el) => this.renderData(el)),
      },

      /* --- About --- */
      {
        type: "group",
        heading: "About",
        items: [
          {
            name: "Licenses and Attribution",
            desc: "Project license, third-party pack licenses, required credit lines and trademark notices.",
            render: (setting) => this.mountSection(setting, (el) => this.renderAbout(el)),
          },
        ],
      },
    ];
  }

  /** A searchable pack row: toggle + live icon previews. */
  private packSetting(pack: PackId): SettingDefinition {
    const s = this.plugin.settings;
    return {
      name: PACK_LABELS[pack] ?? pack,
      desc: `${this.packDescriptions[pack] ?? "Icon pack"} · v${this.plugin.store.getPackVersion(pack)} · ${this.plugin.store.getPackCount(pack).toLocaleString()} icons`,
      render: (setting) => {
        setting.addToggle((t) =>
          t.setValue(s.enabledPacks[pack] !== false).onChange((v) => {
            s.enabledPacks[pack] = v;
            void (async () => {
              await this.plugin.saveSettings();
              if (v) await this.plugin.store.loadPack(pack);
              this.plugin.store.notify(); // keep open views (manager totals) in sync on BOTH enable and disable
              this.plugin.refreshIcons();
            })();
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
      },
    };
  }

  /** Give a section row a full-width box that hosts the imperative UI. */
  private mountSection(setting: Setting, build: (el: HTMLElement) => void): void {
    setting.settingEl.addClass("si-section");
    build(setting.settingEl.createDiv({ cls: "si-settings-box" }));
  }

  /* --- file types ------------------------------------------------------------ */

  private renderFileTypes(el: HTMLElement): void {
    const s = this.plugin.settings;

    const listEl = el.createDiv({ cls: "si-filetype-list" });
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
      });
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
            this.update();
          });
        },
      }).open();
    });

    if (ext !== "*") {
      const remove = row.createEl("button", { cls: "si-icon-btn", attr: { type: "button" } });
      setIcon(remove, "x");
      remove.addEventListener("click", () => {
        void (async () => {
          delete s.fileTypeDefaults[ext];
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          this.update();
        })();
      });
    }
  }

  /* --- rules ----------------------------------------------------------------- */

  private renderRules(el: HTMLElement): void {
    const s = this.plugin.settings;

    const listEl = el.createDiv({ cls: "si-rule-list" });
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
        toggle.addEventListener("click", () => {
          void (async () => {
            rule.enabled = !rule.enabled;
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
            render();
          })();
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
        remove.addEventListener("click", () => {
          void (async () => {
            s.rules = s.rules.filter((x) => x.id !== rule.id);
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
            render();
          })();
        });

        row.appendChild(handle);
        row.appendChild(toggle);
        row.appendChild(body);
        row.appendChild(actionPreview);
        row.appendChild(edit);
        row.appendChild(remove);
      });

      makeSortable(listEl, {
        onReorder: (from, to) => {
          void (async () => {
            const [moved] = s.rules.splice(from, 1);
            s.rules.splice(to, 0, moved);
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
            render();
          })();
        },
      });
    };
    render();

    new Setting(el).addButton((b) =>
      b.setButtonText("＋ Add rule").setCta().onClick(() => {
        new RuleEditModal(this.app, this.plugin.store, () => this.plugin.settings, async (r) => {
          s.rules.push(r);
          await this.plugin.saveSettings();
          this.plugin.refreshIcons();
          this.update();
        }).open();
      }),
    );
  }

  /* --- collections -------------------------------------------------------------- */

  private renderCollections(el: HTMLElement): void {
    const s = this.plugin.settings;
    const list = el.createDiv({ cls: "si-col-summary" });
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
    new Setting(el).addButton((b) =>
      b.setButtonText("Open Icon Manager").onClick(() => void this.plugin.openManager()),
    );
  }

  /* --- data ------------------------------------------------------------------------ */

  private renderData(el: HTMLElement): void {
    new Setting(el)
      .setName("Export")
      .setDesc("Download your overrides, rules, collections, favorites and tags as JSON.")
      .addButton((b) =>
        b.setButtonText("Export JSON").onClick(() => {
          downloadJson("star-icons-settings.json", this.plugin.settings);
        }),
      );

    new Setting(el)
      .setName("Import")
      .setDesc("Restore from an exported JSON file.")
      .addButton((b) => {
        b.setButtonText("Import JSON").onClick(() => {
          const input = createEl("input", { attr: { type: "file", accept: "application/json" } });
          input.addEventListener("change", () => {
            void (async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                this.plugin.settings = mergeSettings(JSON.parse(text));
                await this.plugin.saveSettings();
                this.plugin.refreshIcons();
                this.update();
                new Notice("Settings imported");
              } catch {
                new Notice("Could not parse that JSON file");
              }
            })();
          });
          input.click();
        });
      });

    new Setting(el)
      .setName("Reset")
      .setDesc("Restore factory defaults (favorites, rules, collections…).")
      .addButton((b) =>
        b.setButtonText("Reset all").setDestructive().onClick(() => {
          void (async () => {
            const confirmed = await confirmDialog(this.app, {
              title: "Reset all Star Icons settings?",
              message: "This cannot be undone.",
              confirmLabel: "Reset all",
              danger: true,
            });
            if (!confirmed) return;
            this.plugin.settings = mergeSettings(undefined);
            await this.plugin.saveSettings();
            this.plugin.refreshIcons();
            this.update();
          })();
        }),
      );

    new Setting(el)
      .setName("Report a bug")
      .setDesc("Copy a diagnostic report (versions, platform, pack state) to paste into an issue.")
      .addButton((b) =>
        b.setButtonText("Open report dialog").onClick(() => {
          new ReportBugModal(this.app, {
            pluginVersion: this.plugin.manifest.version,
            appVersion: obsidianVersion(this.app),
            packs: ALL_PACKS.length,
            enabledPacks: ALL_PACKS.filter((p) => this.plugin.settings.enabledPacks[p] !== false).length,
            icons: this.plugin.store.totalCount(),
            reportUrl: this.plugin.settings.reportUrl || DEFAULT_REPORT_URL,
          }).open();
        }),
      );

    new Setting(el)
      .setName("Issue tracker URL (optional)")
      .setDesc("If set, the bug report dialog gets an “Open issue page” button.")
      .addText((t) =>
        t
          .setPlaceholder("https://github.com/you/star-icons/issues")
          .setValue(this.plugin.settings.reportUrl)
          .onChange(async (v) => {
            this.plugin.settings.reportUrl = v.trim();
            await this.plugin.saveSettings();
          }),
      );
  }

  /* --- about ------------------------------------------------------------------------- */

  private renderAbout(el: HTMLElement): void {
    new Setting(el)
      .setName("Star Icons")
      .setDesc(`Version ${this.plugin.manifest.version} · MIT License`)
      .addButton((b) =>
        b.setButtonText("Report a bug").onClick(() => {
          new ReportBugModal(this.app, {
            pluginVersion: this.plugin.manifest.version,
            appVersion: obsidianVersion(this.app),
            packs: ALL_PACKS.length,
            enabledPacks: ALL_PACKS.filter((p) => this.plugin.settings.enabledPacks[p] !== false).length,
            icons: this.plugin.store.totalCount(),
            reportUrl: this.plugin.settings.reportUrl || DEFAULT_REPORT_URL,
          }).open();
        }),
      );

    const box = el.createDiv({ cls: "si-licenses" });
    const heading = (text: string) => box.createEl("h4", { text });
    const para = (text: string) => box.createEl("p", { text });

    heading("Project license");
    para(
      "The Star Icons source code and original Star Icons assets are licensed under the MIT License. Third-party icon packs are not relicensed under MIT — each bundled pack keeps its original license.",
    );

    heading("Third-party packs");
    para(
      "Lucide (ISC) · Material Symbols incl. Outlined/Sharp (Apache 2.0) · Tabler & Tabler Filled (MIT) · Bootstrap Icons (MIT) · Phosphor, all weights (MIT) · Heroicons & Solid (MIT) · Ionicons (MIT) · Ant Design (MIT) · Line Awesome (MIT) · Boxicons incl. Solid/Logos (MIT) · Octicons (MIT) · Eva Icons (MIT) · Fluent Emoji (MIT) · Remix Icon (Remix Icon License v1.0) · Unicons, all styles (IconScout Simple License) · OpenMoji Color/Mono (CC BY-SA 4.0) · Twemoji (CC BY 4.0) · Font Awesome Free (CC BY 4.0 · OFL 1.1 · MIT) · Simple Icons (CC0 1.0) · Animals/Nature/Science (your system emoji font) · Star Icons (MIT, original).",
    );

    heading("Required attribution");
    para(
      "Twemoji graphics — Twitter, Inc. (https://twemoji.twitter.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).",
    );
    para(
      "Font Awesome Free — Fonticons, Inc. (https://fontawesome.com), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).",
    );
    para(
      "OpenMoji — https://openmoji.org, licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).",
    );

    heading("Trademarks");
    para(
      "Brand icons are trademarks of their respective owners. Their inclusion does not imply sponsorship, endorsement, affiliation, or ownership by Star Icons.",
    );
  }
}
