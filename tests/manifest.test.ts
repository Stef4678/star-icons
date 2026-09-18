/**
 * Star Icons — the Obsidian plugin manifest contract.
 *
 * Obsidian validates manifest.json when a plugin is submitted to (and updated
 * in) the community store. The most common technical rejection is the
 * description length: the limit is 250 characters, and an over-long string
 * fails the submission instead of being truncated. The description here grew to
 * 260 characters while adding the new packs, so these checks keep the manifest
 * release-ready — a submission should never fail on a technicality again.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8"));

const manifest = read("manifest.json");
const versions = read("versions.json") as Record<string, string>;
const pkg = read("package.json");
const lock = read("package-lock.json");

describe("plugin manifest", () => {
  it("keeps the description within the store's 250-character limit", () => {
    expect(
      manifest.description.length,
      `manifest.json description is ${manifest.description.length} characters`,
    ).toBeLessThanOrEqual(250);
  });

  it("keeps the description plain, single-line text", () => {
    expect(manifest.description).not.toMatch(/[\r\n]/);
    expect(manifest.description.trim()).toBe(manifest.description);
    // Markdown is rendered literally in the store listing.
    expect(manifest.description).not.toMatch(/\*\*|\[[^\]]+\]\(/);
  });

  it("carries every field Obsidian requires", () => {
    for (const key of ["id", "name", "version", "minAppVersion", "description", "author"]) {
      expect(typeof manifest[key], key).toBe("string");
      expect(manifest[key].length, key).toBeGreaterThan(0);
    }
    expect(manifest.id).toMatch(/^[a-z0-9-]+$/);
    // Store guidelines: the id and name must not imply an official plugin.
    expect(manifest.id).not.toContain("obsidian");
    expect(manifest.name).not.toMatch(/obsidian/i);
    expect(manifest.name.length).toBeLessThanOrEqual(250);
  });

  it("keeps the version in sync across the manifest, package and versions map", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).toBe(manifest.version);
    expect(lock.packages[""].version).toBe(manifest.version);
    // versions.json maps every released version to the minAppVersion it needs,
    // which is what Obsidian uses to decide whether an update is installable.
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("pins a minAppVersion that is a concrete release", () => {
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
