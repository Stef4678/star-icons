/**
 * Star Icons — Dataview integration.
 *
 * Lets Dataview queries drive *dynamic* icon collections: a query's rows
 * carry icon ids (either directly, or via a frontmatter property on each
 * page), and the plugin caches the resulting id list for the rules engine
 * ("random from Dataview query" actions) and the Icon Manager.
 *
 * Dataview is optional — every function here degrades gracefully when the
 * community plugin isn't installed/enabled.
 */

import { App } from "obsidian";

/** Minimal shape of the Dataview plugin API we rely on. */
export interface DataviewApi {
  query(query: string): Promise<unknown>;
}

/** The Dataview plugin's API, or null when it isn't installed + enabled. */
export function getDataviewApi(app: App): DataviewApi | null {
  try {
    const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } })
      .plugins?.plugins;
    const dv = plugins?.dataview as { api?: DataviewApi } | undefined;
    return dv?.api ?? null;
  } catch {
    return null;
  }
}

export function isDataviewAvailable(app: App): boolean {
  return getDataviewApi(app) !== null;
}

/**
 * Run a DQL query through the Dataview API and return its result value
 * (the `{ type, value }` block). Throws when Dataview is unavailable or the
 * query fails.
 */
export async function runDataviewQuery(app: App, query: string): Promise<unknown> {
  const api = getDataviewApi(app);
  if (!api) throw new Error("Dataview is not installed or enabled");
  const res = await api.query(query);
  if (
    !res ||
    typeof res !== "object" ||
    (res as { successful?: boolean }).successful === false
  ) {
    throw new Error("Dataview query failed");
  }
  return (res as { value?: unknown }).value;
}

/**
 * Extract icon ids from a Dataview query result.
 *
 * Accepts both DQL result shapes:
 *   • list  — `{ type: "list", value: [{ value: <page|primitive> }, …] }`
 *   • table — `{ type: "table", value: [[…cells]], header?: string[] }`
 *
 * For list rows whose value is a page, `iconProperty` is read off the page;
 * primitive row values (and table cells) are collected as-is. Anything that
 * isn't a string (or array of strings) is ignored. Pure — no Obsidian or
 * Dataview dependency, so it's unit-testable.
 */
export function extractIconIdsFromResult(
  result: unknown,
  iconProperty = "icon",
): string[] {
  const out = new Set<string>();
  if (!result || typeof result !== "object") return [];
  const r = result as { type?: string; value?: unknown; header?: unknown };

  if (r.type === "table" && Array.isArray(r.value)) {
    const header = Array.isArray(r.header) ? (r.header as string[]) : [];
    const colIndex = header.indexOf(iconProperty);
    for (const row of r.value as unknown[]) {
      if (!Array.isArray(row)) {
        addCell(out, row);
        continue;
      }
      if (colIndex >= 0) {
        addCell(out, row[colIndex]);
      } else {
        for (const cell of row) addCell(out, cell);
      }
    }
    return Array.from(out);
  }

  const rows = Array.isArray(r.value) ? r.value : [];
  for (const row of rows) {
    if (row && typeof row === "object" && "value" in (row as object)) {
      const v = (row as { value?: unknown }).value;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // A page object: read the icon property off it.
        addCell(out, (v as Record<string, unknown>)[iconProperty]);
      } else {
        addCell(out, v);
      }
    } else {
      addCell(out, row);
    }
  }
  return Array.from(out);
}

function addCell(set: Set<string>, v: unknown): void {
  if (typeof v === "string") {
    if (v.trim()) set.add(v.trim());
  } else if (Array.isArray(v)) {
    for (const x of v) addCell(set, x);
  }
}

/** Run a query and extract the icon ids (empty when Dataview unavailable). */
export async function queryDataviewIcons(
  app: App,
  query: string,
  iconProperty = "icon",
): Promise<string[]> {
  try {
    const value = await runDataviewQuery(app, query);
    return extractIconIdsFromResult(value, iconProperty);
  } catch {
    return [];
  }
}
