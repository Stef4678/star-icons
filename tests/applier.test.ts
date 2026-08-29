/**
 * Star Icons — applier patch tests (the file-explorer getIcon/getFolderIcon
 * monkey-patch).
 *
 * Regression test for the "works on my vault, breaks on a fresh vault" bug:
 * Obsidian calls `view.getIcon()` with NO argument while saving workspace
 * state (WorkspaceLeaf.getViewState / tab headers). The original Obsidian
 * implementation reads `this.icon`, so the patch must preserve the view as
 * `this`. The old code invoked the original as a bare function, making `this`
 * undefined and throwing "Cannot read properties of undefined
 * (reading 'icon')" on every layout save — which broke clean installs.
 */

import { describe, expect, it, vi } from "vitest";

// The `obsidian` npm package is types-only; use runtime stubs for the tests.
vi.mock("obsidian", () => import("./stubs/obsidian"));

import { makePatchedViewIcon } from "../src/core/applier";

/** Mimics Obsidian's base View.getIcon, which reads `this.icon`. */
function baseGetIcon(this: { icon?: string }): string {
  return this.icon ? this.icon : "lucide-file";
}

const noIcon = { iconId: null, source: "none", detail: "" } as const;

describe("makePatchedViewIcon", () => {
  it("returns the view's own icon when called without a file (getViewState)", () => {
    const view = { icon: "lucide-folder-closed" };
    const patched = makePatchedViewIcon(view, () => noIcon, baseGetIcon);
    expect(patched()).toBe("lucide-folder-closed");
  });

  it("does not throw when the original reads this.icon (regression)", () => {
    const view = { icon: "lucide-folder-closed" };
    const patched = makePatchedViewIcon(view, () => noIcon, baseGetIcon);
    expect(() => patched()).not.toThrow();
  });

  it("returns the resolved icon when called with a file", () => {
    const view = { icon: "lucide-folder-closed" };
    const file = { path: "a.md" };
    const patched = makePatchedViewIcon(
      view,
      (f) => (f === file ? { iconId: "si-lucide-star", source: "rule", detail: "" } : noIcon),
      baseGetIcon,
    );
    expect(patched(file)).toBe("si-lucide-star");
  });

  it("falls back to the original (with this bound) when resolution has no icon", () => {
    const view = { icon: "lucide-folder-closed" };
    const file = { path: "b.md" };
    const patched = makePatchedViewIcon(view, () => noIcon, baseGetIcon);
    expect(patched(file)).toBe("lucide-folder-closed");
  });

  it("returns undefined when there is no original", () => {
    const view = { icon: "lucide-folder-closed" };
    const patched = makePatchedViewIcon(view, () => noIcon, undefined);
    expect(patched()).toBeUndefined();
  });
});
