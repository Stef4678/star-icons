/**
 * Star Icons — Icon Galaxy layout (pure math, no Three.js dependency).
 *
 * Deterministically places every icon as a "star" in a 3D galaxy:
 *   • each pack gets a "planet" on a spiral arm
 *   • the pack's icons orbit their planet in a small disk
 *   • every star is tinted with its pack's color
 *
 * Pure + deterministic (seeded by icon id / pack via hashString) so the
 * layout is stable across sessions, unit-testable, and the 3D view can
 * "fly to" a searched icon by looking up its position.
 */

import { IconDef } from "../types";
import { hashString } from "../utils";

export interface GalaxyPlanet {
  pack: string;
  /** Display label (pack id — the 3D view renders a prettier label). */
  label: string;
  x: number;
  y: number;
  z: number;
  /** Pack color, 0–255 rgb. */
  color: [number, number, number];
}

export interface GalaxyData {
  /** xyz per icon, in iconIds order. */
  positions: Float32Array;
  /** rgb per icon (0–1). */
  colors: Float32Array;
  planets: GalaxyPlanet[];
  /** icon id -> index into positions/iconIds. */
  indexById: Map<string, number>;
  iconIds: string[];
}

/** Vivid palette used to tint each pack's planet + stars (0–255). */
const PACK_COLORS: [number, number, number][] = [
  [245, 179, 1], // gold
  [255, 122, 69], // orange
  [152, 195, 121], // green
  [64, 196, 255], // cyan
  [59, 130, 246], // blue
  [167, 139, 250], // violet
  [198, 120, 221], // purple
  [244, 114, 182], // pink
  [233, 49, 71], // red
  [64, 224, 208], // teal
  [255, 214, 102], // sand
  [136, 148, 158], // gray
];

/** Stable pack color (0–255). */
export function packColor(pack: string): [number, number, number] {
  return PACK_COLORS[hashString(pack) % PACK_COLORS.length];
}

/**
 * Two complementary CSS colors for the "Icon Aurora" backdrop, tinted to a
 * pack. "all" (and any unrecognized pack) falls back to the brand gold + cyan.
 * The second color is a simple RGB rotation of the first so it reads as a
 * harmonious secondary glow.
 */
export function auroraColors(pack: string): [string, string] {
  if (!pack || pack === "all") return ["#f5b301", "#40c4ff"];
  const [r, g, b] = packColor(pack);
  return [`rgb(${r}, ${g}, ${b})`, `rgb(${b}, ${r}, ${g})`];
}

/** Galaxy spiral geometry: 3 turns, inner radius 16 -> outer 58. */
const SPIRAL_TURNS = 3;
const INNER_RADIUS = 16;
const OUTER_RADIUS = 58;

export function buildGalaxyData(icons: IconDef[]): GalaxyData {
  // Group icons by pack, preserving first-seen order.
  const byPack = new Map<string, IconDef[]>();
  for (const icon of icons) {
    const list = byPack.get(icon.pack);
    if (list) list.push(icon);
    else byPack.set(icon.pack, [icon]);
  }
  const packs = Array.from(byPack.keys());
  const count = icons.length;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const iconIds: string[] = [];
  const indexById = new Map<string, number>();
  const planets: GalaxyPlanet[] = [];

  const n = Math.max(1, packs.length);
  packs.forEach((pack, p) => {
    const t = n === 1 ? 0 : p / (n - 1);
    const angle = t * Math.PI * 2 * SPIRAL_TURNS + (hashString(pack + ":a") % 1000) / 1000 * 0.6;
    const radius = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const py = ((hashString(pack + ":y") % 120) / 120) * 6 - 3;
    const color = packColor(pack);
    planets.push({ pack, label: pack, x: px, y: py, z: pz, color });

    const list = byPack.get(pack) ?? [];
    // Bigger packs get wider disks so the cluster stays readable.
    const disk = 1.4 + Math.min(4.2, Math.sqrt(list.length) * 0.09);
    const golden = Math.PI * (3 - Math.sqrt(5));
    list.forEach((icon, i) => {
      const h1 = hashString(icon.id);
      const h2 = hashString(icon.id + ":r");
      const h3 = hashString(icon.id + ":y");
      const a = ((h1 % 628) / 628) * Math.PI * 2 + i * golden;
      const r = 0.5 + ((h2 % 1000) / 1000) * (disk - 0.5);
      const idx = iconIds.length;
      positions[idx * 3] = px + Math.cos(a) * r;
      positions[idx * 3 + 1] = py + ((h3 % 100) / 100) * 1.6 - 0.8;
      positions[idx * 3 + 2] = pz + Math.sin(a) * r;
      colors[idx * 3] = color[0] / 255;
      colors[idx * 3 + 1] = color[1] / 255;
      colors[idx * 3 + 2] = color[2] / 255;
      indexById.set(icon.id, idx);
      iconIds.push(icon.id);
    });
  });

  return { positions, colors, planets, indexById, iconIds };
}
