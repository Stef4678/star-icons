/**
 * Star Icons — the icon registry (dynamic).
 *
 * Core packs (star + themed emoji) are bundled in main.js and always
 * available. External packs (Lucide, Tabler, …) ship as JSON files in the
 * plugin's packs/ folder and are mounted at runtime when enabled — keeping
 * main.js small and startup cost flat no matter how many packs we ship.
 *
 * All icons are registered with Obsidian's addIcon() (by the IconStore) so
 * they can be used anywhere a built-in icon can.
 */

import { STAR_ICONS } from "./packs/star";
import { EMOJI_PACKS, EmojiIconDef } from "./packs/emoji";
import { IconDef, PackId } from "../types";

export interface RawIcon {
  name: string;
  svg: string;
  viewBox: string;
  tags?: string[];
}

export interface RawPack {
  pack: string;
  version: string;
  icons: RawIcon[];
}

/** Stroke-based shell (Lucide guidelines: 24×24, 2px stroke, round caps). */
function strokeShell(inner: string, viewBox = "0 0 24 24"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/** Fill-based shell (Material Symbols / Unicons / Boxicons are filled paths). */
function fillShell(inner: string, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor">${inner}</svg>`;
}

/** Emoji shell: renders the emoji as SVG <text> using the OS emoji font. */
function emojiShell(emoji: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="12" y="12" font-size="19" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>`;
}

/** Neutral shell for self-contained full-color SVGs (e.g. OpenMoji). */
function plainShell(inner: string, viewBox: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
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
    const tags = [...(r.tags ?? []), ...r.name.split(/[-_]/)].filter(Boolean);
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
function buildEmojiPack(pack: PackId, entries: EmojiIconDef[]): IconDef[] {
  return entries.map((e) => ({
    id: iconId(pack, e.name),
    pack,
    name: e.name,
    tags: Array.from(new Set([...e.tags, ...e.name.split(/[-_]/)])),
    svg: emojiShell(e.emoji),
  }));
}

/* --- core packs (bundled, always available) ----------------------------- */

const STAR_ICONS_FULL = buildPack("star", STAR_ICONS, strokeShell);
const ANIMALS_ICONS = buildEmojiPack("animals", EMOJI_PACKS.animals);
const NATURE_ICONS = buildEmojiPack("nature", EMOJI_PACKS.nature);
const SCIENCE_ICONS = buildEmojiPack("science", EMOJI_PACKS.science);

export const CORE_PACKS: PackId[] = ["star", "animals", "nature", "science"];

/** Packs shipped as separate JSON files under packs/ (loaded on demand). */
export const EXTERNAL_PACKS: PackId[] = [
  "lucide",
  "material",
  "tabler",
  "unicons",
  "remix",
  "phosphor",
  "bootstrap",
  "boxicons",
  "heroicons",
  "openmoji",
];

/** Currently mounted icons (core + loaded external packs). */
export let ALL_ICONS: IconDef[] = [
  ...STAR_ICONS_FULL,
  ...ANIMALS_ICONS,
  ...NATURE_ICONS,
  ...SCIENCE_ICONS,
];

export const ICONS_BY_PACK: Partial<Record<PackId, IconDef[]>> = {
  star: STAR_ICONS_FULL,
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

export const PACK_VERSIONS: Partial<Record<PackId, string>> = {
  star: "1.0.0",
  animals: "system emoji",
  nature: "system emoji",
  science: "system emoji",
};

/** Which shell renders each external pack (applied at mount time). */
const SHELL_BY_PACK: Record<string, (inner: string, viewBox: string) => string> = {
  lucide: strokeShell,
  tabler: strokeShell,
  heroicons: strokeShell,
  material: fillShell,
  unicons: fillShell,
  remix: fillShell,
  phosphor: fillShell,
  bootstrap: fillShell,
  boxicons: fillShell,
  openmoji: plainShell,
};

/** Build IconDefs for an external pack's raw JSON data (pure). */
export function buildPackFromRaw(pack: PackId, raw: RawPack): IconDef[] {
  const shell = SHELL_BY_PACK[pack] ?? plainShell;
  return buildPack(pack, raw.icons ?? [], shell);
}

/** Mount a pack's icons into the registry (called after addIcon). */
export function mountPack(pack: PackId, defs: IconDef[]): void {
  ICONS_BY_PACK[pack] = defs;
  for (const d of defs) ICON_INDEX.set(d.id, d);
  ALL_ICONS = [...ALL_ICONS, ...defs];
}

/** Drop a pack from the registry (disabled packs stay cached in Obsidian). */
export function unmountPack(pack: PackId): void {
  const defs = ICONS_BY_PACK[pack];
  if (!defs) return;
  for (const d of defs) ICON_INDEX.delete(d.id);
  ALL_ICONS = ALL_ICONS.filter((i) => i.pack !== pack);
  delete ICONS_BY_PACK[pack];
}

export function isCorePack(pack: PackId): boolean {
  return CORE_PACKS.includes(pack);
}

export function isPackMounted(pack: PackId): boolean {
  return !!ICONS_BY_PACK[pack];
}
