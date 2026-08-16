/**
 * Star Icons — settings model: merge persisted data.json with defaults
 * (forward/backward compatible, never crashes on missing keys).
 */

import { DEFAULT_SETTINGS, StarIconsSettings } from "./types";

export function mergeSettings(raw: unknown): StarIconsSettings {
  const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as StarIconsSettings;
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const out = base as unknown as Record<string, unknown>;

  for (const key of Object.keys(base)) {
    const v = r[key];
    if (v === undefined || v === null) continue;
    const target = out[key];
    if (target && typeof target === "object" && !Array.isArray(target)) {
      // shallow-merge nested records (enabledPacks, overrides, fileTypeDefaults, iconTags)
      const spread = typeof v === "object" && v !== null ? v : {};
      out[key] = { ...target, ...spread };
    } else if (Array.isArray(target)) {
      const arr = Array.isArray(v) ? v : [];
      out[key] = arr.filter((item): item is object => item !== null && typeof item === "object");
    } else {
      out[key] = v;
    }
  }
  return base;
}
