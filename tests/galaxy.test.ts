/**
 * Star Icons — Icon Galaxy layout tests (pure math, no Three.js needed).
 */

import { describe, expect, it } from "vitest";

import { buildGalaxyData, packColor } from "../src/core/galaxy";
import { IconDef } from "../src/types";

function ic(id: string, pack: string, name: string): IconDef {
  return { id, pack, name, tags: [], svg: "" };
}

function iconsOf(pack: string, names: string[]): IconDef[] {
  return names.map((n) => ic(`si-${pack}-${n}`, pack, n));
}

describe("buildGalaxyData", () => {
  it("produces one star per icon with matching indices", () => {
    const icons = [
      ic("si-lucide-home", "lucide", "home"),
      ic("si-lucide-star", "lucide", "star"),
      ic("si-tabler-rocket", "tabler", "rocket"),
    ];
    const d = buildGalaxyData(icons);
    expect(d.iconIds).toEqual(["si-lucide-home", "si-lucide-star", "si-tabler-rocket"]);
    expect(d.positions.length).toBe(9);
    expect(d.colors.length).toBe(9);
    expect(d.indexById.get("si-lucide-home")).toBe(0);
    expect(d.indexById.get("si-tabler-rocket")).toBe(2);
  });

  it("is deterministic across runs", () => {
    const icons = iconsOf("lucide", ["home", "star", "heart", "rocket", "folder"]);
    const a = buildGalaxyData(icons);
    const b = buildGalaxyData(icons);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
  });

  it("creates one planet per pack", () => {
    const icons = [
      ...iconsOf("lucide", ["home", "star"]),
      ...iconsOf("tabler", ["rocket", "planet"]),
      ...iconsOf("material", ["face"]),
    ];
    const d = buildGalaxyData(icons);
    expect(d.planets.map((p) => p.pack).sort()).toEqual(["lucide", "material", "tabler"]);
  });

  it("keeps every star near its pack's planet", () => {
    const icons = iconsOf("lucide", ["a", "b", "c", "d", "e", "f", "g", "h"]);
    const d = buildGalaxyData(icons);
    const planet = d.planets.find((p) => p.pack === "lucide")!;
    for (let i = 0; i < icons.length; i++) {
      const dx = d.positions[i * 3] - planet.x;
      const dy = d.positions[i * 3 + 1] - planet.y;
      const dz = d.positions[i * 3 + 2] - planet.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeLessThan(7);
    }
  });

  it("stars carry their pack's color", () => {
    const icons = [
      ...iconsOf("lucide", ["home", "star"]),
      ...iconsOf("tabler", ["rocket"]),
    ];
    const d = buildGalaxyData(icons);
    const lucide = packColor("lucide");
    expect(d.colors[0]).toBeCloseTo(lucide[0] / 255);
    expect(d.colors[1]).toBeCloseTo(lucide[1] / 255);
    const tabler = packColor("tabler");
    expect(d.colors[6]).toBeCloseTo(tabler[0] / 255);
  });

  it("handles empty and single-icon input", () => {
    expect(buildGalaxyData([]).iconIds.length).toBe(0);
    const one = buildGalaxyData([ic("si-lucide-home", "lucide", "home")]);
    expect(one.planets.length).toBe(1);
    expect(one.iconIds.length).toBe(1);
    // The single star orbits close to its planet (well within the disk).
    expect(Math.abs(one.positions[0] - one.planets[0].x)).toBeLessThan(2);
  });
});

describe("packColor", () => {
  it("is stable per pack and valid rgb", () => {
    expect(packColor("lucide")).toEqual(packColor("lucide"));
    const [r, g, b] = packColor("tabler");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });
});
