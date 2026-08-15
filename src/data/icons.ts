/**
 * Star Icons — the bundled icon registry.
 *
 * Merges the generated pack data (Lucide, Material, Tabler, Unicons) with the
 * hand-authored star pack into a single IconDef[] and exposes fast
 * lookup/search helpers. All icons are registered with Obsidian's addIcon()
 * at plugin load so they can be used anywhere a built-in icon can
 * (file explorer, tabs, commands…).
 */

import lucideData from "./generated/lucide.json";
import materialData from "./generated/material.json";
import tablerData from "./generated/tabler.json";
import uniconsData from "./generated/unicons.json";
import { STAR_ICONS } from "./packs/star";
import { IconDef, PackId } from "../types";

interface RawIcon {
  name: string;
  svg: string;
  viewBox: string;
  tags?: string[];
}

interface RawPack {
  pack: string;
  version: string;
  icons: RawIcon[];
}

const LUCIDE = lucideData as RawPack;
const MATERIAL = materialData as RawPack;
const TABLER = tablerData as RawPack;
const UNICONS = uniconsData as RawPack;

/** Stroke-based shell (Lucide guidelines: 24×24, 2px stroke, round caps). */
function strokeShell(inner: string, viewBox = "0 0 24 24"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/** Fill-based shell (Material Symbols / Unicons are filled paths). */
function fillShell(inner: string, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor">${inner}</svg>`;
}

export function iconId(pack: PackId, name: string): string {
  return `si-${pack}-${name}`;
}

function buildPack(
  pack: PackId,
  raws: RawIcon[],
  shell: (inner: string, viewBox: string) => string,
): IconDef[] {
  return raws.map((r) => {
    const tags = [
      ...(r.tags ?? []),
      ...r.name.split(/[-_]/),
    ].filter(Boolean);
    return {
      id: iconId(pack, r.name),
      pack,
      name: r.name,
      tags: Array.from(new Set(tags)),
      svg: shell(r.svg, r.viewBox),
    };
  });
}

const LUCIDE_ICONS = buildPack("lucide", LUCIDE.icons, strokeShell);
const MATERIAL_ICONS = buildPack("material", MATERIAL.icons, fillShell);
const STAR_ICONS_FULL = buildPack("star", STAR_ICONS, strokeShell);
const TABLER_ICONS = buildPack("tabler", TABLER.icons, strokeShell);
const UNICONS_ICONS = buildPack("unicons", UNICONS.icons, fillShell);

/** Every bundled icon. */
export const ALL_ICONS: IconDef[] = [
  ...LUCIDE_ICONS,
  ...MATERIAL_ICONS,
  ...STAR_ICONS_FULL,
  ...TABLER_ICONS,
  ...UNICONS_ICONS,
];

export const ICONS_BY_PACK: Record<PackId, IconDef[]> = {
  lucide: LUCIDE_ICONS,
  material: MATERIAL_ICONS,
  star: STAR_ICONS_FULL,
  tabler: TABLER_ICONS,
  unicons: UNICONS_ICONS,
};

/** Fast lookup by icon id ("si-…"). */
export const ICON_INDEX: Map<string, IconDef> = new Map(
  ALL_ICONS.map((i) => [i.id, i]),
);

export function getIcon(id: string | null | undefined): IconDef | undefined {
  if (!id) return undefined;
  return ICON_INDEX.get(id);
}

export const PACK_VERSIONS: Record<PackId, string> = {
  lucide: LUCIDE.version,
  material: MATERIAL.version,
  star: "1.0.0",
  tabler: TABLER.version,
  unicons: UNICONS.version,
};

export const TOTAL_ICON_COUNT = ALL_ICONS.length;
