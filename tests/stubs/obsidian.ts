/**
 * Minimal runtime stubs for the types-only `obsidian` package.
 * Only what the unit tests transitively import.
 */

export class App {}

export class TAbstractFile {
  name = "";
  path = "";
  parent: TAbstractFile | null = null;
}

export class TFile extends TAbstractFile {
  extension = "";
  basename = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export function setIcon(): void {
  /* stub */
}
export function addIcon(): void {
  /* stub */
}
export function getIcon(): null {
  return null;
}

export class Notice {}
export class Modal {}
export class Menu {}
export class ItemView {}
export class Plugin {}
export class WorkspaceLeaf {}
export class MarkdownView {}
export class Platform {}
