/**
 * Star Icons — Dataview integration tests (pure extraction logic).
 */

import { describe, expect, it, vi } from "vitest";

// The `obsidian` npm package is types-only; use runtime stubs for the tests.
vi.mock("obsidian", () => import("./stubs/obsidian"));

import { extractIconIdsFromResult } from "../src/core/dataview";

describe("extractIconIdsFromResult", () => {
  it("list of pages: reads the icon property off each page", () => {
    const result = {
      type: "list",
      value: [
        { value: { file: { name: "a.md" }, icon: "si-lucide-home" } },
        { value: { file: { name: "b.md" }, icon: "si-lucide-star" } },
        { value: { file: { name: "c.md" } } }, // no icon property -> skipped
      ],
    };
    expect(extractIconIdsFromResult(result, "icon")).toEqual([
      "si-lucide-home",
      "si-lucide-star",
    ]);
  });

  it("list of primitive values: collects them directly", () => {
    const result = {
      type: "list",
      value: [{ value: "si-lucide-home" }, { value: "si-tabler-star" }],
    };
    expect(extractIconIdsFromResult(result)).toEqual(["si-lucide-home", "si-tabler-star"]);
  });

  it("list with array values (multiple icons per row)", () => {
    const result = {
      type: "list",
      value: [
        { value: ["si-lucide-home", "si-lucide-star"] },
        { value: "si-lucide-heart" },
      ],
    };
    expect(extractIconIdsFromResult(result)).toEqual([
      "si-lucide-home",
      "si-lucide-star",
      "si-lucide-heart",
    ]);
  });

  it("table with header: uses the matching column", () => {
    const result = {
      type: "table",
      header: ["file", "icon"],
      value: [
        ["a.md", "si-lucide-home"],
        ["b.md", "si-lucide-star"],
        ["c.md", "not-an-icon"],
      ],
    };
    expect(extractIconIdsFromResult(result, "icon")).toEqual([
      "si-lucide-home",
      "si-lucide-star",
      "not-an-icon",
    ]);
  });

  it("table without header: scans every cell", () => {
    const result = {
      type: "table",
      value: [
        ["si-lucide-home", 42],
        [null, "si-lucide-star"],
      ],
    };
    expect(extractIconIdsFromResult(result)).toEqual(["si-lucide-home", "si-lucide-star"]);
  });

  it("deduplicates ids and trims whitespace", () => {
    const result = {
      type: "list",
      value: [{ value: " si-lucide-home " }, { value: "si-lucide-home" }],
    };
    expect(extractIconIdsFromResult(result)).toEqual(["si-lucide-home"]);
  });

  it("ignores non-string values and empty results", () => {
    expect(extractIconIdsFromResult(null)).toEqual([]);
    expect(extractIconIdsFromResult({ type: "list", value: [] })).toEqual([]);
    expect(
      extractIconIdsFromResult({ type: "list", value: [{ value: 7 }, { value: null }] }),
    ).toEqual([]);
    expect(extractIconIdsFromResult({ type: "list", value: [{ value: { nope: 1 } }] }, "icon")).toEqual([]);
  });
});
