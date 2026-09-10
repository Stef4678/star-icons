/**
 * Star Icons — generated pack data contract tests.
 *
 * Guards the pack pipeline, in particular the sets added from
 * `@iconify-json/*` data packages (MDI, Hugeicons, Iconoir, …):
 *
 *   • every generated pack file is registered in ALL_PACKS, so the settings
 *     list, the pack filter and EXTERNAL_PACKS can actually see it,
 *   • the manifest count matches the pack file (the two are written by
 *     separate code paths in scripts/build-icon-data.mjs),
 *   • each pack mounts to the expected number of icons with `si-<pack>-<name>`
 *     ids, and
 *   • the SVG shell wraps the raw body with that icon's own viewBox and a
 *     `currentColor` default — the added sets are not all 24×24 (radix is
 *     15×15, vscode-icons 32×32, circle-flags 512×512), so a shell that
 *     dropped the viewBox would silently break those packs.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ALL_PACKS, DEFAULT_SETTINGS, PACK_GROUPS, PACK_LABELS, PACK_SAMPLE_ICON } from "../src/types";
import { buildPackFromRaw, RawPack } from "../src/data/icons";

const generatedDir = path.join(process.cwd(), "src", "data", "generated");
const manifest = JSON.parse(
  readFileSync(path.join(generatedDir, "manifest.json"), "utf8"),
) as { packs: Record<string, { version: string; count: number }> };

const packIds = Object.keys(manifest.packs);

/**
 * The sets added from Iconify data packages. Kept explicit so the test states
 * exactly which packs it covers; the generic checks below still run over every
 * pack in the manifest.
 */
const ICONIFY_PACK_IDS = [
  "mdi",
  "hugeicons",
  "iconoir",
  "mingcute",
  "carbon",
  "tdesign",
  "gravity-ui",
  "feather",
  "radix-icons",
  "jam",
  "pixelarticons",
  "teenyicons",
  "majesticons",
  "circle-flags",
  "vscode-icons",
];

function readPack(pack: string): RawPack {
  return JSON.parse(
    readFileSync(path.join(generatedDir, `${pack}.json`), "utf8"),
  ) as RawPack;
}

describe("pack registration invariants", () => {
  // Settings renders its pack list from PACK_GROUPS, so a pack that is missing
  // from the groups cannot be enabled by the user at all — even though it ships.
  it("lists every pack in exactly one PACK_GROUPS group", () => {
    const listed = PACK_GROUPS.flatMap((g) => g.packs);
    expect(ALL_PACKS.filter((p) => !listed.includes(p))).toEqual([]);
    expect(listed.filter((p) => !(ALL_PACKS as readonly string[]).includes(p))).toEqual([]);
    expect(listed.filter((p, i) => listed.indexOf(p) !== i)).toEqual([]);
  });

  it("has a label, an explicit default and a preview sample for every pack", () => {
    expect(ALL_PACKS.filter((p) => !PACK_LABELS[p])).toEqual([]);
    expect(
      ALL_PACKS.filter(
        (p) => !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS.enabledPacks, p),
      ),
    ).toEqual([]);
    expect(ALL_PACKS.filter((p) => !PACK_SAMPLE_ICON[p])).toEqual([]);
  });
});

