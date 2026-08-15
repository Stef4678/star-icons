/**
 * Star Icons — rule engine tests (pure logic, no Obsidian runtime needed).
 */

import { describe, expect, it, vi, beforeAll } from "vitest";

// The `obsidian` npm package is types-only; use runtime stubs for the tests.
vi.mock("obsidian", () => import("./stubs/obsidian"));

import {
  evaluateCondition,
  FileContext,
  matchRule,
  resolveIcon,
} from "../src/core/ruleEngine";
import { buildPackFromRaw, mountPack, RawPack } from "../src/data/icons";
import lucideData from "../src/data/generated/lucide.json";
import materialData from "../src/data/generated/material.json";
import {
  DEFAULT_SETTINGS,
  Rule,
  RuleCondition,
  StarIconsSettings,
} from "../src/types";
import { fuzzyScore, searchIcons, stableIndex } from "../src/utils";
import { IconDef } from "../src/types";

function ctx(overrides: Partial<FileContext> = {}): FileContext {
  return {
    path: "folder/note.md",
    basename: "note",
    name: "note.md",
    extension: "md",
    isFolder: false,
    folderPath: "folder",
    tags: ["project", "todo"],
    properties: { type: "journal", status: "active" },
    headings: ["Introduction", "Conclusion"],
    now: new Date(2025, 0, 15, 10, 30), // Wednesday 10:30
    ...overrides,
  };
}

function cond(partial: Partial<RuleCondition> & { type: RuleCondition["type"] }): RuleCondition {
  return { id: "c1", op: "contains", value: "", ...partial };
}

function settings(overrides: Partial<StarIconsSettings> = {}): StarIconsSettings {
  return { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...overrides };
}

// The dynamic registry starts with only the bundled core packs; the tests
// need Lucide + Material mounted so icon validation/resolution works.
beforeAll(() => {
  mountPack("lucide", buildPackFromRaw("lucide", lucideData as unknown as RawPack));
  mountPack("material", buildPackFromRaw("material", materialData as unknown as RawPack));
});

