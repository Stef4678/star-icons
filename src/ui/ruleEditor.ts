/**
 * Star Icons — the rule editor modal.
 *
 * A guided, visual editor for rules: name + match mode, condition rows with
 * type-specific controls (including clock/time conditions), an action picker
 * that opens the icon picker, and a LIVE preview showing which files match.
 */

import { App, Modal, Notice, setIcon } from "obsidian";
import { IconStore } from "../core/iconStore";
import { buildFileContext, evaluateCondition } from "../core/ruleEngine";
import { getIcon } from "../data/icons";
import {
  CompareOp,
  ConditionType,
  CONDITION_LABELS,
  OP_LABELS,
  Rule,
  RuleCondition,
  StarIconsSettings,
} from "../types";
import { debounce, uid } from "../utils";
import { emptyState, renderIcon, segmentedControl } from "./components";
import { IconPickerModal } from "./iconPicker";

const TYPE_OPS: Record<ConditionType, CompareOp[]> = {
  filename: ["equals", "contains", "startsWith", "endsWith", "matches"],
  path: ["equals", "contains", "startsWith", "endsWith", "matches"],
  extension: ["equals", "isIn", "isNotIn"],
  folder: ["isIn", "isNotIn", "contains", "matches"],
  tag: ["equals", "contains", "startsWith"],
  property: ["exists", "notExists", "equals", "contains"],
  heading: ["equals", "contains", "startsWith"],
  time: ["equals"],
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export class RuleEditModal extends Modal {
  private rule: Rule;
  private previewEl!: HTMLElement;
  private refreshPreview!: () => void;

  constructor(
    app: App,
    private store: IconStore,
    private getSettings: () => StarIconsSettings,
    private saveRule: (rule: Rule) => Promise<void>,
    existing?: Rule,
  ) {
    super(app);
    this.rule = existing
      ? (JSON.parse(JSON.stringify(existing)) as Rule)
      : {
          id: uid("rule"),
          name: "New rule",
          enabled: true,
          match: "all",
          conditions: [],
          action: { type: "icon", iconId: "si-lucide-star" },
          createdAt: Date.now(),
        };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("si-rule-editor");

    const header = contentEl.createDiv({ cls: "si-rule-header" });
    const nameInput = header.createEl("input", {
      cls: "si-rule-name",
      attr: { placeholder: "Rule name", spellcheck: "false" },
      text: this.rule.name,
    });
    nameInput.value = this.rule.name;
    nameInput.addEventListener("input", () => (this.rule.name = nameInput.value || "Untitled rule"));

    const enabledToggle = header.createEl("button", {
      cls: "si-toggle" + (this.rule.enabled ? " is-on" : ""),
      attr: { type: "button", "aria-label": "Enabled" },
    });
    enabledToggle.addEventListener("click", () => {
      this.rule.enabled = !this.rule.enabled;
      enabledToggle.toggleClass("is-on", this.rule.enabled);
    });

    const matchRow = contentEl.createDiv({ cls: "si-rule-match" });
    matchRow.createSpan({ cls: "si-label", text: "Match" });
    const matchSel = segmentedControl(
      [
        { value: "all", label: "All conditions" },
        { value: "any", label: "Any condition" },
      ],
      this.rule.match,
      (v) => {
        this.rule.match = v as "all" | "any";
        this.refreshPreview();
      },
    );
    matchRow.appendChild(matchSel);

    /* --- conditions --- */
    const condSection = contentEl.createDiv({ cls: "si-rule-section" });
    const condHead = condSection.createDiv({ cls: "si-section-head" });
    condHead.createSpan({ cls: "si-section-title", text: "Conditions" });
    const addBtn = condHead.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    addBtn.createSpan({ text: "+ Add condition" });
    addBtn.addEventListener("click", () => {
      this.rule.conditions.push({
        id: uid("cond"),
        type: "filename",
        op: "contains",
        value: "",
      });
      renderConditions(condSection);
      this.refreshPreview();
    });

    const condList = condSection.createDiv({ cls: "si-cond-list" });
    const renderConditions = (section: HTMLElement) => {
      condList.empty();
      if (this.rule.conditions.length === 0) {
        condList.appendChild(emptyState("No conditions yet", "Add one — e.g. file name contains “note”."));
      }
      this.rule.conditions.forEach((cond, i) => {
        condList.appendChild(this.buildCondRow(cond, i, () => {
          this.rule.conditions.splice(i, 1);
          renderConditions(section);
          this.refreshPreview();
        }));
      });
    };
    renderConditions(condSection);

    /* --- action --- */
    const actionSection = contentEl.createDiv({ cls: "si-rule-section" });
    actionSection.createDiv({ cls: "si-section-title", text: "Action" });
    const actionWrap = actionSection.createDiv({ cls: "si-action-editor" });
    const renderAction = () => {
      actionWrap.empty();
      const seg = segmentedControl(
        [
          { value: "icon", label: "Set icon" },
          { value: "random", label: "Random from collection" },
          { value: "clear", label: "Use Obsidian default" },
        ],
        this.rule.action.type,
        (v) => {
          if (v === "icon") this.rule.action = { type: "icon", iconId: "si-lucide-star" };
          else if (v === "random") this.rule.action = { type: "random", collectionId: this.getSettings().collections[0]?.id ?? "" };
          else this.rule.action = { type: "clear" };
          renderAction();
          this.refreshPreview();
        },
      );
      actionWrap.appendChild(seg);

      if (this.rule.action.type === "icon") {
        const row = actionWrap.createDiv({ cls: "si-action-row" });
        const preview = row.createDiv({ cls: "si-action-preview" });
        const def = getIcon(this.rule.action.iconId);
        if (def) renderIcon(preview, def.id, 32);
        else preview.setText("?");
        const choose = row.createEl("button", { cls: "si-btn", attr: { type: "button" } });
        choose.createSpan({ text: def ? `Change icon (${def.name})` : "Choose icon…" });
        choose.addEventListener("click", () => {
          new IconPickerModal(this.app, () => this.store, {
            title: "Icon for this rule",
            onPick: (icon) => {
              if (icon) {
                this.rule.action = { type: "icon", iconId: icon.id };
                renderAction();
                this.refreshPreview();
              }
            },
          }).open();
        });
      } else if (this.rule.action.type === "random") {
        const row = actionWrap.createDiv({ cls: "si-action-row" });
        row.createSpan({ cls: "si-label", text: "Collection" });
        const select = row.createEl("select", { cls: "dropdown" });
        const cols = this.getSettings().collections;
        if (cols.length === 0) {
          select.createEl("option", { text: "No collections yet — create one in the Manager", value: "" });
        }
        for (const c of cols) {
          select.createEl("option", { text: `${c.name} (${c.iconIds.length})`, value: c.id });
        }
        select.value = this.rule.action.collectionId;
        select.addEventListener("change", () => {
          this.rule.action = { type: "random", collectionId: select.value };
        });
      } else {
        actionWrap.createDiv({ cls: "si-hint", text: "The file/folder keeps Obsidian's built-in icon." });
      }
    };
    renderAction();

    /* --- live preview --- */
    const previewSection = contentEl.createDiv({ cls: "si-rule-section" });
    const previewHead = previewSection.createDiv({ cls: "si-section-head" });
    previewHead.createSpan({ cls: "si-section-title", text: "Live preview" });
    this.previewEl = previewSection.createDiv({ cls: "si-preview-list" });

    this.refreshPreview = debounce(() => this.renderPreview(), 180);
    this.refreshPreview();

    /* --- footer --- */
    const footer = contentEl.createDiv({ cls: "si-rule-footer" });
    const cancel = footer.createEl("button", { cls: "si-btn", attr: { type: "button" } });
    cancel.createSpan({ text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const save = footer.createEl("button", {
      cls: "si-btn si-btn-primary",
      attr: { type: "button" },
    });
    save.createSpan({ text: "Save rule" });
    save.addEventListener("click", () => {
      void (async () => {
        if (!this.rule.name.trim()) {
          new Notice("Give the rule a name first.");
          return;
        }
        await this.saveRule(this.rule);
        new Notice(`Rule “${this.rule.name}” saved`);
        this.close();
      })();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildCondRow(cond: RuleCondition, index: number, onRemove: () => void): HTMLElement {
    const row = createDiv({
      cls: "si-cond-row",
      attr: { "data-index": String(index) },
    });

    const typeSel = row.createEl("select", { cls: "dropdown si-cond-type" });
    for (const t of Object.keys(TYPE_OPS) as ConditionType[]) {
      typeSel.createEl("option", { text: CONDITION_LABELS[t], value: t });
    }
    typeSel.value = cond.type;
    typeSel.addEventListener("change", () => {
      cond.type = typeSel.value as ConditionType;
      cond.op = TYPE_OPS[cond.type][0];
      cond.value = cond.value ?? "";
      this.rebuildRow(row, cond, index, onRemove);
      this.refreshPreview();
    });

    row.appendChild(typeSel);
    this.appendOpAndValue(row, cond, onRemove);

    const remove = row.createEl("button", {
      cls: "si-icon-btn si-cond-remove",
      attr: { type: "button", "aria-label": "Remove condition" },
    });
    setIcon(remove, "x");
    remove.addEventListener("click", onRemove);

    return row;
  }

  /** Rebuild a row in place after a type change. */
  private rebuildRow(row: HTMLElement, cond: RuleCondition, index: number, onRemove: () => void): void {
    row.empty();
    const typeSel = row.createEl("select", { cls: "dropdown si-cond-type" });
    for (const t of Object.keys(TYPE_OPS) as ConditionType[]) {
      typeSel.createEl("option", { text: CONDITION_LABELS[t], value: t });
    }
    typeSel.value = cond.type;
    typeSel.addEventListener("change", () => {
      cond.type = typeSel.value as ConditionType;
      cond.op = TYPE_OPS[cond.type][0];
      cond.value = cond.value ?? "";
      this.rebuildRow(row, cond, index, onRemove);
      this.refreshPreview();
    });
    row.appendChild(typeSel);
    this.appendOpAndValue(row, cond, onRemove);
    const remove = row.createEl("button", { cls: "si-icon-btn si-cond-remove", attr: { type: "button" } });
    setIcon(remove, "x");
    remove.addEventListener("click", onRemove);
  }

  private appendOpAndValue(row: HTMLElement, cond: RuleCondition, _onRemove: () => void): void {
    const ops = TYPE_OPS[cond.type];
    const opSel = row.createEl("select", { cls: "dropdown si-cond-op" });
    for (const op of ops) opSel.createEl("option", { text: OP_LABELS[op], value: op });
    if (!ops.includes(cond.op)) cond.op = ops[0];
    opSel.value = cond.op;
    row.appendChild(opSel);

    const valueWrap = row.createDiv({ cls: "si-cond-value" });
    const renderValues = () => {
      valueWrap.empty();
      if (cond.type === "time") {
        const daysWrap = valueWrap.createDiv({ cls: "si-day-chips" });
        for (let d = 0; d < 7; d++) {
          const chip = daysWrap.createEl("button", {
            cls: "si-day-chip" + (cond.days?.includes(d) ? " is-on" : ""),
            attr: { type: "button" },
            text: DAY_LABELS[d],
          });
          chip.addEventListener("click", () => {
            cond.days = cond.days ?? [];
            const i = cond.days.indexOf(d);
            if (i >= 0) cond.days.splice(i, 1);
            else cond.days.push(d);
            chip.toggleClass("is-on", cond.days.includes(d));
          });
        }
        const from = valueWrap.createEl("input", {
          cls: "si-text-input si-time-input",
          attr: { type: "time" },
        });
        from.value = cond.from ?? "";
        from.addEventListener("input", () => (cond.from = from.value));
        valueWrap.appendChild(from);
        const to = valueWrap.createEl("input", {
          cls: "si-text-input si-time-input",
          attr: { type: "time" },
        });
        to.value = cond.to ?? "";
        to.addEventListener("input", () => (cond.to = to.value));
        valueWrap.appendChild(to);
        return;
      }

      if (cond.type === "property") {
        const key = valueWrap.createEl("input", {
          cls: "si-text-input si-cond-key",
          attr: { placeholder: "property key (e.g. type)", spellcheck: "false" },
        });
        key.value = cond.key ?? "";
        key.addEventListener("input", () => (cond.key = key.value));
        valueWrap.appendChild(key);
        if (cond.op === "equals" || cond.op === "contains") {
          const val = valueWrap.createEl("input", {
            cls: "si-text-input",
            attr: { placeholder: "value", spellcheck: "false" },
          });
          val.value = cond.value ?? "";
          val.addEventListener("input", () => {
            cond.value = val.value;
            this.refreshPreview();
          });
          valueWrap.appendChild(val);
        }
        return;
      }

      const valueInput = valueWrap.createEl("input", {
        cls: "si-text-input",
        attr: {
          placeholder: cond.type === "extension" ? "md, pdf, png (comma separated)" : "value",
          spellcheck: "false",
        },
      });
      valueInput.value = cond.value ?? "";
      valueInput.addEventListener("input", () => {
        cond.value = valueInput.value;
        this.refreshPreview();
      });
      valueWrap.appendChild(valueInput);
    };
    renderValues();
    opSel.addEventListener("change", () => {
      cond.op = opSel.value as CompareOp;
      renderValues();
      this.refreshPreview();
    });
    row.appendChild(valueWrap);
  }

  private renderPreview(): void {
    this.previewEl.empty();
    const files = this.app.vault.getFiles();
    const matches: { name: string; iconId: string | null; count: number; isFolder: boolean }[] = [];
    let evaluated = 0;
    for (const file of files) {
      const ctx = buildFileContext(file, this.app);
      const count = this.rule.conditions.filter((c) => evaluateCondition(c, ctx)).length;
      const total = this.rule.conditions.length;
      if (total === 0) break;
      const matched = this.rule.match === "all" ? count === total : count > 0;
      if (!matched) continue;
      evaluated++;
      matches.push({
        name: file.path,
        iconId: this.rule.action.type === "icon" ? this.rule.action.iconId : null,
        count,
        isFolder: false,
      });
      if (matches.length >= 20) break;
    }

    if (this.rule.conditions.length === 0) {
      this.previewEl.appendChild(emptyState("Add a condition to see matching files", "Matches update as you type."));
      return;
    }
    const head = this.previewEl.createDiv({ cls: "si-preview-head" });
    head.createSpan({
      cls: "si-preview-count",
      text: `Matches ${matches.length >= 20 ? "20+ of " : ""}${evaluated} file${evaluated === 1 ? "" : "s"} in this vault`,
    });
    void head;

    if (matches.length === 0) {
      this.previewEl.appendChild(emptyState("Nothing matches yet", "Loosen the conditions or add another."));
      return;
    }
    const list = this.previewEl.createDiv({ cls: "si-preview-items" });
    for (const m of matches) {
      const item = list.createDiv({ cls: "si-preview-item" });
      const ic = item.createSpan({ cls: "si-preview-icon" });
      if (m.iconId) {
        try {
          renderIcon(ic, m.iconId);
        } catch {
          /* ignore */
        }
      }
      item.createSpan({ cls: "si-preview-name", text: m.name });
      item.createSpan({ cls: "si-preview-count-badge", text: `${m.count}/${this.rule.conditions.length}` });
    }
  }
}
