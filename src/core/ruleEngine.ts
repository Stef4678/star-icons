/**
 * Star Icons — the rules engine.
 *
 * Pure, testable logic that decides which icon applies to a file or folder:
 *
 *   Manual override > ordered custom rules > file-type default > global default
 *
 * Every resolution returns a traceable `Resolution` so the UI can explain
 * *why* an icon was chosen (transparency as a feature).
 */

import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { getIcon } from "../data/icons";
import { CompareOp, Resolution, Rule, RuleCondition, StarIconsSettings } from "../types";
import { isValidRegex, parseMinutes, stableIndex, toMinutes } from "../utils";

export interface FileContext {
  path: string;
  basename: string;
  name: string;
  extension: string;
  isFolder: boolean;
  folderPath: string;
  tags: string[];
  properties: Record<string, unknown>;
  headings: string[];
  now: Date;
}

/** Build a context object for a file/folder from Obsidian caches. */
export function buildFileContext(file: TAbstractFile, app: App, now = new Date()): FileContext {
  const isFolder = file instanceof TFolder;
  const name = file.name;
  const extension = file instanceof TFile ? file.extension.toLowerCase() : "";
  const basename = isFolder
    ? name
    : extension
      ? name.slice(0, -(extension.length + 1))
      : name;
  const folderPath = file.parent ? file.parent.path : "/";

  let tags: string[] = [];
  let properties: Record<string, unknown> = {};
  let headings: string[] = [];

  if (file instanceof TFile && app.metadataCache) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache) {
      if (cache.tags) tags = cache.tags.map((t) => t.tag.replace(/^#/, ""));
      if (cache.frontmatter) {
        // FrontMatterCache is typed with an `any` index signature; copy the
        // values into an unknown-typed record so no `any` leaks into the context.
        const fm: Record<string, unknown> = {};
        for (const key of Object.keys(cache.frontmatter)) {
          fm[key] = cache.frontmatter[key] as unknown;
        }
        properties = fm;
        const ft = cache.frontmatter.tags as unknown;
        if (Array.isArray(ft)) tags = tags.concat(ft.map(String));
        else if (typeof ft === "string") tags.push(ft);
      }
      if (cache.headings) headings = cache.headings.map((h) => h.heading);
    }
  }

  return { path: file.path, basename, name, extension, isFolder, folderPath, tags, properties, headings, now };
}

/* --- string operators -------------------------------------------------- */

function stringOp(value: string, op: CompareOp, target: string): boolean {
  switch (op) {
    case "equals":
      return value === target;
    case "contains":
      return value.includes(target);
    case "startsWith":
      return value.startsWith(target);
    case "endsWith":
      return value.endsWith(target);
    case "matches":
      return isValidRegex(target) && new RegExp(target).test(value);
    case "isIn": {
      return target
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .includes(value);
    }
    case "isNotIn": {
      return !target
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .includes(value);
    }
    default:
      return false;
  }
}

function anyOp(values: string[], op: CompareOp, target: string): boolean {
  if (values.length === 0) return op === "notExists";
  return values.some((v) => stringOp(v, op, target));
}

/* --- condition evaluation ---------------------------------------------- */