describe("evaluateCondition", () => {
  it("filename operators", () => {
    const c = ctx();
    expect(evaluateCondition(cond({ type: "filename", op: "equals", value: "note" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "filename", op: "equals", value: "other" }), c)).toBe(false);
    expect(evaluateCondition(cond({ type: "filename", op: "contains", value: "ot" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "filename", op: "startsWith", value: "no" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "filename", op: "endsWith", value: "ote" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "filename", op: "matches", value: "^n.te$" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "filename", op: "matches", value: "[" }), c)).toBe(false); // invalid regex
  });

  it("path and extension", () => {
    const c = ctx();
    expect(evaluateCondition(cond({ type: "path", op: "contains", value: "folder" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "extension", op: "equals", value: "md" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "extension", op: "equals", value: "pdf" }), c)).toBe(false);
    expect(evaluateCondition(cond({ type: "extension", op: "isIn", value: "md, pdf" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "extension", op: "isNotIn", value: "png, pdf" }), c)).toBe(true);
  });

  it("folder conditions (file inside nested folder)", () => {
    const nested = ctx({ path: "a/b/c/file.md", folderPath: "a/b/c" });
    expect(evaluateCondition(cond({ type: "folder", op: "isIn", value: "a/b" }), nested)).toBe(true);
    expect(evaluateCondition(cond({ type: "folder", op: "isIn", value: "a/b/c" }), nested)).toBe(true);
    expect(evaluateCondition(cond({ type: "folder", op: "isIn", value: "x" }), nested)).toBe(false);
    expect(evaluateCondition(cond({ type: "folder", op: "isNotIn", value: "a/b" }), nested)).toBe(false);
    // a folder itself
    const folderCtx = ctx({ path: "a/b", basename: "b", isFolder: true, folderPath: "a" });
    expect(evaluateCondition(cond({ type: "folder", op: "isIn", value: "a" }), folderCtx)).toBe(true);
  });

  it("tags", () => {
    const c = ctx();
    expect(evaluateCondition(cond({ type: "tag", op: "equals", value: "project" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "tag", op: "equals", value: "nope" }), c)).toBe(false);
    expect(evaluateCondition(cond({ type: "tag", op: "contains", value: "roj" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "tag", op: "equals", value: "#project" }), c)).toBe(true); // leading # tolerated
  });

  it("properties", () => {
    const c = ctx();
    expect(evaluateCondition(cond({ type: "property", op: "exists", key: "type" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "property", op: "notExists", key: "missing" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "property", op: "equals", key: "type", value: "journal" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "property", op: "contains", key: "status", value: "act" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "property", op: "equals", key: "type", value: "x" }), c)).toBe(false);
  });

  it("headings", () => {
    const c = ctx();
    expect(evaluateCondition(cond({ type: "heading", op: "contains", value: "Intro" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "heading", op: "startsWith", value: "Concl" }), c)).toBe(true);
    expect(evaluateCondition(cond({ type: "heading", op: "equals", value: "Nope" }), c)).toBe(false);
  });

  it("time conditions", () => {
    // Wed 10:30
    expect(evaluateCondition(cond({ type: "time", days: [3] }), ctx())).toBe(true);
    expect(evaluateCondition(cond({ type: "time", days: [1] }), ctx())).toBe(false);
    expect(evaluateCondition(cond({ type: "time", from: "09:00", to: "11:00" }), ctx())).toBe(true);
    expect(evaluateCondition(cond({ type: "time", from: "11:00", to: "12:00" }), ctx())).toBe(false);
    // overnight window 22:00–02:00 should match 10:30? No (10:30 is outside)
    expect(evaluateCondition(cond({ type: "time", from: "22:00", to: "02:00" }), ctx())).toBe(false);
    // overnight window 22:00–02:00 at 23:00
    const late = ctx({ now: new Date(2025, 0, 15, 23, 0) });
    expect(evaluateCondition(cond({ type: "time", from: "22:00", to: "02:00" }), late)).toBe(true);
    // invalid time strings are ignored (only day check applies)
    expect(evaluateCondition(cond({ type: "time", from: "bad", days: [3] }), ctx())).toBe(true);
  });

  it("unknown type evaluates false", () => {
    expect(evaluateCondition({ id: "x", type: "filename" as never, op: "equals" as never }, ctx())).toBe(false);
  });
});

describe("matchRule", () => {
  function rule(partial: Partial<Rule>): Rule {
    return {
      id: "r1",
      name: "test",
      enabled: true,
      match: "all",
      conditions: [],
      action: { type: "clear" },
      createdAt: 0,
      ...partial,
    };
  }

  it("all conditions must match", () => {
    const r = rule({
      match: "all",
      conditions: [
        cond({ type: "extension", op: "equals", value: "md" }),
        cond({ type: "tag", op: "equals", value: "project" }),
      ],
    });
    expect(matchRule(r, ctx())).toBe(true);
    const r2 = rule({
      match: "all",
      conditions: [
        cond({ type: "extension", op: "equals", value: "md" }),
        cond({ type: "tag", op: "equals", value: "nope" }),
      ],
    });
    expect(matchRule(r2, ctx())).toBe(false);
  });

  it("any condition matches", () => {
    const r = rule({
      match: "any",
      conditions: [
        cond({ type: "extension", op: "equals", value: "pdf" }),
        cond({ type: "tag", op: "equals", value: "project" }),
      ],
    });
    expect(matchRule(r, ctx())).toBe(true);
  });

  it("empty conditions match everything", () => {
    expect(matchRule(rule({ conditions: [] }), ctx())).toBe(true);
  });
});

