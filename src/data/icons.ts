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
import remixData from "./generated/remix.json";
import phosphorData from "./generated/phosphor.json";
import bootstrapData from "./generated/bootstrap.json";
import { STAR_ICONS } from "./packs/star";
import { EMOJI_PACKS, EmojiIconDef } from "./packs/emoji";
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
const REMIX = remixData as RawPack;
const PHOSPHOR = phosphorData as RawPack;
const BOOTSTRAP = bootstrapData as RawPack;

/** Stroke-based shell (Lucide guidelines: 24×24, 2px stroke, round caps). */
function strokeShell(inner: string, viewBox = "0 0 24 24"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/** Fill-based shell (Material Symbols / Unicons are filled paths). */
function fillShell(inner: string, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor">${inner}</svg>`;
}

/** Emoji shell: renders the emoji as SVG <text> using the OS emoji font. */
function emojiShell(emoji: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="12" font-size="19" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
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

/** Build an emoji pack: the "svg" is the emoji rendered via the OS font. */
function buildEmojiPack(
  pack: PackId,
  entries: EmojiIconDef[],
): IconDef[] {
  return entries.map((e) => ({
    id: iconId(pack, e.name),
    pack,
    name: e.name,
    tags: Array.from(new Set([...e.tags, ...e.name.split(/[-_]/)])),
    svg: emojiShell(e.emoji),
  }));
}

const LUCIDE_ICONS = buildPack("lucide", LUCIDE.icons, strokeShell);
const MATERIAL_ICONS = buildPack("material", MATERIAL.icons, fillShell);
const STAR_ICONS_FULL = buildPack("star", STAR_ICONS, strokeShell);
const TABLER_ICONS = buildPack("tabler", TABLER.icons, strokeShell);
const UNICONS_ICONS = buildPack("unicons", UNICONS.icons, fillShell);
const REMIX_ICONS = buildPack("remix", REMIX.icons, fillShell);
const PHOSPHOR_ICONS = buildPack("phosphor", PHOSPHOR.icons, fillShell);
const BOOTSTRAP_ICONS = buildPack("bootstrap", BOOTSTRAP.icons, fillShell);
const ANIMALS_ICONS = buildEmojiPack("animals", EMOJI_PACKS.animals);
const NATURE_ICONS = buildEmojiPack("nature", EMOJI_PACKS.nature);
const SCIENCE_ICONS = buildEmojiPack("science", EMOJI_PACKS.science);

/** Every bundled icon. */
export const ALL_ICONS: IconDef[] = [
  ...LUCIDE_ICONS,
  ...MATERIAL_ICONS,
  ...STAR_ICONS_FULL,
  ...TABLER_ICONS,
  ...UNICONS_ICONS,
  ...REMIX_ICONS,
  ...PHOSPHOR_ICONS,
  ...BOOTSTRAP_ICONS,
  ...ANIMALS_ICONS,
  ...NATURE_ICONS,
  ...SCIENCE_ICONS,
];

export const ICONS_BY_PACK: Record<PackId, IconDef[]> = {
  lucide: LUCIDE_ICONS,
  material: MATERIAL_ICONS,
  star: STAR_ICONS_FULL,
  tabler: TABLER_ICONS,
  unicons: UNICONS_ICONS,
  remix: REMIX_ICONS,
  phosphor: PHOSPHOR_ICONS,
  bootstrap: BOOTSTRAP_ICONS,
  animals: ANIMALS_ICONS,
  nature: NATURE_ICONS,
  science: SCIENCE_ICONS,
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
  remix: REMIX.version,
  phosphor: PHOSPHOR.version,
  bootstrap: BOOTSTRAP.version,
  animals: "system emoji",
  nature: "system emoji",
  science: "system emoji",
};

export const TOTAL_ICON_COUNT = ALL_ICONS.length;