export function evaluateCondition(cond: RuleCondition, ctx: FileContext): boolean {
  const v = cond.value?.trim() ?? "";

  switch (cond.type) {
    case "filename":
      return stringOp(ctx.basename, cond.op, v);
    case "path":
      return stringOp(ctx.path, cond.op, v);
    case "extension":
      return stringOp(ctx.extension, cond.op, v);
    case "folder": {
      const folder = ctx.isFolder ? ctx.path : ctx.folderPath;
      const root = v.replace(/[\\/]+$/, "");
      switch (cond.op) {
        case "isIn":
          return root === "/" || folder === root || folder.startsWith(root + "/");
        case "isNotIn":
          return !(root === "/" || folder === root || folder.startsWith(root + "/"));
        case "contains":
          return folder.includes(v);
        case "matches":
          return isValidRegex(v) && new RegExp(v).test(folder);
        default:
          return stringOp(folder, cond.op, v);
      }
    }
    case "tag": {
      const tags = ctx.tags.map((t) => t.replace(/^#/, "").toLowerCase());
      const target = v.replace(/^#/, "").toLowerCase();
      switch (cond.op) {
        case "equals":
          return tags.includes(target);
        case "contains":
          return tags.some((t) => t.includes(target));
        case "startsWith":
          return tags.some((t) => t.startsWith(target));
        default:
          return anyOp(tags, cond.op, target);
      }
    }
    case "property": {
      const key = cond.key?.trim() ?? "";
      if (!key) return false;
      const has = Object.prototype.hasOwnProperty.call(ctx.properties, key);
      switch (cond.op) {
        case "exists":
          return has;
        case "notExists":
          return !has;
        case "equals":
          return has && String(ctx.properties[key]) === v;
        case "contains":
          return has && String(ctx.properties[key]).includes(v);
        default:
          return has && stringOp(String(ctx.properties[key]), cond.op, v);
      }
    }
    case "heading":
      return anyOp(ctx.headings, cond.op, v);
    case "time":
      return timeOp(cond, ctx.now);
    default:
      return false;
  }
}

function timeOp(cond: RuleCondition, now: Date): boolean {
  if (cond.days?.length && !cond.days.includes(now.getDay())) return false;
  const m = toMinutes(now);
  const from = parseMinutes(cond.from);
  const to = parseMinutes(cond.to);
  if (from !== null && to !== null) {
    return from <= to ? m >= from && m <= to : m >= from || m <= to;
  }
  if (from !== null) return m >= from;
  if (to !== null) return m <= to;
  return true;
}

export function matchRule(rule: Rule, ctx: FileContext): boolean {
  if (rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => evaluateCondition(c, ctx));
  return rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

/* --- resolution -------------------------------------------------------- */

export function resolveIcon(settings: StarIconsSettings, ctx: FileContext): Resolution {
  // 1. manual override
  const override = settings.overrides[ctx.path];
  if (override) {
    return valid(settings, override)
      ? { iconId: override, source: "override", detail: "Manual override" }
      : { iconId: null, source: "override", detail: "Manual override (icon unavailable)" };
  }

  // 2. ordered rules (first enabled match wins)
  for (const rule of settings.rules) {
    if (!rule.enabled) continue;
    if (!matchRule(rule, ctx)) continue;
    const action = rule.action;
    if (action.type === "icon") {
      return valid(settings, action.iconId)
        ? { iconId: action.iconId, source: "rule", detail: rule.name, ruleId: rule.id }
        : { iconId: null, source: "rule", detail: `${rule.name} (icon unavailable)`, ruleId: rule.id };
    }
    if (action.type === "clear") {
      return { iconId: null, source: "rule", detail: rule.name, ruleId: rule.id };
    }
    if (action.type === "random") {
      const col = settings.collections.find((c) => c.id === action.collectionId);
      const ids = col?.iconIds ?? [];
      if (ids.length) {
        const id = ids[stableIndex(`${ctx.path}:${rule.id}`, ids.length)];
        return {
          iconId: id,
          source: "rule",
          detail: `${rule.name} (random from "${col?.name ?? "collection"}")`,
          ruleId: rule.id,
        };
      }
      continue; // empty collection -> fall through to next priority
    }
  }

  // 3. file-type default
  if (!ctx.isFolder) {
    const ft = settings.fileTypeDefaults[ctx.extension];
    if (ft && valid(settings, ft)) {
      return { iconId: ft, source: "filetype", detail: `File type .${ctx.extension}` };
    }
    // invalid/disabled icon -> fall through to the global default
  }

  // 4. global default
  if (settings.defaultIcon) {
    return valid(settings, settings.defaultIcon)
      ? { iconId: settings.defaultIcon, source: "default", detail: "Default icon" }
      : { iconId: null, source: "default", detail: "Default icon (unavailable)" };
  }

  return { iconId: null, source: "none", detail: "Obsidian default" };
}

/** True when the icon id exists in the registry and its pack is enabled. */
function valid(settings: StarIconsSettings, iconId: string): boolean {
  const def = getIcon(iconId);
  if (!def) return false;
  return settings.enabledPacks[def.pack] !== false;
}