describe("generated pack data", () => {
  it("registers every generated pack in ALL_PACKS", () => {
    const missing = packIds.filter((p) => !(ALL_PACKS as readonly string[]).includes(p));
    expect(missing).toEqual([]);
  });

  it("keeps the manifest count in sync with each pack file", () => {
    const mismatched: string[] = [];
    for (const pack of packIds) {
      const raw = readPack(pack);
      if (raw.icons.length !== manifest.packs[pack].count) {
        mismatched.push(`${pack}: file=${raw.icons.length} manifest=${manifest.packs[pack].count}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it("ships every Iconify pack with its expected icon count", () => {
    const expected: Record<string, number> = {
      mdi: 7638,
      hugeicons: 6005,
      iconoir: 1682,
      mingcute: 3336,
      carbon: 2763,
      tdesign: 2364,
      "gravity-ui": 799,
      feather: 286,
      "radix-icons": 342,
      jam: 940,
      pixelarticons: 1306,
      teenyicons: 1200,
      majesticons: 1045,
      "circle-flags": 718,
      "vscode-icons": 1595,
    };
    for (const [pack, count] of Object.entries(expected)) {
      expect(manifest.packs[pack]?.count, `${pack} missing from the manifest`).toBe(count);
    }
  });

  it("mounts Iconify packs with a currentColor shell and per-icon viewBox", () => {
    for (const pack of ICONIFY_PACK_IDS) {
      const raw = readPack(pack);
      const defs = buildPackFromRaw(pack, raw);
      expect(defs.length, pack).toBe(raw.icons.length);

      for (let i = 0; i < defs.length; i++) {
        const def = defs[i];
        const source = raw.icons[i];
        expect(def.id, `${pack}/${source.name}`).toBe(`si-${pack}-${source.name}`);
        expect(def.pack, pack).toBe(pack);
        // Shell: namespace + the icon's own viewBox + currentColor fallback.
        expect(def.svg.startsWith("<svg "), `${pack}/${source.name} shell`).toBe(true);
        expect(def.svg, `${pack}/${source.name} viewBox`).toContain(
          `viewBox="${source.viewBox}"`,
        );
        expect(def.svg, `${pack}/${source.name} currentColor`).toContain('fill="currentColor"');
        // The raw body is embedded verbatim so shapes keep their own colors.
        expect(def.svg).toContain(source.svg);
        expect(def.svg.endsWith("</svg>")).toBe(true);
      }
    }
  });

  it("keeps markup safe for Obsidian's addIcon", () => {
    const problems: string[] = [];
    for (const pack of ICONIFY_PACK_IDS) {
      for (const icon of readPack(pack).icons) {
        const svg = icon.svg;
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(svg)) {
          problems.push(`${pack}/${icon.name}: control characters`);
        }
        // Bare "&" would make the markup invalid XML once wrapped.
        if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(svg)) {
          problems.push(`${pack}/${icon.name}: unescaped ampersand`);
        }
        const opens = svg.match(/<[a-zA-Z][^>]*>/g) ?? [];
        const closes = svg.match(/<\/[a-zA-Z]+>/g) ?? [];
        const selfClosing = opens.filter((t) => t.endsWith("/>"));
        if (opens.length !== closes.length + selfClosing.length) {
          problems.push(`${pack}/${icon.name}: unbalanced tags`);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("keeps every SVG reference self-contained inside its own icon", () => {
    // A url(#x) / href="#x" that the icon does not define itself would resolve
    // against whatever else happens to be in the rendered document.
    const problems: string[] = [];
    for (const pack of packIds) {
      for (const icon of readPack(pack).icons) {
        const own = new Set(
          [...icon.svg.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((m) => m[1]),
        );
        const refs = [
          ...[...icon.svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
          ...[...icon.svg.matchAll(/(?:xlink:)?href\s*=\s*"#([^"]+)"/g)].map((m) => m[1]),
        ];
        for (const ref of refs) {
          if (!own.has(ref)) problems.push(`${pack}/${icon.name} -> #${ref}`);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it("derives search tags (style, category and alias synonyms)", () => {
    // mdi: set-level "material" tag plus filled/outline style detection.
    const mdi = buildPackFromRaw("mdi", readPack("mdi"));
    const home = mdi.find((i) => i.name === "home");
    expect(home, "mdi:home").toBeTruthy();
    expect(home!.tags).toContain("material");
    expect(home!.tags.includes("filled") || home!.tags.includes("outline")).toBe(true);
    // Alias names become tags on the icon they point at, so synonyms are
    // searchable without duplicating any markup.
    expect(mdi.filter((i) => i.tags.length > 4).length).toBeGreaterThan(1000);

    // circle-flags: every icon carries the set-level style tags.
    for (const icon of buildPackFromRaw("circle-flags", readPack("circle-flags"))) {
      expect(icon.tags).toContain("flag");
      expect(icon.tags).toContain("color");
    }

    // vscode-icons: folder variants are tagged for search.
    const vscode = buildPackFromRaw("vscode-icons", readPack("vscode-icons"));
    expect(vscode.some((i) => i.tags.includes("folder"))).toBe(true);
  });
});
