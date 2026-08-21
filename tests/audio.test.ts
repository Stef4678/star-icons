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

  it("classifies animal icons by their meaning", () => {
    expect(soundKindForIcon("si-animals-dog")).toBe("bark");
    expect(soundKindForIcon("si-lucide-fox")).toBe("bark");
    expect(soundKindForIcon("si-animals-cat")).toBe("meow");
    expect(soundKindForIcon("si-animals-wolf")).toBe("howl");
    expect(soundKindForIcon("si-animals-lion")).toBe("roar");
    expect(soundKindForIcon("si-animals-tiger")).toBe("roar");
    expect(soundKindForIcon("si-animals-bear")).toBe("roar");
    expect(soundKindForIcon("si-animals-panda")).toBe("roar");
    expect(soundKindForIcon("si-animals-monkey")).toBe("chatter");
    expect(soundKindForIcon("si-animals-gorilla")).toBe("chatter");
    expect(soundKindForIcon("si-animals-bird")).toBe("chirp");
    expect(soundKindForIcon("si-lucide-bird")).toBe("chirp");
    expect(soundKindForIcon("si-animals-chicken")).toBe("cluck");
    expect(soundKindForIcon("si-animals-rooster")).toBe("cluck");
    expect(soundKindForIcon("si-animals-duck")).toBe("quack");
    expect(soundKindForIcon("si-animals-owl")).toBe("hoot");
    expect(soundKindForIcon("si-animals-cow")).toBe("moo");
    expect(soundKindForIcon("si-animals-horse")).toBe("neigh");
    expect(soundKindForIcon("si-animals-pig")).toBe("oink");
    expect(soundKindForIcon("si-animals-sheep")).toBe("baa");
    expect(soundKindForIcon("si-animals-frog")).toBe("ribbit");
    expect(soundKindForIcon("si-animals-mouse")).toBe("squeak");
    expect(soundKindForIcon("si-animals-hamster")).toBe("squeak");
    expect(soundKindForIcon("si-lucide-bee")).toBe("buzz");
    expect(soundKindForIcon("si-lucide-bug")).toBe("buzz");
    expect(soundKindForIcon("si-animals-elephant")).toBe("trumpet");
  });

  it("keeps themed classifications winning over animal ones", () => {
    // A "star" icon never becomes an animal sound.
    expect(soundKindForIcon("si-lucide-star")).toBe("twinkle");
    expect(soundKindForIcon("si-lucide-trash")).toBe("crash");
    expect(soundKindForIcon("si-lucide-bell")).toBe("ding");
  });
});
