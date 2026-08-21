/**
 * Star Icons — soundscape classification tests (pure logic, no DOM/Web Audio).
 */

import { describe, expect, it } from "vitest";

import { soundKindForIcon } from "../src/core/audio";

describe("soundKindForIcon", () => {
  it("classifies by icon name keywords", () => {
    expect(soundKindForIcon("si-lucide-star")).toBe("twinkle");
    expect(soundKindForIcon("si-lucide-sparkles")).toBe("twinkle");
    expect(soundKindForIcon("si-phosphor-trash")).toBe("crash");
    expect(soundKindForIcon("si-lucide-trash-2")).toBe("crash");
    expect(soundKindForIcon("si-tabler-notification")).toBe("ding");
    expect(soundKindForIcon("si-lucide-bell")).toBe("ding");
    expect(soundKindForIcon("si-lucide-heart")).toBe("chime");
    expect(soundKindForIcon("si-lucide-plus")).toBe("pop");
    expect(soundKindForIcon("si-tabler-plus")).toBe("pop");
  });

  it("falls back to click for neutral icons", () => {
    expect(soundKindForIcon("si-lucide-folder")).toBe("click");
    expect(soundKindForIcon("si-lucide-home")).toBe("click");
    expect(soundKindForIcon("si-material-settings")).toBe("click");
  });

  it("is case-insensitive", () => {
    expect(soundKindForIcon("SI-LUCIDE-STAR")).toBe("twinkle");
    expect(soundKindForIcon("Trash")).toBe("crash");
  });

  it("prefers the more specific match (star before pop)", () => {
    expect(soundKindForIcon("si-lucide-star-plus")).toBe("twinkle");
    expect(soundKindForIcon("si-lucide-spark")).toBe("twinkle");
  });
});