describe("resolveIcon priority", () => {
  it("override beats rules", () => {
    const s = settings({
      overrides: { "folder/note.md": "si-lucide-home" },
      rules: [
        {
          id: "r", name: "R", enabled: true, match: "all" as const, conditions: [],
          action: { type: "icon", iconId: "si-lucide-star" }, createdAt: 0,
        },
      ],
    });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBe("si-lucide-home");
    expect(res.source).toBe("override");
  });

  it("first enabled rule wins, disabled rules skipped", () => {
    const s = settings({
      rules: [
        {
          id: "r1", name: "Disabled", enabled: false, match: "all" as const, conditions: [],
          action: { type: "icon", iconId: "si-lucide-star" }, createdAt: 0,
        },
        {
          id: "r2", name: "Active", enabled: true, match: "all" as const, conditions: [],
          action: { type: "icon", iconId: "si-lucide-heart" }, createdAt: 0,
        },
      ],
    });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBe("si-lucide-heart");
    expect(res.detail).toBe("Active");
    expect(res.ruleId).toBe("r2");
  });

  it("clear action stops with Obsidian default", () => {
    const s = settings({
      rules: [
        {
          id: "r", name: "Clear", enabled: true, match: "all" as const, conditions: [],
          action: { type: "clear" }, createdAt: 0,
        },
      ],
      fileTypeDefaults: { md: "si-lucide-file" },
    });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBeNull();
    expect(res.source).toBe("rule");
  });

  it("file type default applies when no rule matches", () => {
    const s = settings({ fileTypeDefaults: { md: "si-lucide-file-text" } });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBe("si-lucide-file-text");
    expect(res.source).toBe("filetype");
  });

  it("global default applies last", () => {
    const s = settings({ defaultIcon: "si-star-star-sparkle" });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBe("si-star-star-sparkle");
    expect(res.source).toBe("default");
  });

  it("none when nothing configured", () => {
    expect(resolveIcon(settings(), ctx()).source).toBe("none");
  });

  it("random from collection is deterministic per path", () => {
    const s = settings({
      collections: [
        { id: "col1", name: "C", iconIds: ["si-lucide-a", "si-lucide-b", "si-lucide-c"], createdAt: 0 },
      ],
      rules: [
        {
          id: "rr", name: "Rand", enabled: true, match: "all" as const, conditions: [],
          action: { type: "random", collectionId: "col1" }, createdAt: 0,
        },
      ],
    });
    const a = resolveIcon(s, ctx());
    const b = resolveIcon(s, ctx());
    expect(a.iconId).toBe(b.iconId);
    expect(a.source).toBe("rule");
    expect(["si-lucide-a", "si-lucide-b", "si-lucide-c"]).toContain(a.iconId);
  });

  it("unavailable icon (pack disabled) falls back to default", () => {
    const s = settings({
      enabledPacks: { lucide: false, material: true, star: true },
      defaultIcon: "si-material-star",
      fileTypeDefaults: { md: "si-lucide-file" }, // disabled pack
    });
    const res = resolveIcon(s, ctx());
    expect(res.iconId).toBe("si-material-star");
  });
});

describe("search utilities", () => {
  it("fuzzyScore matches subsequences", () => {
    expect(fuzzyScore("", "anything")).toBeGreaterThan(0);
    expect(fuzzyScore("home", "home")).toBeGreaterThan(fuzzyScore("hme", "home"));
    expect(fuzzyScore("zzz", "home")).toBe(0);
  });

  it("searchIcons scores name matches above tag matches", () => {
    const icons: IconDef[] = [
      { id: "si-lucide-star", pack: "lucide", name: "star", tags: ["star"], svg: "<path/>" },
      { id: "si-lucide-sparkles", pack: "lucide", name: "sparkles", tags: ["sparkle", "star"], svg: "<path/>" },
      { id: "si-material-star", pack: "material", name: "star", tags: ["star"], svg: "<path/>" },
    ];
    const res = searchIcons(icons, "star");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name).toBe("star"); // exact name match first
    const tagOnly = searchIcons(icons, "sparkle");
    expect(tagOnly.some((i) => i.id === "si-lucide-sparkles")).toBe(true);
  });

  it("stableIndex is deterministic", () => {
    expect(stableIndex("a/b.md:rule1", 5)).toBe(stableIndex("a/b.md:rule1", 5));
    expect(stableIndex("a/b.md:rule1", 5)).toBeGreaterThanOrEqual(0);
    expect(stableIndex("a/b.md:rule1", 5)).toBeLessThan(5);
  });
});
