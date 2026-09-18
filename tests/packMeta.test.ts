/**
 * Star Icons — pack inventory metadata.
 *
 * `packs/manifest.json` can be unreadable at runtime: on a community install it
 * only appears after the first successful CDN fetch, and a manual install can
 * ship without the packs/ folder at all. When that happened the settings list
 * showed every external pack as "v?" with "0 icons" — which reads as "this pack
 * is empty" rather than "metadata unavailable" — and the emoji packs rendered
 * as "vSystem emoji". These tests pin the bundled baseline that fixes it, and
 * the version formatting that kept the nonsense strings out of the UI.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ALL_PACKS } from "../src/types";
import { CORE_PACKS } from "../src/data/icons";
import { mergePackManifests, PackManifest } from "../src/core/packManifest";
import { formatPackVersion, joinMeta } from "../src/utils";

const generated = JSON.parse(
  readFileSync(path.join(process.cwd(), "src", "data", "generated", "manifest.json"), "utf8"),
) as PackManifest;

/** Core packs are bundled in main.js and have no pack file/manifest entry. */
const EXTERNAL = ALL_PACKS.filter((p) => !CORE_PACKS.includes(p));

describe("bundled pack inventory", () => {
  it("covers every external pack with a version and a non-zero count", () => {
    const missing = EXTERNAL.filter((p) => !generated.packs[p]);
    expect(missing, "packs with no bundled metadata").toEqual([]);
    const broken = EXTERNAL.filter((p) => {
      const entry = generated.packs[p];
      return !entry || entry.count <= 0 || !entry.version;
    });
    expect(broken, "packs with an empty version/count").toEqual([]);
  });

  it("points its sample icons at real icons (unchanged contract)", () => {
    // A sanity check that the fallback describes this build, not a stale one.
    expect(generated.packs["solar"]?.count).toBe(8425);
    expect(generated.packs["fluent-ui"]?.count).toBe(20239);
  });
});

describe("mergePackManifests", () => {
  const bundled: PackManifest = {
    packs: {
      a: { version: "1.0.0", count: 10 },
      b: { version: "2.0.0", count: 20 },
    },
  };

  it("lets the runtime inventory win per pack and keeps the rest bundled", () => {
    const merged = mergePackManifests(bundled, {
      packs: { b: { version: "2.1.0", count: 25 }, c: { version: "3.0.0", count: 5 } },
    });
    expect(merged.packs.a).toEqual({ version: "1.0.0", count: 10 });
    expect(merged.packs.b).toEqual({ version: "2.1.0", count: 25 });
    expect(merged.packs.c).toEqual({ version: "3.0.0", count: 5 });
  });

  it("falls back to the bundled inventory when the runtime copy is missing or empty", () => {
    expect(mergePackManifests(bundled, undefined).packs).toEqual(bundled.packs);
    expect(mergePackManifests(bundled, { packs: {} }).packs).toEqual(bundled.packs);
    // A corrupt file must not wipe out metadata either.
    expect(mergePackManifests(bundled, { packs: { a: {} as never } }).packs.a).toEqual(
      bundled.packs.a,
    );
  });
});

describe("formatPackVersion", () => {
  it("prefixes real versions with a v", () => {
    expect(formatPackVersion("3.46.0")).toBe("v3.46.0");
    expect(formatPackVersion("1.2.77")).toBe("v1.2.77");
    expect(formatPackVersion("0.46.0")).toBe("v0.46.0");
  });

  it("leaves non-version labels alone instead of producing vSystem emoji", () => {
    expect(formatPackVersion("system emoji")).toBe("system emoji");
  });

  it("returns an empty string when the version is unknown, so callers drop it", () => {
    expect(formatPackVersion("?")).toBe("");
    expect(formatPackVersion("")).toBe("");
    expect(formatPackVersion("   ")).toBe("");
    expect(formatPackVersion(undefined)).toBe("");
    expect(formatPackVersion(null)).toBe("");
  });
});

describe("joinMeta", () => {
  it("joins the parts that exist and skips the ones that do not", () => {
    expect(joinMeta(["Icon pack", "v1.0.0", "42 icons"])).toBe("Icon pack · v1.0.0 · 42 icons");
    // An unknown version must not leave a dangling separator: "… ·  · 42 icons".
    expect(joinMeta(["Icon pack", formatPackVersion("?"), "42 icons"])).toBe(
      "Icon pack · 42 icons",
    );
    expect(joinMeta([undefined, "", null])).toBe("");
  });
});
