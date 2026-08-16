/**
 * Star Icons — "Report a bug" dialog.
 *
 * Builds a copyable diagnostic report (versions, platform, pack state) so
 * bug reports include everything needed to reproduce an issue, plus an
 * optional link to the project's issue tracker.
 */

import { App, Modal, Notice, Platform, Setting } from "obsidian";

export interface BugReportContext {
  pluginVersion: string;
  appVersion: string;
  packs: number;
  enabledPacks: number;
  icons: number;
  reportUrl?: string;
}

export function buildBugReport(ctx: BugReportContext): string {
  const platform = Platform.isMobileApp
    ? "Mobile"
    : Platform.isDesktopApp
      ? "Desktop"
      : "Unknown";
  const os = Platform.isMacOS
    ? "macOS"
    : Platform.isWindows
      ? "Windows"
      : Platform.isLinux
        ? "Linux"
        : (typeof navigator !== "undefined" ? navigator.platform : "Unknown");

  const lines = [
    "Star Icons — bug report",
    "=======================",
    "",
    `Plugin version : ${ctx.pluginVersion}`,
    `Obsidian       : ${ctx.appVersion}`,
    `Platform       : ${platform} · ${os}`,
    `Packs available: ${ctx.packs} (${ctx.icons.toLocaleString()} icons)`,
    `Packs enabled  : ${ctx.enabledPacks}`,
    "",
    "Please describe what you did, what you expected, and what happened:",
    "",
    "1. Steps to reproduce:",
    "   - ",
    "2. Expected:",
    "   - ",
    "3. Actual:",
    "   - ",
    "4. Any console errors (Ctrl+Shift+I → Console):",
    "   - ",
  ];
  return lines.join("\n");
}

export class ReportBugModal extends Modal {
  constructor(
    app: App,
    private ctx: BugReportContext,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("Report a bug");

    contentEl.createDiv({
      cls: "setting-item-description",
      text: "Copy the diagnostic report below, fill in what happened, and paste it into a GitHub issue (or the Obsidian forum thread).",
    });

    const report = buildBugReport(this.ctx);
    const textarea = contentEl.createEl("textarea", {
      cls: "si-textarea",
      attr: { rows: "16", readonly: "", spellcheck: "false" },
    }) as HTMLTextAreaElement;
    textarea.value = report;

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Copy report").setCta().onClick(() => {
          void navigator.clipboard.writeText(report);
          new Notice("Bug report copied to clipboard");
        }),
      )
      .addButton((b) =>
        b.setButtonText("Close").onClick(() => this.close()),
      );

    if (this.ctx.reportUrl) {
      new Setting(contentEl)
        .setDesc("Open the project's issue tracker in your browser.")
        .addButton((b) =>
          b.setButtonText("Open issue page").onClick(() => {
            window.open(this.ctx.reportUrl, "_blank");
          }),
        );
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
